import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any

from app.core.exceptions import ValidationAppError


class Grupo(StrEnum):
    """A dimensão do `GROUP BY` do painel. Ausente = agrega tudo."""

    MODELO = "modelo"
    ATOR = "ator"
    APLICACAO = "aplicacao"


class Intervalo(StrEnum):
    """O balde temporal. Ausente = sem série temporal, só o total do período."""

    DIA = "dia"
    SEMANA = "semana"
    MES = "mes"


@dataclass(frozen=True, slots=True)
class NovoRegistro:
    """Um evento reportado por uma aplicação.

    Note a ausência de `custo`: o evento **nunca** carrega dinheiro. O preço vive em
    `preco_modelo` com vigência e o custo sai na leitura — é o que faz um reajuste do provedor
    não reescrever o histórico."""

    aplicacao: str
    ator: str
    modelo: str
    provedor: str | None = None
    criado_em: datetime | None = None
    """`None` = o banco carimba `now()`. O app pode mandar a hora da chamada; `recebido_em` fica
    do lado para quando os dois discordarem (relógio torto)."""

    tokens_entrada: int = 0
    tokens_saida: int = 0
    tokens_cache_leitura: int = 0
    tokens_cache_escrita: int = 0
    id_externo: str | None = None
    metadados: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Pelo menos um balde precisa vir preenchido.

        Um evento com os quatro zerados não é uma chamada barata — é um bug de instrumentação do
        lado de quem reporta, e aceitá-lo silenciosamente infla o `COUNT(*)` de requisições com
        linhas que não custaram nada."""

        total = (
            self.tokens_entrada
            + self.tokens_saida
            + self.tokens_cache_leitura
            + self.tokens_cache_escrita
        )
        if total <= 0:
            raise ValidationAppError("Informe ao menos um campo de token maior que zero.")


@dataclass(frozen=True, slots=True)
class RegistroUso:
    """Uma linha de `registro_uso` já com o custo derivado."""

    id: uuid.UUID
    criado_em: datetime
    aplicacao: str
    ator: str
    modelo: str
    provedor: str | None
    tokens_entrada: int
    tokens_saida: int
    tokens_cache_leitura: int
    tokens_cache_escrita: int
    custo: Decimal | None
    """`None` quando o modelo não tem preço cadastrado. Não é `0`: "não sei quanto custou" e
    "custou nada" não podem virar o mesmo número."""

    moeda: str
    id_externo: str | None
    metadados: dict[str, Any]


@dataclass(frozen=True, slots=True)
class Ingestao:
    """O resultado de um `POST`. `duplicado` sai `True` quando o `id_externo` já existia — o
    retry do app não conta em dobro, e ele recebe o `id` da linha original."""

    id: uuid.UUID
    duplicado: bool


@dataclass(frozen=True, slots=True)
class Filtro:
    """Os filtros comuns à listagem e às métricas.

    `de`/`ate` são **datas**, não instantes: o painel filtra por dia, e os dois extremos entram
    inteiros no período. Quem impõe isso é o repositório."""

    de: date | None = None
    ate: date | None = None
    aplicacao: str | None = None
    ator: str | None = None
    modelo: str | None = None


@dataclass(frozen=True, slots=True)
class Balde:
    """Uma linha da resposta de `/v1/metricas`.

    `grupo` e `periodo` são `None` quando o parâmetro correspondente não foi passado — as quatro
    combinações de `grupo` × `intervalo` cobrem todos os gráficos do painel."""

    requisicoes: int
    tokens_entrada: int
    tokens_saida: int
    tokens_cache_leitura: int
    tokens_cache_escrita: int
    custo: Decimal | None
    moeda: str
    grupo: str | None = None
    periodo: date | None = None


@dataclass(frozen=True, slots=True)
class Pagina:
    itens: list[RegistroUso]
    total: int
    limite: int
    offset: int
