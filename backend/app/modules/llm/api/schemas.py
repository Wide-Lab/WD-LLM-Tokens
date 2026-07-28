import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_serializer

from app.modules.llm.domain.entities import NovoRegistro


class EventoIn(BaseModel):
    """O que uma aplicação de IA reporta depois de uma chamada ao LLM.

    Sem `custo`: o evento não carrega dinheiro. E os quatro baldes de token são
    **não-sobrepostos** — quem reporta normaliza antes (ver `docs/modelo-de-dados.md`)."""

    aplicacao: str = Field(min_length=1)
    ator: str = Field(min_length=1)
    modelo: str = Field(min_length=1)
    provedor: str | None = None
    criado_em: datetime | None = None
    tokens_entrada: int = Field(default=0, ge=0)
    tokens_saida: int = Field(default=0, ge=0)
    tokens_cache_leitura: int = Field(default=0, ge=0)
    tokens_cache_escrita: int = Field(default=0, ge=0)
    id_externo: str | None = None
    mensagem: str | None = None
    """O que o ator mandou nesta chamada."""

    resposta: str | None = None
    """O que o agente devolveu."""

    metadados: dict[str, Any] = Field(default_factory=dict)

    def para_dominio(self) -> NovoRegistro:
        return NovoRegistro(
            aplicacao=self.aplicacao,
            ator=self.ator,
            modelo=self.modelo,
            provedor=self.provedor,
            criado_em=self.criado_em,
            tokens_entrada=self.tokens_entrada,
            tokens_saida=self.tokens_saida,
            tokens_cache_leitura=self.tokens_cache_leitura,
            tokens_cache_escrita=self.tokens_cache_escrita,
            id_externo=self.id_externo,
            mensagem=self.mensagem,
            resposta=self.resposta,
            metadados=self.metadados,
        )


class IngestaoOut(BaseModel):
    id: uuid.UUID
    duplicado: bool


class MetricaOut(BaseModel):
    """Um balde da resposta de `/v1/llm/metricas`."""

    grupo: str | None = None
    periodo: date | None = None
    requisicoes: int
    tokens_entrada: int
    tokens_saida: int
    tokens_cache_leitura: int
    tokens_cache_escrita: int
    custo: float | None
    moeda: str

    @model_serializer
    def _serializar(self) -> dict[str, Any]:
        """`grupo` e `periodo` são **omitidos** quando o parâmetro não foi passado, e não
        emitidos como `null`.

        Um `exclude_none` genérico não serve: `custo: null` é informação (modelo sem preço
        cadastrado) e precisa continuar aparecendo."""

        saida: dict[str, Any] = {}
        if self.grupo is not None:
            saida["grupo"] = self.grupo
        if self.periodo is not None:
            saida["periodo"] = self.periodo.isoformat()

        saida.update(
            requisicoes=self.requisicoes,
            tokens_entrada=self.tokens_entrada,
            tokens_saida=self.tokens_saida,
            tokens_cache_leitura=self.tokens_cache_leitura,
            tokens_cache_escrita=self.tokens_cache_escrita,
            custo=self.custo,
            moeda=self.moeda,
        )
        return saida


class EventoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    custo: float | None
    moeda: str
    id_externo: str | None
    mensagem: str | None
    resposta: str | None
    metadados: dict[str, Any]


class EventosOut(BaseModel):
    total: int
    limite: int
    offset: int
    itens: list[EventoOut]
