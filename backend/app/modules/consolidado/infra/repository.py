"""O repositório do consolidado: `UNION ALL` das projeções e uma agregação por cima.

Nenhuma tabela é dele. As linhas vêm de `llm/infra/projecao.py` e `whatsapp/infra/projecao.py`, e
este é o único arquivo do backend que importa dois módulos de fato — na direção que importa: o
consolidado conhece as origens, as origens não conhecem o consolidado. **Ninguém importa o
consolidado**, e é isso que permite deletá-lo sem mexer em nada.

A soma acontece aqui, e não no browser, porque ela tem semântica: `custo: null` ("não sei") não
pode virar zero ao encontrar um número, as moedas precisam concordar antes de somar, e o período
precisa ser recortado igual dos dois lados. Cada uma dessas regras já existe uma vez no backend —
reimplementá-las em TypeScript seria a segunda cópia, e a que ninguém lembra de atualizar."""

from typing import Any

from sqlalchemy import Subquery, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import ColumnElement

from app.core.lancamento import FiltroComum
from app.core.periodo import Intervalo, truncar
from app.modules.consolidado.domain.entities import Balde, Grupo
from app.modules.llm.infra.projecao import projecao_de_custo as projecao_de_llm
from app.modules.precos.infra.custo import MOEDA_PADRAO
from app.modules.whatsapp.infra.projecao import projecao_de_custo as projecao_de_whatsapp

_COLUNA_GRUPO: dict[Grupo, str] = {
    Grupo.ORIGEM: "origem",
    Grupo.APLICACAO: "aplicacao",
    Grupo.ATOR: "ator",
}
"""O mapa fechado, como nos dois módulos de fato: `grupo` chega pela query string e não vira nome
de coluna sem passar por aqui. São nomes, e não colunas, porque a coluna só existe depois que o
`UNION ALL` é montado."""


class ConsolidadoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def agregar(
        self,
        filtro: FiltroComum,
        grupo: Grupo | None,
        intervalo: Intervalo | None,
        por_origem: bool = False,
    ) -> list[Balde]:
        """As mesmas quatro combinações de `grupo` × `intervalo` dos outros painéis, sobre a união.

        `por_origem` é a terceira dimensão, e não um quarto valor de `Grupo`, porque origem não
        concorre com as outras — ela **acompanha**. "Custo por aplicação" e "custo por aplicação
        repartido entre LLM e WhatsApp" são a mesma pergunta com e sem o recorte, do mesmo jeito
        que `intervalo` é a mesma pergunta com e sem tempo.

        `sum` ignora `NULL`, então o balde soma o que tem preço e sai `NULL` só quando nada tem —
        o mesmo comportamento que o painel de LLM já tinha, pelo mesmo motivo. Na prática é o que
        garante que uma origem sem preço cadastrado não zere o total da outra.

        `max(moeda)` e não uma moeda por linha: toda linha de preço do serviço é USD (é o que
        torna as duas somas somáveis), então o `max` é o nome da moeda, não uma escolha entre
        duas. O `coalesce` cobre só o caso de não haver lançamento nenhum."""

        lancamento = self._lancamentos(filtro)

        chaves: list[ColumnElement[Any]] = []
        if grupo is not None:
            chaves.append(lancamento.c[_COLUNA_GRUPO[grupo]].label("grupo"))
        if intervalo is not None:
            chaves.append(truncar(intervalo, lancamento.c.criado_em).label("periodo"))
        if por_origem:
            chaves.append(lancamento.c.origem.label("origem"))

        stmt = select(
            *chaves,
            func.count().label("lancamentos"),
            func.sum(lancamento.c.custo).label("custo"),
            func.coalesce(func.max(lancamento.c.moeda), literal(MOEDA_PADRAO)).label("moeda"),
        ).select_from(lancamento)

        if chaves:
            stmt = stmt.group_by(*chaves).order_by(*chaves)

        return [
            Balde(
                lancamentos=linha.lancamentos,
                custo=linha.custo,
                moeda=linha.moeda,
                grupo=linha.grupo if grupo is not None else None,
                periodo=linha.periodo if intervalo is not None else None,
                origem=linha.origem if por_origem else None,
            )
            for linha in (await self._session.execute(stmt)).all()
        ]

    async def aplicacoes(self) -> list[str]:
        """As aplicações que já reportaram **alguma** coisa, de qualquer origem.

        Popula o dropdown do painel, e é por isso que sai daqui e não do `llm`: uma aplicação que
        só reportou WhatsApp precisa aparecer na lista.

        Pela mesma união, e não por dois `SELECT DISTINCT` unidos à mão: a lista de filtros de um
        painel tem de ser a lista de valores que aquele painel consegue mostrar, e a única forma
        de isso continuar verdade quando uma terceira origem entrar é as duas coisas saírem da
        mesma função. O `LEFT JOIN LATERAL` do preço vem junto sem precisar — com o volume deste
        serviço, é barato o bastante para não valer uma segunda superfície entre os módulos."""

        aplicacao = self._lancamentos(FiltroComum()).c.aplicacao
        return list(await self._session.scalars(select(aplicacao).distinct().order_by(aplicacao)))

    @staticmethod
    def _lancamentos(filtro: FiltroComum) -> Subquery:
        """O `UNION ALL` das duas origens, com o **mesmo** filtro nas duas.

        `UNION ALL` e não `UNION`: não há linha duplicada a eliminar entre as origens — um evento
        de LLM nunca é uma mensagem de WhatsApp —, e o `DISTINCT` implícito do `UNION` custaria uma
        ordenação para descobrir isso. Pior: ele apagaria dois lançamentos legitimamente idênticos
        (mesmo ator, mesmo instante, mesma tarifa), e o total sairia menor sem ninguém notar."""

        return union_all(projecao_de_llm(filtro), projecao_de_whatsapp(filtro)).subquery(
            "lancamento"
        )
