"""Quem pode o quê.

Duas formas de se identificar convivem aqui, e não por acaso:

- **`X-API-Key`** — máquina falando com máquina: escrita (uma chave por aplicação), leitura
  (integração) e admin. As chaves vivem em variável de ambiente (`docs/api.md`): com uma
  aplicação nova por semestre, uma tabela de chaves seria cerimônia.
- **Cookie de sessão** — gente no painel. É o caminho do frontend, e existe porque o painel está
  exposto na internet: antes, a chave de leitura morava no `localStorage` do browser e era, na
  prática, a única tranca da porta.

`requer_leitura` aceita os dois. Escrita e admin, só chave — não há tela para eles."""

import hmac
import uuid
from typing import Annotated

from fastapi import Cookie, Depends, Header

from app.core.config import get_config
from app.core.exceptions import UnauthorizedError
from app.db.session import SessionDep
from app.modules.acesso.application.services import AcessoService
from app.modules.acesso.domain.entities import Usuario
from app.modules.acesso.infra import sessao

ChaveHeader = Annotated[str | None, Header(alias="X-API-Key")]
CookieSessao = Annotated[str | None, Cookie(alias=sessao.COOKIE)]


def _confere(recebida: str, esperada: str) -> bool:
    """Comparação em tempo constante. `hmac.compare_digest` e não `==` porque `==` de string
    sai no primeiro byte diferente, e isso vaza o prefixo correto para quem cronometrar."""

    return bool(esperada) and hmac.compare_digest(recebida, esperada)


async def aplicacao_autenticada(x_api_key: ChaveHeader = None) -> str:
    """A aplicação dona da chave de escrita. É ela que o `POST /v1/eventos` cobra do payload."""

    if x_api_key:
        for aplicacao, chave in get_config().CHAVES_ESCRITA.items():
            if _confere(x_api_key, chave):
                return aplicacao

    raise UnauthorizedError()


async def usuario_da_sessao(
    session: SessionDep,
    sessao_cookie: CookieSessao = None,
) -> Usuario | None:
    """O dono do cookie, ou `None` — cookie ausente, forjado, vencido ou de usuário desativado.

    A ida ao banco a cada request é de propósito: é ela que faz `ativo = false` valer na hora, sem
    esperar o cookie vencer. Com o volume deste serviço, um `SELECT` por id não pesa."""

    if not sessao_cookie:
        return None

    usuario_id: uuid.UUID | None = sessao.ler(sessao_cookie)
    if usuario_id is None:
        return None

    return await AcessoService(session).por_id(usuario_id)


async def requer_sessao(usuario: Annotated[Usuario | None, Depends(usuario_da_sessao)]) -> Usuario:
    if usuario is None:
        raise UnauthorizedError("Sessão ausente ou expirada.")

    return usuario


async def requer_leitura(
    usuario: Annotated[Usuario | None, Depends(usuario_da_sessao)],
    x_api_key: ChaveHeader = None,
) -> None:
    """Sessão do painel **ou** chave de leitura."""

    if usuario is not None:
        return

    if not x_api_key or not _confere(x_api_key, get_config().CHAVE_LEITURA):
        raise UnauthorizedError()


async def requer_admin(x_api_key: ChaveHeader = None) -> None:
    if not x_api_key or not _confere(x_api_key, get_config().CHAVE_ADMIN):
        raise UnauthorizedError()


AplicacaoDep = Annotated[str, Depends(aplicacao_autenticada)]
"""A aplicação dona da chave de escrita. `requer_leitura` e `requer_admin` não devolvem nada de
útil, então entram como `dependencies=[Depends(...)]` na rota, e não como parâmetro."""

UsuarioDep = Annotated[Usuario, Depends(requer_sessao)]
"""O usuário logado, para as rotas que precisam dizer quem é."""
