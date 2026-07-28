import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from app.core.exceptions import ValidationAppError


class Direcao(StrEnum):
    """De quem é a fala. É esta coluna que faz `conteudo` ser um campo só."""

    ENVIADA = "enviada"
    RECEBIDA = "recebida"


class Categoria(StrEnum):
    """As categorias que se pode **reportar**.

    Tem `service`, ao contrário do `CategoriaMensagem` de `precos`, que só lista as três
    cobráveis. As duas listas são propositalmente diferentes e propositalmente não são um import:
    lá a lista restringe o que se pode **cobrar**, aqui o que se pode **registrar** — e mensagem
    de serviço acontece, ela só não é cobrada."""

    MARKETING = "marketing"
    UTILITY = "utility"
    AUTHENTICATION = "authentication"
    SERVICE = "service"


class Grupo(StrEnum):
    """A dimensão do `GROUP BY` do painel. Ausente = agrega tudo.

    São cinco, e não as três do LLM: `categoria`, `pais` e `direcao` são o que este módulo tem de
    próprio, e é por isso que os dois `Grupo` não viraram um só."""

    CATEGORIA = "categoria"
    ATOR = "ator"
    APLICACAO = "aplicacao"
    PAIS = "pais"
    DIRECAO = "direcao"


SEM_CATEGORIA = "sem categoria"
"""O rótulo do balde de `grupo=categoria` para as linhas sem categoria — as recebidas.

Existe para que `grupo` ausente na resposta signifique uma coisa só ("não foi pedido
agrupamento"). Sem ele, o balde das recebidas sairia com `grupo: null`, indistinguível de um
total geral no meio de uma lista de totais por categoria."""


@dataclass(frozen=True, slots=True)
class NovaMensagem:
    """Uma mensagem reportada por uma aplicação.

    Como no LLM, sem `custo`: o evento não carrega dinheiro. Diferente do LLM, carrega `cobravel`
    e `categoria` — que **também** não são regra nossa, e sim o que a Meta respondeu no objeto
    `pricing` do webhook de status."""

    aplicacao: str
    ator: str
    """O `wa_id` do cliente, E.164 só dígitos — **o mesmo texto do `ator` do LLM**. Não há
    constraint que garanta isso: é convenção de quem reporta, e é o único acoplamento entre os
    dois módulos (ver `docs/api.md`)."""

    direcao: Direcao
    pais: str
    categoria: Categoria | None = None
    """`null` nas recebidas: a Meta categoriza o que sai, não o que entra."""

    cobravel: bool = False
    """Copiado de `pricing.billable`. **Não** é decidido aqui."""

    criado_em: datetime | None = None
    """`None` = o banco carimba `now()`. É a hora da mensagem, e é ela que escolhe a tarifa
    vigente."""

    id_externo: str | None = None
    """O `wamid`. Chave natural perfeita: o webhook manda `sent`, `delivered` e `read` para o
    mesmo id, e quem reporta pode mandar os três sem pensar."""

    conteudo: str | None = None
    """O texto da mensagem — **um** campo, não `mensagem` + `resposta`. No LLM uma linha é uma
    troca; aqui é uma fala, e `direcao` diz de quem."""

    metadados: dict[str, Any] = field(default_factory=dict)
    """O objeto `pricing` cru, o id da conversa, o nome do template."""

    def __post_init__(self) -> None:
        """Só o que é **impossível**, nunca o que é regra de cobrança da Meta.

        Nada de recusar `service` cobrável, nada de inferir janela de atendimento: se a Meta
        mandar `billable: true` numa combinação que hoje parece grátis, quem está errado é a nossa
        suposição, e o evento tem de entrar do jeito que ela mandou.

        As duas regras daqui são de outra natureza — a primeira porque a Meta não cobra entrada em
        hipótese nenhuma, a segunda porque sem categoria não há linha de preço para casar, e a
        mensagem entraria cobrável com custo `null` para sempre."""

        if self.direcao is Direcao.RECEBIDA and self.cobravel:
            raise ValidationAppError(
                "Mensagem recebida não é cobrada: `cobravel` tem de ser falso."
            )

        if self.cobravel and self.categoria is None:
            raise ValidationAppError(
                "Mensagem cobrável precisa de `categoria`: é ela que casa com a linha de preço."
            )

        # O preço casa com a mensagem por igualdade de texto no `pais`, e `NovoPrecoMensagem` já
        # sobe o dele para maiúsculas. Receber `br` aqui não daria erro nenhum — daria custo
        # `null` para sempre, num país que alguém jura ter cadastrado.
        object.__setattr__(self, "pais", self.pais.strip().upper())


@dataclass(frozen=True, slots=True)
class RegistroMensagem:
    """Uma linha de `registro_mensagem` já com o custo derivado."""

    id: uuid.UUID
    criado_em: datetime
    aplicacao: str
    ator: str
    direcao: Direcao
    categoria: Categoria | None
    pais: str
    cobravel: bool
    custo: Decimal | None
    """`0` quando não é cobrável, a tarifa quando é, e `None` quando é cobrável e não há preço
    cadastrado para `(categoria, pais, data)`. As três precisam ser distinguíveis."""

    moeda: str
    id_externo: str | None
    conteudo: str | None
    metadados: dict[str, Any]


@dataclass(frozen=True, slots=True)
class Ingestao:
    """O resultado de um `POST`. `duplicado` sai `True` quando o `wamid` já estava lá — é o que
    deixa quem reporta mandar `sent`, `delivered` e `read` sem contar a mensagem três vezes."""

    id: uuid.UUID
    duplicado: bool


@dataclass(frozen=True, slots=True)
class Filtro:
    """Os filtros comuns à listagem e às métricas.

    Não subiu para o `core` junto com `Intervalo`: os campos daqui são os deste módulo. `de`/`ate`
    são planos e viram `WHERE` em `app.core.periodo.janela`, que é a parte que os dois módulos
    precisam acertar igual."""

    de: date | None = None
    ate: date | None = None
    aplicacao: str | None = None
    ator: str | None = None
    categoria: Categoria | None = None
    pais: str | None = None
    direcao: Direcao | None = None


@dataclass(frozen=True, slots=True)
class Balde:
    """Uma linha da resposta de `/v1/whatsapp/metricas`."""

    mensagens: int
    cobraveis: int
    """Quantas das `mensagens` foram pagas. É `count(*) filter (where cobravel)` e existe para
    responder isso sem uma segunda consulta — a diferença entre as duas é a conta que o painel
    de WhatsApp mais mostra."""

    custo: Decimal | None
    moeda: str
    grupo: str | None = None
    periodo: date | None = None


@dataclass(frozen=True, slots=True)
class Pagina:
    itens: list[RegistroMensagem]
    total: int
    limite: int
    offset: int
