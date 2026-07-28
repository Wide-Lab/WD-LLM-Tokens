"""preco_mensagem: a tarifa da mensagem de WhatsApp

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-28

Tabela nova, nada tocado. A chave do preço é `(categoria, pais)` — a Meta cobra assim —, e por
isso não cabia em `preco_modelo`: uma tabela com metade das colunas nula em cada linha são duas
tabelas fingindo ser uma.

Ninguém consome esta tabela ainda; quem consome é o módulo de mensagem, na etapa seguinte.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "preco_mensagem",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("categoria", sa.Text(), nullable=False),
        sa.Column("pais", sa.Text(), nullable=False),
        sa.Column("vigencia_inicio", sa.Date(), nullable=False),
        sa.Column("moeda", sa.Text(), nullable=False),
        sa.Column("por_mensagem", sa.Numeric(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "categoria", "pais", "vigencia_inicio", name="uq_preco_mensagem_vigencia"
        ),
    )

    # A busca do lateral: iguala categoria e país, desce pela vigência e para na primeira linha
    # que já valia na data da mensagem.
    op.create_index(
        "ix_preco_mensagem_busca",
        "preco_mensagem",
        ["categoria", "pais", sa.text("vigencia_inicio DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_preco_mensagem_busca", table_name="preco_mensagem")
    op.drop_table("preco_mensagem")
