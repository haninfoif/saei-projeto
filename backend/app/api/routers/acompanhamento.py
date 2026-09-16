# Guichê de Acompanhamento Inclusivo e Tutoria. Permite que coordenadores assumam a tutoria de alunos e alimenta a tela de painel pessoal (/meus-vinculos).

from fastapi import APIRouter, Depends, status
from app.models import Usuario
from app.schemas.acompanhamento_schemas import TutorarAlunoIn, AcompanhamentoResponse
from app.api.dependencies import get_current_user, get_acompanhamento_service
from app.services.acompanhamento_service import AcompanhamentoService

router = APIRouter(prefix="/acompanhamento")

# O coordenador logado passa a matrícula do aluno e vira o tutor oficial do estudante.
@router.post("/definir-coordenador-tutor", status_code=status.HTTP_200_OK)
def definir_tutor(
    dados: TutorarAlunoIn,
    service: AcompanhamentoService = Depends(get_acompanhamento_service),
    current_user: Usuario = Depends(get_current_user)
):
    return service.vincular_tutor(dados, current_user)

# Remove o vínculo de tutoria do aluno pelo número de matrícula
@router.delete("/remover-tutor/{matricula}", status_code=status.HTTP_200_OK)
def remover_tutor(
    matricula: str,
    service: AcompanhamentoService = Depends(get_acompanhamento_service),
    current_user: Usuario = Depends(get_current_user)
):
    return service.remover_tutor(matricula, current_user)

# O sistema descobre pelo token quem é a pessoa: se for coordenador, entrega os tutorados; se for professor, entrega os alunos das suas disciplinas; se for aluno, nega com erro 403.
@router.get("/meus-vinculos", response_model=AcompanhamentoResponse)
def listar_vinculos(
    service: AcompanhamentoService = Depends(get_acompanhamento_service),
    current_user: Usuario = Depends(get_current_user)
):
    return service.listar_sob_responsabilidade(current_user)