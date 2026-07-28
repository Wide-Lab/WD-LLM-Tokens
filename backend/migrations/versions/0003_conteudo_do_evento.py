"""Conteúdo do evento: mensagem do ator e resposta do agente

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nulláveis, e sem `server_default`: o histórico já gravado não tem conteúdo, e uma string
    # vazia diria "o ator não falou nada" no lugar de "este evento é anterior ao campo".
    op.add_column("registro_uso", sa.Column("mensagem", sa.Text(), nullable=True))
    op.add_column("registro_uso", sa.Column("resposta", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("registro_uso", "resposta")
    op.drop_column("registro_uso", "mensagem")
