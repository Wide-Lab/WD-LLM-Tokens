"""A expressão SQL do custo de uma mensagem do WhatsApp.

Irmão de `custo.py`, no mesmo módulo pelo mesmo motivo: dinheiro mora num lugar só. Arquivo
separado, e não uma função a mais lá, porque as duas fórmulas não compartilham uma linha —
juntá-las criaria um arquivo onde é preciso ler metade para achar a outra.

Quem decide se a mensagem é cobrável **não somos nós**: é o objeto `pricing` do webhook de status
da Meta, que já leva em conta janela de atendimento, free entry point e as isenções que ela foi
criando. Aqui só multiplicamos o que ela disse por uma tarifa cadastrada — recalcular a regra de
cobrança de outra empresa é errar em silêncio no dia em que ela mudar."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import (
    ColumnExpressionArgument,
    Date,
    Numeric,
    case,
    cast,
    literal,
    not_,
    select,
)
from sqlalchemy.sql import ColumnElement
from sqlalchemy.sql.selectable import LateralFromClause

from app.modules.precos.infra.custo import MOEDA_PADRAO
from app.modules.precos.infra.models import PrecoMensagem

__all__ = ["MOEDA_PADRAO", "PrecoMensagemVigente", "preco_vigente_de_mensagem"]
"""`MOEDA_PADRAO` é re-exportada, e não redefinida: a moeda é a mesma nas duas fórmulas (é o que
faz as duas somas caírem no mesmo consolidado), e duas constantes com o mesmo valor são duas
constantes que um dia discordam. Sai daqui para o módulo de mensagem ter **um** import para o
`precos` — o mesmo arquivo que dá a fórmula dá a moeda."""


@dataclass(frozen=True, slots=True)
class PrecoMensagemVigente:
    """O `LEFT JOIN LATERAL` que anexa a cada mensagem a tarifa válida na data dela.

    `LEFT` pelo mesmo motivo do de modelo: mensagem sem preço cadastrado **continua aparecendo**
    no painel, com custo `null`. Um `INNER` sumiria com a linha, e o buraco só apareceria quando
    alguém perguntasse por que o total caiu."""

    lateral: LateralFromClause

    @property
    def moeda(self) -> ColumnElement[Any]:
        return self.lateral.c.moeda

    def custo(self, *, cobravel: ColumnExpressionArgument[bool]) -> ColumnElement[Any]:
        """`0` para o que não é cobrável, a tarifa para o resto — e `null` quando não há tarifa.

        Nesta ordem, e não com `coalesce`: as três saídas precisam ser distinguíveis.

        | Situação | Custo |
        |---|---|
        | `cobravel = false` (serviço, janela aberta, entrada, free entry point) | `0` |
        | `cobravel = true` e há preço vigente | `por_mensagem` |
        | `cobravel = true` e **não** há preço para `(categoria, pais, data)` | `null` |

        O terceiro caso é o que faz o painel gritar que falta cadastrar um país, em vez de somar
        zero e mostrar um total confortável e errado."""

        return case(
            (not_(cobravel), literal(0, Numeric)),
            else_=self.lateral.c.por_mensagem,
        )


def preco_vigente_de_mensagem(
    categoria: ColumnExpressionArgument[Any],
    pais: ColumnExpressionArgument[Any],
    criado_em: ColumnExpressionArgument[Any],
) -> PrecoMensagemVigente:
    """A tarifa de `(categoria, pais)` com o maior `vigencia_inicio <= criado_em`.

    `LIMIT 1` sobre `ORDER BY vigencia_inicio DESC`, igual ao de modelo — é o "preço mais recente
    que já valia quando a mensagem saiu"."""

    return PrecoMensagemVigente(
        lateral=(
            select(PrecoMensagem.moeda, PrecoMensagem.por_mensagem)
            .where(PrecoMensagem.categoria == categoria)
            .where(PrecoMensagem.pais == pais)
            .where(PrecoMensagem.vigencia_inicio <= cast(criado_em, Date))
            .order_by(PrecoMensagem.vigencia_inicio.desc())
            .limit(1)
            .lateral("preco_mensagem_vigente")
        )
    )
