import uuid
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Usuario:
    """Quem entra no painel.

    Sem o hash da senha de propósito: ele nasce e morre no `infra`. O que circula pela aplicação
    é a identidade — se o hash viajasse junto, uma serialização distraída o colocaria numa
    resposta."""

    id: uuid.UUID
    email: str
    nome: str
    ativo: bool
    criado_em: datetime


@dataclass(frozen=True)
class NovoUsuario:
    email: str
    nome: str
    senha: str


def normalizar_email(email: str) -> str:
    """E-mail não distingue caixa; o `UNIQUE` do Postgres distingue. Passa por aqui tudo o que
    for gravado **e** tudo o que for consultado, senão quem cadastrou `Ana@x.com` não consegue
    entrar digitando `ana@x.com`."""

    return email.strip().lower()
