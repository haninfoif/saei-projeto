# Define os dados aceitos para cadastrar novos usuários e filtra quais dados podem ser visualizados por terceiros ou pelo próprio dono da conta.

from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models import UserRole

# Mostra apenas dados que qualquer pessoa pode ver
class UsuarioPublico(BaseModel):
    id: int
    nome: str
    imagem_arquivo: str | None = None
    imagem_caminho: str | None = None
    role: UserRole

    # Permite carregar dados a partir de atributos de objetos do SQLAlchemy
    class Config:
        from_attributes = True

# O dono da conta vê tudo o que é público, mais o seu próprio e-mail e a sua matrícula (caso seja aluno)
class UsuarioPrivado(UsuarioPublico):
    email: EmailStr
    matricula: Optional[str] = None 

# formulário de cadastro do aluno
class AlunoCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    matricula: str

# Schema resumo do aluno para tutoria e matrículas
class AlunoResumoPublico(BaseModel):
    nome: str
    email: EmailStr
    matricula: str

    class Config:
        from_attributes = True

# formulário de cadastro de funcionário (professor ou coordenador)
class FuncionarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str

# Mostra dados dos professores
class ProfessorResumoPublico(BaseModel):
    nome: str
    email: EmailStr

    class Config:
        from_attributes = True