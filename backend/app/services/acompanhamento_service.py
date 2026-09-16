# Cuida do propósito central do projeto: a atribuição de um tutor acadêmico para o estudante e a exibição do painel de responsabilidades, formatando os dados conforme o papel de quem está logado.

from app.models import Usuario, UserRole
from app.schemas.acompanhamento_schemas import TutorarAlunoIn, AcompanhamentoResponse
from app.core.exceptions import PermissaoNegadaError, RecursoNaoEncontradoError, UsuarioNaoEncontradoError, VinculoJaExistenteError
from app.repositories.aluno_repository import AlunoRepository
from app.repositories.professor_repository import ProfessorRepository
from app.repositories.disciplina_repository import DisciplinaRepository
from app.repositories.matricula_repository import MatriculaRepository

class AcompanhamentoService:
    def __init__(
        self, 
        aluno_repo: AlunoRepository,
        professor_repo: ProfessorRepository,
        disciplina_repo: DisciplinaRepository,
        matricula_repo: MatriculaRepository
    ):
        self.aluno_repo = aluno_repo
        self.professor_repo = professor_repo
        self.disciplina_repo = disciplina_repo
        self.matricula_repo = matricula_repo

    # Só coordenador pode fazer essas coisas
    def _verificar_permissao_coordenador(self, usuario: Usuario):
        if usuario.role != UserRole.COORDENADOR:
            raise PermissaoNegadaError("Apenas coordenadores podem realizar esta ação.")

    # Regra para o Coordenador assumir a tutoria de um aluno
    def vincular_tutor(self, dados: TutorarAlunoIn, usuario_logado: Usuario):
        self._verificar_permissao_coordenador(usuario_logado)

        # Confere se o aluno existe, pela matrícula
        aluno = self.aluno_repo.buscar_por_matricula(dados.aluno_matricula)
        if not aluno:
            raise RecursoNaoEncontradoError(f"Aluno com matrícula '{dados.aluno_matricula}' não encontrado.")

        # Checa se o coordenador já não era o tutor desse aluno, evitando requisições duplicadas (VinculoJaExistenteError).
        if aluno.tutor_id == usuario_logado.id:
            raise VinculoJaExistenteError("Você já é o tutor deste aluno.")

        # Grava no banco e retorna uma mensagem de confirmação contendo o número da matrícula.
        self.aluno_repo.atualizar_tutor(aluno, usuario_logado.id)
        return {"mensagem": f"Você agora é o tutor responsável pela matrícula {aluno.matricula}."}

    # Coordenador remove aluno de sua tutoria
    def remover_tutor(self, matricula: str, usuario_logado: Usuario):
        self._verificar_permissao_coordenador(usuario_logado)

        aluno = self.aluno_repo.buscar_por_matricula(matricula)
        if not aluno:
            raise RecursoNaoEncontradoError(f"Aluno com matrícula '{matricula}' não encontrado.")

        # Atualiza o tutor para None usando o método padrão do repositório
        self.aluno_repo.atualizar_tutor(aluno, None)
        return {"mensagem": "Tutoria encerrada com sucesso."}

    # Montagem do painel de acompanhamento inteligente
    def listar_sob_responsabilidade(self, usuario_logado: Usuario) -> AcompanhamentoResponse:
        # Se for Coordenador: Busca na tabela alunos quem tem tutor_id == coordenador.id e formata a lista buscando o nome na tabela de usuários (aluno.usuario.nome).
        if usuario_logado.role == UserRole.COORDENADOR:
            tutorados = self.aluno_repo.listar_por_tutor(usuario_logado.id)
            tutorados_formatados = [
                {
                    "nome": aluno.usuario.nome,   
                    "matricula": aluno.matricula
                }
                for aluno in tutorados
            ]
            return AcompanhamentoResponse(tipo="COORDENADOR", tutorados=tutorados_formatados)

        # Se for Professor: Busca na tabela matriculas todos os vínculos atribuídos a ele e formata a resposta aninhando o aluno correspondente (m.aluno.usuario.nome).
        elif usuario_logado.role == UserRole.PROFESSOR:
            matriculas = self.matricula_repo.listar_por_professor(usuario_logado.id)
            matriculas_formatadas = [
                {
                    "id": m.id,
                    "aluno": {
                        "nome": m.aluno.usuario.nome,
                        "matricula": m.aluno.matricula
                    },
                    "professor": {
                        "nome": m.professor.usuario.nome,
                        "email": m.professor.usuario.email
                    },
                    "disciplina": {
                        "id": m.disciplina.id,
                        "nome": m.disciplina.nome,
                        "codigo": m.disciplina.codigo
                    }
                }
                for m in matriculas
            ]
            return AcompanhamentoResponse(tipo="PROFESSOR", matriculas=matriculas_formatadas)

        # Porém, Alunos não podem fazer isso
        else:
            raise PermissaoNegadaError("Alunos não possuem acesso à listagem de responsabilidade.")