import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.precos.domain.entities import (
    CategoriaMensagem,
    NovoPreco,
    NovoPrecoMensagem,
)


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


class PrecoMensagemIn(BaseModel):
    categoria: str = Field(description="`marketing`, `utility` ou `authentication`.")
    """`str`, e não o `CategoriaMensagem` — de propósito.

    Com o enum, `service` levaria o `422` genérico do FastAPI, com uma lista de valores válidos e
    nenhuma explicação. Quem tenta cadastrar `service` está com uma pergunta na cabeça ("e as
    mensagens de serviço, como entram?"), e a resposta cabe na recusa: o domínio devolve `400`
    dizendo que isso é `cobravel = false` no evento."""

    pais: str = Field(min_length=2, description="ISO-3166 alfa-2 do destinatário: `BR`, `US`.")
    vigencia_inicio: date
    por_mensagem: Decimal = Field(ge=0)
    moeda: str = "USD"

    def para_dominio(self) -> NovoPrecoMensagem:
        return NovoPrecoMensagem(
            categoria=CategoriaMensagem.de(self.categoria),
            pais=self.pais,
            vigencia_inicio=self.vigencia_inicio,
            por_mensagem=self.por_mensagem,
            moeda=self.moeda,
        )


class PrecoMensagemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    categoria: CategoriaMensagem
    pais: str
    vigencia_inicio: date
    moeda: str
    por_mensagem: float
