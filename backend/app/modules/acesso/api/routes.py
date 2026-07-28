"""Login, logout, cadastro de usuário e emissão de chave de API.

O cookie é `HttpOnly` + `SameSite=Lax`: o painel nunca lê o token em JavaScript, e nenhum site de
terceiros consegue disparar uma requisição autenticada por ele. Não há CSRF token porque não há
o que proteger — tudo que escreve neste serviço (`POST /v1/llm/eventos`, `POST /v1/precos`,
`POST /v1/usuarios`) exige `X-API-Key`, que o cookie não substitui."""

import uuid

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.dependencies import UsuarioDep, requer_admin
from app.core.config import get_config
from app.db.session import SessionDep
from app.modules.acesso.api.schemas import (
    ChaveCriadaOut,
    ChaveIn,
    ChaveOut,
    LoginIn,
    UsuarioIn,
    UsuarioOut,
)
from app.modules.acesso.application.services import AcessoService, ChaveApiService
from app.modules.acesso.infra import sessao

router = APIRouter(tags=["acesso"])


def _origem(request: Request) -> str:
    """O IP de quem chamou, para a chave do freio de força bruta.

    Pega o **último** item do `X-Forwarded-For`, não o primeiro: o nginx da borda usa
    `$proxy_add_x_forwarded_for`, que *acrescenta* o IP real ao que o cliente mandou. O começo da
    lista é texto do atacante — se a chave saísse dali, bastaria variar o header para zerar a
    contagem a cada tentativa."""

    encaminhado = request.headers.get("X-Forwarded-For")
    if encaminhado:
        return encaminhado.split(",")[-1].strip()

    return request.client.host if request.client else "desconhecido"


@router.post("/sessao")
async def entrar(
    payload: LoginIn,
    request: Request,
    response: Response,
    session: SessionDep,
) -> UsuarioOut:
    usuario = await AcessoService(session).autenticar(
        str(payload.email), payload.senha, _origem(request)
    )

    config = get_config()
    response.set_cookie(
        sessao.COOKIE,
        sessao.assinar(usuario.id),
        max_age=config.SESSAO_DURACAO_HORAS * 3600,
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SEGURO,
        path="/",
    )
    return UsuarioOut.model_validate(usuario)


@router.get("/sessao")
async def sessao_atual(usuario: UsuarioDep) -> UsuarioOut:
    """Quem sou eu. É por aqui que o painel decide entre mostrar o dashboard ou a tela de login —
    daí o `401` deste endpoint ser resposta esperada, e não erro."""

    return UsuarioOut.model_validate(usuario)


@router.delete("/sessao", status_code=status.HTTP_204_NO_CONTENT)
async def sair(response: Response) -> None:
    """Sem sessão em tabela, sair é apagar o cookie. O token continuaria válido até vencer se
    alguém o tivesse copiado antes — para derrubar todo mundo de uma vez, troque
    `SEGREDO_SESSAO`; para derrubar um, `usuario.ativo = false`."""

    response.delete_cookie(sessao.COOKIE, path="/")


@router.get("/usuarios", dependencies=[Depends(requer_admin)])
async def listar_usuarios(session: SessionDep) -> list[UsuarioOut]:
    usuarios = await AcessoService(session).listar()
    return [UsuarioOut.model_validate(usuario) for usuario in usuarios]


@router.post(
    "/usuarios",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requer_admin)],
)
async def criar_usuario(payload: UsuarioIn, session: SessionDep) -> UsuarioOut:
    """Cadastro pela `CHAVE_ADMIN`, não por tela.

    É assim que nasce o primeiro usuário — sem o problema do ovo e da galinha de uma tela de
    cadastro aberta, e sem seed mágico no boot. Com um punhado de pessoas no painel, um `curl`
    por pessoa é mais barato que uma tela de gestão de usuários."""

    usuario = await AcessoService(session).criar(payload.para_dominio())
    return UsuarioOut.model_validate(usuario)


@router.get("/chaves", dependencies=[Depends(requer_admin)])
async def listar_chaves(session: SessionDep) -> list[ChaveOut]:
    """As chaves emitidas — sem o segredo de nenhuma, que não existe mais em lugar nenhum.

    Não lista as de variável de ambiente: elas continuam valendo (ver `api/dependencies.py`),
    mas quem as conhece é o `.env` do servidor, não esta tabela."""

    chaves = await ChaveApiService(session).listar()
    return [ChaveOut.model_validate(chave) for chave in chaves]


@router.post("/chaves", status_code=status.HTTP_201_CREATED, dependencies=[Depends(requer_admin)])
async def criar_chave(payload: ChaveIn, session: SessionDep) -> ChaveCriadaOut:
    """Emite uma chave. **A resposta é a única vez que o segredo aparece** — o banco guarda só o
    hash, então não há como mostrá-lo de novo.

    Pela `CHAVE_ADMIN`, como o cadastro de usuário e de preço: quem opera o serviço distribui
    credencial, e a chave que faz isso é a única que não nasce aqui."""

    criada = await ChaveApiService(session).criar(payload.para_dominio())
    return ChaveCriadaOut.de(criada)


@router.delete("/chaves/{chave_id}", dependencies=[Depends(requer_admin)])
async def revogar_chave(chave_id: uuid.UUID, session: SessionDep) -> ChaveOut:
    """Desliga a chave na hora — a próxima requisição com ela leva `401`.

    `DELETE` no verbo, carimbo em `revogada_em` no banco: a linha fica, com o nome e a data, para
    a pergunta que sempre vem depois ("quem tinha essa chave que vazou?")."""

    chave = await ChaveApiService(session).revogar(chave_id)
    return ChaveOut.model_validate(chave)
