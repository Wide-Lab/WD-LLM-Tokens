import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.core.exceptions import ValidationAppError


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


class EscopoChave(StrEnum):
    """O que a chave abre. São os mesmos dois papéis que já existiam em variável de ambiente.

    Não há `admin` aqui de propósito: a chave de admin é a que cria e revoga as outras, e uma
    admin que nasce no banco pode cunhar substitutas para si mesma — quem roubasse uma teria como
    se manter dentro mesmo depois de revogada. Ela fica em `CHAVE_ADMIN`, fora do banco que
    administra."""

    ESCRITA = "escrita"
    LEITURA = "leitura"


@dataclass(frozen=True)
class NovaChave:
    """O pedido de emissão. O segredo não entra aqui: quem o sorteia é o `infra`."""

    nome: str
    escopo: EscopoChave
    aplicacao: str | None = None

    def __post_init__(self) -> None:
        """`aplicacao` e escopo andam juntos.

        A chave de escrita **é** a identidade de quem reporta — é dela que sai a `aplicacao` que
        o `POST /v1/llm/eventos` cobra do payload. Sem aplicação ela não teria como recusar um
        evento no nome de outro app; com aplicação, uma chave de leitura sugeriria um recorte de
        dados que ela não tem (os `GET` enxergam tudo)."""

        if self.escopo is EscopoChave.ESCRITA and not (self.aplicacao or "").strip():
            raise ValidationAppError("Chave de escrita precisa da aplicação dona dela.")

        if self.escopo is EscopoChave.LEITURA and self.aplicacao:
            raise ValidationAppError("Chave de leitura não é de uma aplicação: os GET veem tudo.")


@dataclass(frozen=True)
class ChaveApi:
    """Uma chave emitida, do jeito que dá para falar dela depois.

    Sem o segredo: ele existe uma vez só, na resposta da emissão (`ChaveCriada`). O que sobra na
    tabela é a impressão — e o `prefixo`, que serve só para a pessoa reconhecer qual é qual."""

    id: uuid.UUID
    nome: str
    escopo: EscopoChave
    aplicacao: str | None
    prefixo: str
    criada_em: datetime
    ultimo_uso_em: datetime | None
    revogada_em: datetime | None

    @property
    def ativa(self) -> bool:
        return self.revogada_em is None


@dataclass(frozen=True)
class ChaveCriada:
    """A emissão: a chave e o segredo em texto puro, na única vez em que ele existe.

    Depois daqui só resta o hash — reemitir é a única saída para quem perdeu, e é assim de
    propósito: uma chave que o servidor consegue mostrar de novo é uma chave que ele guarda."""

    chave: ChaveApi
    segredo: str


def normalizar_email(email: str) -> str:
    """E-mail não distingue caixa; o `UNIQUE` do Postgres distingue. Passa por aqui tudo o que
    for gravado **e** tudo o que for consultado, senão quem cadastrou `Ana@x.com` não consegue
    entrar digitando `ana@x.com`."""

    return email.strip().lower()
