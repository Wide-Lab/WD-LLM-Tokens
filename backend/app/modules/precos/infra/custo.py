"""A expressão SQL do custo — o único lugar do backend que sabe converter token em dinheiro.

Mora no `precos` e é importada pelo `uso` (o único import de módulo a módulo do projeto). A
alternativa era duplicar a fórmula nas duas consultas do `uso` — a listagem e a agregação — e
duas cópias de uma fórmula de dinheiro divergem no dia em que um balde novo aparecer.

O custo **não** é gravado no evento: ele é derivado na leitura, pelo preço vigente na data da
chamada. É isso que faz um reajuste do provedor não reescrever o histórico."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnExpressionArgument, Date, Numeric, cast, literal, select
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import LateralFromClause

from app.modules.precos.infra.models import PrecoModelo

MOEDA_PADRAO = "USD"
"""A moeda que o painel assume quando o balde não tem preço nenhum para nomear uma.

Todas as linhas de `preco_modelo` são USD no v1 — misturar moedas na mesma soma é o único jeito
de o número sair errado —, então o padrão nunca contradiz um preço real."""


@dataclass(frozen=True, slots=True)
class PrecoVigente:
    """O `LEFT JOIN LATERAL` que anexa a cada evento o preço válido na data dele.

    `LEFT` e não `INNER`: modelo sem preço cadastrado tem custo `null` e **continua aparecendo**
    no painel com os tokens dele. Um `INNER` sumiria com o evento inteiro, e o buraco só seria
    notado quando alguém perguntasse por que o total caiu."""

    lateral: LateralFromClause

    @property
    def moeda(self) -> ColumnElement[Any]:
        return self.lateral.c.moeda

    def custo(
        self,
        *,
        entrada: ColumnExpressionArgument[Any],
        saida: ColumnExpressionArgument[Any],
        cache_leitura: ColumnExpressionArgument[Any],
        cache_escrita: ColumnExpressionArgument[Any],
    ) -> ColumnElement[Any]:
        """Soma balde a balde. Os quatro são não-sobrepostos por convenção do serviço (quem
        reporta normaliza antes do `POST`) — sem isso o mesmo token entraria duas vezes."""

        return (
            entrada * self.lateral.c.entrada_por_milhao
            + saida * self.lateral.c.saida_por_milhao
            + cache_leitura * self.lateral.c.cache_leitura_por_milhao
            + cache_escrita * self.lateral.c.cache_escrita_por_milhao
        ) / literal(1_000_000, Numeric)


def preco_vigente_para(
    modelo: ColumnExpressionArgument[Any],
    criado_em: ColumnExpressionArgument[Any],
) -> PrecoVigente:
    """O preço do modelo com o maior `vigencia_inicio <= criado_em`.

    `LIMIT 1` sobre `ORDER BY vigencia_inicio DESC` — é o "preço mais recente que já valia
    quando a chamada aconteceu". Lateral, e não uma subquery correlacionada por coluna, para
    que as quatro tarifas venham de uma varredura só."""

    return PrecoVigente(
        lateral=(
            select(
                PrecoModelo.moeda,
                PrecoModelo.entrada_por_milhao,
                PrecoModelo.saida_por_milhao,
                PrecoModelo.cache_leitura_por_milhao,
                PrecoModelo.cache_escrita_por_milhao,
            )
            .where(PrecoModelo.modelo == modelo)
            .where(PrecoModelo.vigencia_inicio <= cast(criado_em, Date))
            .order_by(PrecoModelo.vigencia_inicio.desc())
            .limit(1)
            .lateral("preco")
        )
    )
