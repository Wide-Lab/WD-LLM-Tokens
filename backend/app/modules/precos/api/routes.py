"""As rotas de preço.

A tabela de preços é de onde sai todo o custo do painel — sem uma porta para preenchê-la, `custo`
seria `null` para sempre e o produto ficaria pela metade.

Leitura e escrita aceitam a sessão do painel (`requer_gestao_de_precos` explica por que a escrita
abriu para o cookie), e a escrita aceita também a `CHAVE_ADMIN`, que é o caminho de quem
automatiza o cadastro por fora."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import requer_gestao_de_precos, requer_leitura
from app.db.uow import UowDep
from app.modules.precos.api.schemas import (
    PrecoIn,
    PrecoMensagemIn,
    PrecoMensagemOut,
    PrecoOut,
)
from app.modules.precos.application.services import PrecoMensagemService, PrecoService

router = APIRouter(prefix="/precos", tags=["precos"])


@router.get("", dependencies=[Depends(requer_leitura)])
async def listar_precos(uow: UowDep, modelo: str | None = None) -> list[PrecoOut]:
    precos = await PrecoService(uow).listar(modelo)
    return [PrecoOut.model_validate(preco) for preco in precos]


@router.post(
    "", status_code=status.HTTP_201_CREATED, dependencies=[Depends(requer_gestao_de_precos)]
)
async def criar_preco(payload: PrecoIn, uow: UowDep) -> PrecoOut:
    preco = await PrecoService(uow).criar(payload.para_dominio())
    return PrecoOut.model_validate(preco)


# `/precos` continua sendo o de modelo, sem alias e sem renomeação: são rotas de administração
# usadas por `curl`, o `backend/README.md` as documenta, e mexer nelas seria churn sem consumidor.


@router.get("/mensagem", dependencies=[Depends(requer_leitura)])
async def listar_precos_de_mensagem(
    uow: UowDep, categoria: str | None = None, pais: str | None = None
) -> list[PrecoMensagemOut]:
    precos = await PrecoMensagemService(uow).listar(categoria, pais)
    return [PrecoMensagemOut.model_validate(preco) for preco in precos]


@router.post(
    "/mensagem",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requer_gestao_de_precos)],
)
async def criar_preco_de_mensagem(payload: PrecoMensagemIn, uow: UowDep) -> PrecoMensagemOut:
    preco = await PrecoMensagemService(uow).criar(payload.para_dominio())
    return PrecoMensagemOut.model_validate(preco)
