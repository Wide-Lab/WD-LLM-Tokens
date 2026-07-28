from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from app.modules.uso.domain.entities import Filtro


def filtro_de_consulta(
    de: Annotated[date | None, Query(description="Início do período (inclusive).")] = None,
    ate: Annotated[date | None, Query(description="Fim do período (o dia inteiro).")] = None,
    aplicacao: str | None = None,
    ator: str | None = None,
    modelo: str | None = None,
) -> Filtro:
    """Os cinco filtros que `/v1/metricas` e `/v1/eventos` compartilham."""

    return Filtro(de=de, ate=ate, aplicacao=aplicacao, ator=ator, modelo=modelo)


FiltroDep = Annotated[Filtro, Depends(filtro_de_consulta)]
