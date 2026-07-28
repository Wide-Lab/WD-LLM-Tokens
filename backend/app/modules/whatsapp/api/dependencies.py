from datetime import date
from typing import Annotated

from fastapi import Depends, Query

from app.modules.whatsapp.domain.entities import Categoria, Direcao, Filtro


def filtro_de_consulta(
    de: Annotated[date | None, Query(description="Início do período (inclusive).")] = None,
    ate: Annotated[date | None, Query(description="Fim do período (o dia inteiro).")] = None,
    aplicacao: str | None = None,
    ator: Annotated[str | None, Query(description="O `wa_id` do cliente, só dígitos.")] = None,
    categoria: Categoria | None = None,
    pais: Annotated[str | None, Query(description="ISO-3166 alfa-2: `BR`, `US`.")] = None,
    direcao: Direcao | None = None,
) -> Filtro:
    """Os sete filtros que `/v1/whatsapp/metricas` e `/v1/whatsapp/mensagens` compartilham."""

    return Filtro(
        de=de,
        ate=ate,
        aplicacao=aplicacao,
        ator=ator,
        categoria=categoria,
        pais=pais,
        direcao=direcao,
    )


FiltroDep = Annotated[Filtro, Depends(filtro_de_consulta)]
