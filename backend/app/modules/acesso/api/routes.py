"""Login, logout e cadastro de usuário.

O cookie é `HttpOnly` + `SameSite=Lax`: o painel nunca lê o token em JavaScript, e nenhum site de
terceiros consegue disparar uma requisição autenticada por ele. Não há CSRF token porque não há
o que proteger — tudo que escreve neste serviço (`POST /v1/eventos`, `POST /v1/precos`,
`POST /v1/usuarios`) exige `X-API-Key`, que o cookie não substitui."""

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.dependencies import UsuarioDep, requer_admin
from app.core.config import get_config
from app.db.session import SessionDep
from app.modules.acesso.api.schemas import LoginIn, UsuarioIn, UsuarioOut
from app.modules.acesso.application.services import AcessoService
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
