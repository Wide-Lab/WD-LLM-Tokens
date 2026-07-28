import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.precos.domain.entities import NovoPreco


class PrecoIn(BaseModel):
    modelo: str = Field(min_length=1)
    vigencia_inicio: date
    entrada_por_milhao: Decimal = Field(ge=0)
    saida_por_milhao: Decimal = Field(ge=0)
    provedor: str | None = None
    moeda: str = "USD"
    cache_leitura_por_milhao: Decimal = Field(default=Decimal(0), ge=0)
    cache_escrita_por_milhao: Decimal = Field(default=Decimal(0), ge=0)

    def para_dominio(self) -> NovoPreco:
        return NovoPreco(
            modelo=self.modelo,
            vigencia_inicio=self.vigencia_inicio,
            entrada_por_milhao=self.entrada_por_milhao,
            saida_por_milhao=self.saida_por_milhao,
            provedor=self.provedor,
            moeda=self.moeda,
            cache_leitura_por_milhao=self.cache_leitura_por_milhao,
            cache_escrita_por_milhao=self.cache_escrita_por_milhao,
        )


class PrecoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provedor: str | None
    modelo: str
    vigencia_inicio: date
    moeda: str
    entrada_por_milhao: float
    saida_por_milhao: float
    cache_leitura_por_milhao: float
    cache_escrita_por_milhao: float
