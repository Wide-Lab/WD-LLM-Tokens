"""Estrutura inicial: registro_uso e preco_modelo

Revision ID: 0001
Revises:
Create Date: 2026-07-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "registro_uso",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "recebido_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("aplicacao", sa.Text(), nullable=False),
        sa.Column("ator", sa.Text(), nullable=False),
        sa.Column("modelo", sa.Text(), nullable=False),
        sa.Column("provedor", sa.Text(), nullable=True),
        sa.Column("tokens_entrada", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tokens_saida", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tokens_cache_leitura", sa.Integer(), server_default="0", nullable=False),
        sa.Column("tokens_cache_escrita", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id_externo", sa.Text(), nullable=True),
        sa.Column("metadados", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # Parcial: só as linhas que mandaram `id_externo` entram. É este índice que dá a
    # idempotência do `ON CONFLICT` — e ele precisa existir com exatamente este predicado,
    # senão o `INSERT` não o encontra e estoura.
    op.create_index(
        "uq_registro_uso_aplicacao_id_externo",
        "registro_uso",
        ["aplicacao", "id_externo"],
        unique=True,
        postgresql_where=sa.text("id_externo IS NOT NULL"),
    )
    op.create_index(
        "ix_registro_uso_aplicacao_criado",
        "registro_uso",
        ["aplicacao", "criado_em"],
    )
    op.create_index(
        "ix_registro_uso_aplicacao_ator_criado",
        "registro_uso",
        ["aplicacao", "ator", "criado_em"],
    )
    op.create_index(
        "ix_registro_uso_aplicacao_modelo_criado",
        "registro_uso",
        ["aplicacao", "modelo", "criado_em"],
    )

    op.create_table(
        "preco_modelo",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provedor", sa.Text(), nullable=True),
        sa.Column("modelo", sa.Text(), nullable=False),
        sa.Column("vigencia_inicio", sa.Date(), nullable=False),
        sa.Column("moeda", sa.Text(), nullable=False),
        sa.Column("entrada_por_milhao", sa.Numeric(), nullable=False),
        sa.Column("saida_por_milhao", sa.Numeric(), nullable=False),
        sa.Column("cache_leitura_por_milhao", sa.Numeric(), server_default="0", nullable=False),
        sa.Column("cache_escrita_por_milhao", sa.Numeric(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("modelo", "vigencia_inicio", name="uq_preco_modelo_vigencia"),
    )


def downgrade() -> None:
    op.drop_table("preco_modelo")
    op.drop_index("ix_registro_uso_aplicacao_modelo_criado", table_name="registro_uso")
    op.drop_index("ix_registro_uso_aplicacao_ator_criado", table_name="registro_uso")
    op.drop_index("ix_registro_uso_aplicacao_criado", table_name="registro_uso")
    op.drop_index("uq_registro_uso_aplicacao_id_externo", table_name="registro_uso")
    op.drop_table("registro_uso")
