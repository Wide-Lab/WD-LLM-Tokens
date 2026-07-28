"""Chaves de API emitidas pelo admin

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chave_api",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("escopo", sa.Text(), nullable=False),
        sa.Column("aplicacao", sa.Text(), nullable=True),
        sa.Column("prefixo", sa.Text(), nullable=False),
        sa.Column("impressao", sa.Text(), nullable=False),
        sa.Column(
            "criada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("ultimo_uso_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revogada_em", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prefixo", name="uq_chave_api_prefixo"),
        sa.UniqueConstraint("impressao", name="uq_chave_api_impressao"),
    )


def downgrade() -> None:
    op.drop_table("chave_api")
