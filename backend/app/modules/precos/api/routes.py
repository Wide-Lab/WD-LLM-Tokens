"""As rotas de preço.

**Não estão em `docs/api.md`**, e entram porque a tabela de preços é de onde sai todo o custo do
painel — sem uma porta para preenchê-la, `custo` seria `null` para sempre e o produto ficaria
pela metade.

Leitura usa a chave do painel; escrita usa a `CHAVE_ADMIN`, separada de propósito: a de leitura
mora no browser."""

from fastapi import APIRouter, Depends, status

from app.api.dependencies import requer_admin, requer_leitura
from app.db.session import SessionDep
from app.modules.precos.api.schemas import PrecoIn, PrecoOut
from app.modules.precos.application.services import PrecoService

router = APIRouter(prefix="/precos", tags=["precos"])


@router.get("", dependencies=[Depends(requer_leitura)])
async def listar_precos(session: SessionDep, modelo: str | None = None) -> list[PrecoOut]:
    precos = await PrecoService(session).listar(modelo)
    return [PrecoOut.model_validate(preco) for preco in precos]


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(requer_admin)])
async def criar_preco(payload: PrecoIn, session: SessionDep) -> PrecoOut:
    preco = await PrecoService(session).criar(payload.para_dominio())
    return PrecoOut.model_validate(preco)
