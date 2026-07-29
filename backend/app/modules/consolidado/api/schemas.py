from datetime import date
from typing import Any

from pydantic import BaseModel, model_serializer


class MetricaOut(BaseModel):
    """Um balde da resposta de `/v1/consolidado/metricas`.

    Dinheiro, tempo, quem e de onde — e o que não está aqui é tão contrato quanto o que está: nada
    de `tokens_*`, `mensagens` ou `requisicoes`. O consolidado fala dinheiro, tempo e quem."""

    grupo: str | None = None
    periodo: date | None = None
    origem: str | None = None
    lancamentos: int
    custo: float | None
    moeda: str

    @model_serializer
    def _serializar(self) -> dict[str, Any]:
        """`grupo` e `periodo` são **omitidos** quando o parâmetro não foi passado, e não emitidos
        como `null` — o mesmo dos outros dois `MetricaOut` e pelo mesmo motivo: um `exclude_none`
        genérico comeria junto o `custo: null`, que é informação (nenhuma linha do balde tinha
        preço cadastrado)."""

        saida: dict[str, Any] = {}
        if self.grupo is not None:
            saida["grupo"] = self.grupo
        if self.periodo is not None:
            saida["periodo"] = self.periodo.isoformat()
        if self.origem is not None:
            saida["origem"] = self.origem

        saida.update(lancamentos=self.lancamentos, custo=self.custo, moeda=self.moeda)
        return saida
