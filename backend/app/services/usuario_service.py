# Orquestra tudo relacionado aos usuários: registro de alunos, professores e coordenadores (cada um com suas regras próprias), busca por ID e a mecânica completa de login (com validação de senha e emissão do JWT).

from datetime import timedelta
from app.core import auth
from app.models import Usuario, Aluno, Professor, Coordenador, UserRole
from app.schemas.usuario_schemas import AlunoCreate, FuncionarioCreate
from app.core.config import settings
from app.repositories.usuario_repository import UsuarioRepository
from app.repositories.aluno_repository import AlunoRepository
from app.repositories.professor_repository import ProfessorRepository
from app.core.exceptions import (
    MatriculaObrigatoriaError, MatriculaJaCadastradaError, 
    EmailJaEmUsoError, MultiplasContasError, 
    CredenciaisInvalidasError, UsuarioNaoEncontradoError
)

class UsuarioService:
    # Construtor do serviço recebendo os dois repositórios por injeção de dependência.
    def __init__(
            self, 
            usuario_repo: UsuarioRepository, 
            aluno_repo: AlunoRepository,
            professor_repo: ProfessorRepository
        ):
        self.usuario_repo = usuario_repo
        self.aluno_repo = aluno_repo
        self.professor_repo = professor_repo

    # --- MÉTODOS PÚBLICOS ESPECÍFICOS ---

    # Fluxo de registro de estudante
    def registrar_aluno(self, dados: AlunoCreate) -> Usuario:
        # Verifica no banco se a matrícula informada já existe. Se existir, lança MatriculaJaCadastradaError
        if self.aluno_repo.buscar_por_matricula(dados.matricula):
            raise MatriculaJaCadastradaError("Esta matrícula já está cadastrada.")

        # Cria o usuário com role ALUNO e instancia o perfil Aluno com a matrícula
        usuario_base = self._preparar_usuario_base(dados, UserRole.ALUNO)
        perfil = Aluno(matricula=dados.matricula)

        # Salva no banco o usuário com role Aluno e o Aluno de forma atômica
        user_salvo = self.usuario_repo.criar_usuario_com_perfil(usuario_base, perfil)
        user_salvo.matricula = dados.matricula # para que o Pydantic consiga preencher o campo na resposta final da API
        return user_salvo

    # Listagem de alunos
    def listar_alunos(self) -> list[dict]:
        alunos = self.aluno_repo.listar_todos()
        return [
            {
                "nome": a.usuario.nome,
                "email": a.usuario.email,
                "matricula": a.matricula
            }
            for a in alunos
        ]

    # Fluxo de registro de professor. Confere se o e-mail não pertence a outro funcionário, cria o usuário com role PROFESSOR e instancia o perfil Professor().
    def registrar_professor(self, dados: FuncionarioCreate) -> Usuario:
        self._verificar_email_funcionario(dados.email)
            
        usuario_base = self._preparar_usuario_base(dados, UserRole.PROFESSOR)
        perfil = Professor()
        
        return self.usuario_repo.criar_usuario_com_perfil(usuario_base, perfil)

    # Listagem de professores
    def listar_professores(self) -> list[dict]:
        professores = self.professor_repo.listar_todos()
        return [
            {
                "nome": prof.usuario.nome,
                "email": prof.usuario.email
            }
            for prof in professores
        ]


    # Idêntico ao do professor, porém com coordenador
    def registrar_coordenador(self, dados: FuncionarioCreate) -> Usuario:
        self._verificar_email_funcionario(dados.email)
            
        usuario_base = self._preparar_usuario_base(dados, UserRole.COORDENADOR)
        perfil = Coordenador()
        
        return self.usuario_repo.criar_usuario_com_perfil(usuario_base, perfil)

    # Autenticação do usuário (email ou matrícula)
    def autenticar_usuario(self, identificador: str, password: str) -> dict:
    # O usuário digita um valor no campo de usuário (identificador)
        user = None

        # Se tiver @: O sistema entende que é um e-mail. Busca todos os usuários com aquele e-mail. Se encontrar apenas um, é ele. Se houver mais de um, o sistema impede a ambiguidade lançando MultiplasContasError e exigindo que a pessoa use a matrícula.
        if "@" in identificador:
            usuarios_encontrados = self.usuario_repo.buscar_todos_por_email(identificador.lower())
            if len(usuarios_encontrados) == 1:
                user = usuarios_encontrados[0]
            elif len(usuarios_encontrados) > 1:
                raise MultiplasContasError("Múltiplas contas encontradas. Faça login utilizando a Matrícula do aluno.")
        # Se NÃO tiver @: O sistema entende que é uma matrícula de aluno. Busca o aluno correspondente e puxa o objeto de usuário vinculado (aluno.usuario).
        else:
            aluno = self.aluno_repo.buscar_por_matricula(identificador)
            if aluno:
                user = aluno.usuario

        # Se o usuário não existir OU a senha digitada não bater com o hash salvo, estoura CredenciaisInvalidasError.
        if not user or not auth.verify_password(password, user.senha_hash):
            raise CredenciaisInvalidasError("Credenciais incorretas")

        # Com a senha validada, monta o token contendo o ID do usuário (sub), e-mail e papel (role), com o tempo de validade definido em settings. Retorna o token com o padrão bearer.
        token = auth.create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role.value}, 
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
        )
        return {"access_token": token, "token_type": "bearer"}

    # Busca uma conta pelo ID e, caso não exista, lança UsuarioNaoEncontradoError
    def buscar_usuario(self, user_id: int) -> Usuario:
        user = self.usuario_repo.buscar_por_id(user_id)
        if not user:
            raise UsuarioNaoEncontradoError("Usuário não encontrado")
        return user
    
    # --- MÉTODOS PRIVADOS REUTILIZÁVEIS ---

    def _preparar_usuario_base(self, dados, role: UserRole) -> Usuario:
        """Cria a entidade base compartilhada por todos os tipos de conta."""
        return Usuario(
            nome=dados.nome,
            email=dados.email.lower(),
            senha_hash=auth.hash_password(dados.senha),
            role=role
        )

    def _verificar_email_funcionario(self, email: str):
        """Regra de negócio compartilhada por staff."""
        if self.usuario_repo.buscar_funcionarios_por_email(email.lower()):
            raise EmailJaEmUsoError("Este e-mail já está em uso por outro funcionário.")