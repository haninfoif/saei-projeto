# Guichê de Autenticação e Cadastro. Expõe as rotas de registro separado para cada perfil, a rota de login via OAuth2 e a consulta do próprio perfil logado (/me).

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from typing import List
from app.models import Usuario, UserRole
from app.schemas import auth_schemas, usuario_schemas
from app.api.dependencies import get_current_user, get_usuario_service
from app.services.usuario_service import UsuarioService

# Todas as rotas desse arquivo começam com /auth
# tags=["Autenticação"] agrupa  essas rotas em uma caixinha na tela do Swagger (/docs)
router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Rota de cadastro do estudante
# status_code = 201 significa "criado com sucesso"
# response_model=usuario_schemas.UsuarioPrivado garante que a resposta devolva nome, e-mail e matrícula, mas nunca mostre a senha
# POST cria algo novo do zero
@router.post("/register/aluno", response_model=usuario_schemas.UsuarioPrivado, status_code=status.HTTP_201_CREATED)
def register_aluno(
    user_in: usuario_schemas.AlunoCreate, 
    service: UsuarioService = Depends(get_usuario_service)
):
    """Registra um novo aluno no sistema."""
    return service.registrar_aluno(user_in)

# Rota de cadastro do professor
@router.post("/register/professor", response_model=usuario_schemas.UsuarioPrivado, status_code=status.HTTP_201_CREATED)
def register_professor(
    user_in: usuario_schemas.FuncionarioCreate, 
    service: UsuarioService = Depends(get_usuario_service)
):
    """Registra um novo professor no sistema."""
    return service.registrar_professor(user_in)

# Rota de cadastro do coordenador
@router.post("/register/coordenador", response_model=usuario_schemas.UsuarioPrivado, status_code=status.HTTP_201_CREATED)
def register_coordenador(
    user_in: usuario_schemas.FuncionarioCreate, 
    service: UsuarioService = Depends(get_usuario_service)
):
    """Registra um novo coordenador no sistema."""
    return service.registrar_coordenador(user_in)

# Rota de login
@router.post("/login", response_model=auth_schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    service: UsuarioService = Depends(get_usuario_service)
):
    """Realiza a autenticação do usuário retornando o token JWT."""
    return service.autenticar_usuario(form_data.username, form_data.password)

# Quem sou eu?
@router.get("/me", response_model=usuario_schemas.UsuarioPrivado)
def read_users_me(current_user: Usuario = Depends(get_current_user)):
    """Retorna o usuário atualmente autenticado."""
    return current_user

# Retorna a lista de todos os alunos
@router.get("/alunos", response_model=List[usuario_schemas.AlunoResumoPublico], status_code=status.HTTP_200_OK)
def listar_alunos(
    service: UsuarioService = Depends(get_usuario_service),
    current_user: Usuario = Depends(get_current_user)
):
    """Retorna a lista de todos os alunos cadastrados para tutoria e acompanhamento."""
    return service.listar_alunos()

# Rota que retorna a lista de todos os professores cadastrados
@router.get("/professores", response_model=List[usuario_schemas.ProfessorResumoPublico], status_code=status.HTTP_200_OK)
def listar_professores(
    service: UsuarioService = Depends(get_usuario_service),
    current_user: Usuario = Depends(get_current_user)
):
    """Retorna a lista de todos os professores cadastrados para seleção na coordenação."""
    return service.listar_professores()

# Rota pública de consulta de perfil.
@router.get("/{user_id}", response_model=usuario_schemas.UsuarioPublico)
def get_user(
    user_id: int, 
    service: UsuarioService = Depends(get_usuario_service)
):
    """Retorna dados públicos de um usuário específico."""
    return service.buscar_usuario(user_id)