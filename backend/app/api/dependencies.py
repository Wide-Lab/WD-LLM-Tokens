"""Quem pode o quê.

Duas formas de se identificar convivem aqui, e não por acaso:

- **`X-API-Key`** — máquina falando com máquina: escrita (uma chave por aplicação), leitura
  (integração) e admin.
- **Cookie de sessão** — gente no painel. É o caminho do frontend, e existe porque o painel está
  exposto na internet: antes, a chave de leitura morava no `localStorage` do browser e era, na
  prática, a única tranca da porta.

`requer_leitura` aceita os dois. Escrita e admin, só chave — não há tela para eles.

**Duas fontes de chave, nesta ordem: ambiente e depois banco.** As de ambiente vieram primeiro,
quando uma tabela de chaves seria cerimônia para uma aplicação nova por semestre; hoje existe
`POST /v1/chaves` e elas nascem no banco, com nome, data e revogação. As duas valem ao mesmo
tempo de propósito — é o que deixa a migração acontecer sem virada de chave e sem app parado.
Esvaziar `CHAVES_ESCRITA` e `CHAVE_LEITURA` no `.env` é o último passo, não o primeiro.

A ordem também é o barato antes do caro: comparar com o que está em memória não custa ida ao
banco, e só quem não bate ali paga o `SELECT`."""

import hmac
import uuid
from typing import Annotated

from fastapi import Cookie, Depends, Header

from app.core.config import get_config
from app.core.exceptions import UnauthorizedError
from app.db.session import SessionDep
from app.modules.acesso.application.services import AcessoService, ChaveApiService
from app.modules.acesso.domain.entities import EscopoChave, Usuario
from app.modules.acesso.infra import sessao

ChaveHeader = Annotated[str | None, Header(alias="X-API-Key")]
CookieSessao = Annotated[str | None, Cookie(alias=sessao.COOKIE)]


def _confere(recebida: str, esperada: str) -> bool:
    """Comparação em tempo constante. `hmac.compare_digest` e não `==` porque `==` de string
    sai no primeiro byte diferente, e isso vaza o prefixo correto para quem cronometrar."""

    return bool(esperada) and hmac.compare_digest(recebida, esperada)


async def aplicacao_autenticada(session: SessionDep, x_api_key: ChaveHeader = None) -> str:
    """A aplicação dona da chave de escrita. É ela que o `POST /v1/llm/eventos` cobra do payload."""

    if x_api_key:
        for aplicacao, chave in get_config().CHAVES_ESCRITA.items():
            if _confere(x_api_key, chave):
                return aplicacao

        emitida = await ChaveApiService(session).autenticar(x_api_key, EscopoChave.ESCRITA)
        if emitida is not None and emitida.aplicacao:
            return emitida.aplicacao

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
    session: SessionDep,
    usuario: Annotated[Usuario | None, Depends(usuario_da_sessao)],
    x_api_key: ChaveHeader = None,
) -> None:
    """Sessão do painel **ou** chave de leitura.

    Chave de escrita não abre os `GET`: quem reporta evento não precisa enxergar o custo de todo
    mundo, e a chave dela mora espalhada nos apps."""

    if usuario is not None:
        return

    if not x_api_key:
        raise UnauthorizedError()

    if _confere(x_api_key, get_config().CHAVE_LEITURA):
        return

    if await ChaveApiService(session).autenticar(x_api_key, EscopoChave.LEITURA) is None:
        raise UnauthorizedError()


async def requer_admin(x_api_key: ChaveHeader = None) -> None:
    """Só `CHAVE_ADMIN`, e só do ambiente.

    Esta é a chave que emite e revoga as outras, e é por isso que ela não segue as demais para o
    banco: uma admin criável em `POST /v1/chaves` poderia cunhar substitutas para si mesma, e
    quem roubasse uma teria como continuar entrando depois de revogada. Fora do banco que ela
    administra, o jeito de trocá-la é ter acesso ao servidor."""

    if not x_api_key or not _confere(x_api_key, get_config().CHAVE_ADMIN):
        raise UnauthorizedError()


AplicacaoDep = Annotated[str, Depends(aplicacao_autenticada)]
"""A aplicação dona da chave de escrita. `requer_leitura` e `requer_admin` não devolvem nada de
útil, então entram como `dependencies=[Depends(...)]` na rota, e não como parâmetro."""

UsuarioDep = Annotated[Usuario, Depends(requer_sessao)]
"""O usuário logado, para as rotas que precisam dizer quem é."""
