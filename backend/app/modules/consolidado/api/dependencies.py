from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from app.core.lancamento import FiltroComum


def filtro_de_consulta(
    de: Annotated[date | None, Query(description="Início do período (inclusive).")] = None,
    ate: Annotated[date | None, Query(description="Fim do período (o dia inteiro).")] = None,
    aplicacao: str | None = None,
    ator: Annotated[str | None, Query(description="O mesmo texto nas duas origens.")] = None,
) -> FiltroComum:
    """Os quatro filtros de `/v1/consolidado/metricas` — os que existem nas duas origens.

    Não há `modelo` nem `categoria` aqui, e a ausência é o contrato: um filtro de uma origem só,
    aplicado à soma das duas, devolveria um total que parece completo e não é."""

    return FiltroComum(de=de, ate=ate, aplicacao=aplicacao, ator=ator)


FiltroDep = Annotated[FiltroComum, Depends(filtro_de_consulta)]
