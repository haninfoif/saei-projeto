# Isola todas as consultas e alterações que ocorrem especificamente na tabela alunos

from sqlalchemy.orm import Session
from app.models import Aluno, Usuario

class AlunoRepository:
    def __init__(self, db: Session):
        self.db = db

    # Busca o perfil de aluno associado a determinado usuario_id
    def buscar_por_usuario_id(self, usuario_id: int) -> Aluno | None:
        return self.db.query(Aluno).filter(Aluno.usuario_id == usuario_id).first()

    # Localiza o estudante pelo número de matrícula
    def buscar_por_matricula(self, matricula: str) -> Aluno:
        return self.db.query(Aluno).filter(Aluno.matricula == matricula).first()

    # Atualiza o tutor do estudante
    def atualizar_tutor(self, aluno: Aluno, tutor_id: int):
        aluno.tutor_id = tutor_id
        self.db.commit()
        self.db.refresh(aluno)

    # Lista todos os alunos
    def listar_todos(self) -> list[Aluno]:
        return (
            self.db.query(Aluno)
            .join(Usuario, Aluno.usuario_id == Usuario.id)
            .all()
        )

    # Lista todos os alunos pelo ID do tutor
    def listar_por_tutor(self, coordenador_id: int) -> list[Aluno]:
        return self.db.query(Aluno).filter(Aluno.tutor_id == coordenador_id).all()