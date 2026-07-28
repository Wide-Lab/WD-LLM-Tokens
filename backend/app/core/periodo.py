"""O vocabulário de período que os dois módulos de fato compartilham.

Nasceu com o **segundo** consumidor, e não com o primeiro: extrair vocabulário comum enquanto só
o `llm` existia seria adivinhar qual metade era genérica. Mora no `core` porque `core` já é a casa
do transversal (config, exceções, logging) — importar `core` não é import de módulo a módulo.

O que sobe para cá é só o que os dois precisam acertar **igual**. O `Filtro` de cada um fica onde
está: o do LLM tem `modelo`, o do WhatsApp tem `categoria`, `pais` e `direcao`, e um `Filtro`
genérico com os dois conjuntos seria uma estrutura em que metade dos campos é sempre ignorada."""

from datetime import UTC, date, datetime, time, timedelta
from enum import StrEnum
from typing import Any

from sqlalchemy import Date, cast, func
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.elements import SQLColumnExpression


class Intervalo(StrEnum):
    """O balde temporal. Ausente = sem série temporal, só o total do período."""

    DIA = "dia"
    SEMANA = "semana"
    MES = "mes"


_UNIDADE = {Intervalo.DIA: "day", Intervalo.SEMANA: "week", Intervalo.MES: "month"}
"""`Intervalo` → argumento do `date_trunc`. O enum não guarda o termo SQL porque `dia`/`semana`/
`mes` é o vocabulário do contrato público, e `day`/`week`/`month` é detalhe do Postgres."""


def truncar(intervalo: Intervalo, coluna: SQLColumnExpression[datetime]) -> ColumnElement[Any]:
    """A coluna de instante virada no começo do balde, já como `date`.

    O `cast` existe para o balde sair `2026-07-28` e não `2026-07-28T00:00:00Z`: o período é um
    rótulo de gráfico, não um instante."""

    return cast(func.date_trunc(_UNIDADE[intervalo], coluna), Date)


def _meia_noite(dia: date) -> datetime:
    return datetime.combine(dia, time.min, tzinfo=UTC)


def janela(
    coluna: SQLColumnExpression[datetime],
    de: date | None,
    ate: date | None,
) -> list[ColumnElement[bool]]:
    """Os `WHERE` do período, para `stmt.where(*janela(...))`.

    Aqui mora a regra que os dois módulos precisam acertar igual: `ate` é **o dia inteiro**
    (`coluna < meia-noite de ate + 1 dia`). O painel filtra por data, e um `<=` sobre a meia-noite
    cortaria fora quase todo o último dia do período. Duas cópias desta regra divergem no dia em
    que alguém mexer numa — e o sintoma seria um total que não bate por um dia, o tipo de erro
    que ninguém vê."""

    condicoes: list[ColumnElement[bool]] = []
    if de is not None:
        condicoes.append(coluna >= _meia_noite(de))
    if ate is not None:
        condicoes.append(coluna < _meia_noite(ate + timedelta(days=1)))
    return condicoes
