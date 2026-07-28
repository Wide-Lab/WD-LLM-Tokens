import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True, slots=True)
class PrecoModelo:
    """O preço de um modelo a partir de uma data.

    Preço tem vigência para que um reajuste do provedor não reescreva o custo histórico: o evento
    de março continua valendo o preço de março depois que o de abril entra."""

    id: uuid.UUID
    provedor: str | None
    modelo: str
    vigencia_inicio: date
    moeda: str
    entrada_por_milhao: Decimal
    saida_por_milhao: Decimal
    cache_leitura_por_milhao: Decimal
    cache_escrita_por_milhao: Decimal


@dataclass(frozen=True, slots=True)
class NovoPreco:
    modelo: str
    vigencia_inicio: date
    entrada_por_milhao: Decimal
    saida_por_milhao: Decimal
    provedor: str | None = None
    moeda: str = "USD"
    cache_leitura_por_milhao: Decimal = Decimal(0)
    cache_escrita_por_milhao: Decimal = Decimal(0)
