import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_serializer

from app.modules.whatsapp.domain.entities import Categoria, Direcao, NovaMensagem


class MensagemIn(BaseModel):
    """Uma mensagem de WhatsApp, reportada por quem opera o número.

    **Quem reporta ingere no status que traz o `pricing`** (o `sent`): é ele que diz se a mensagem
    é cobrável e em que categoria. O mapeamento webhook → este contrato é responsabilidade de quem
    reporta, e o objeto `pricing` cru vai inteiro em `metadados` para que qualquer conferência
    futura seja uma consulta.

    Mensagem que falhou (`failed`) não deve ser reportada: a Meta não cobra, e a tabela é
    append-only."""

    aplicacao: str = Field(min_length=1)
    ator: str = Field(min_length=1, description="O `wa_id` do cliente, E.164 só dígitos.")
    direcao: Direcao
    pais: str = Field(min_length=2, description="ISO-3166 alfa-2 do destinatário: `BR`, `US`.")
    categoria: Categoria | None = None
    cobravel: bool = False
    """De `pricing.billable`, como veio da Meta — inclusive quando contraria o que a gente acha
    que ela cobra."""

    criado_em: datetime | None = None
    id_externo: str | None = Field(
        default=None, description="O `wamid`. É a chave da idempotência."
    )
    conteudo: str | None = None
    metadados: dict[str, Any] = Field(default_factory=dict)

    def para_dominio(self) -> NovaMensagem:
        return NovaMensagem(
            aplicacao=self.aplicacao,
            ator=self.ator,
            direcao=self.direcao,
            pais=self.pais,
            categoria=self.categoria,
            cobravel=self.cobravel,
            criado_em=self.criado_em,
            id_externo=self.id_externo,
            conteudo=self.conteudo,
            metadados=self.metadados,
        )


class IngestaoOut(BaseModel):
    id: uuid.UUID
    duplicado: bool


class MetricaOut(BaseModel):
    """Um balde da resposta de `/v1/whatsapp/metricas`."""

    grupo: str | None = None
    periodo: date | None = None
    mensagens: int
    cobraveis: int
    custo: float | None
    moeda: str

    @model_serializer
    def _serializar(self) -> dict[str, Any]:
        """`grupo` e `periodo` são **omitidos** quando o parâmetro não foi passado, e não emitidos
        como `null` — o mesmo do `MetricaOut` do LLM e pelo mesmo motivo: um `exclude_none`
        genérico comeria junto o `custo: null`, que é informação (cobrável sem preço cadastrado)."""

        saida: dict[str, Any] = {}
        if self.grupo is not None:
            saida["grupo"] = self.grupo
        if self.periodo is not None:
            saida["periodo"] = self.periodo.isoformat()

        saida.update(
            mensagens=self.mensagens,
            cobraveis=self.cobraveis,
            custo=self.custo,
            moeda=self.moeda,
        )
        return saida


class MensagemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    criado_em: datetime
    aplicacao: str
    ator: str
    direcao: Direcao
    categoria: Categoria | None
    pais: str
    cobravel: bool
    custo: float | None
    moeda: str
    id_externo: str | None
    conteudo: str | None
    metadados: dict[str, Any]


class MensagensOut(BaseModel):
    total: int
    limite: int
    offset: int
    itens: list[MensagemOut]
