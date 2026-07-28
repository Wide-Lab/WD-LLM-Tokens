"""registro_mensagem: uma linha por mensagem de WhatsApp

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-28

Tabela nova, nada tocado. Segunda tabela de fato do serviço, irmã de `registro_llm`: append-only,
idempotente por `(aplicacao, id_externo)` — aqui o `id_externo` é o `wamid` —, e sem custo
gravado, que continua saindo na leitura pela tarifa de `preco_mensagem` vigente na data.

`direcao` e `categoria` são `text` e não `ENUM` do banco, como `chave_api.escopo`: categoria nova
da Meta vira uma linha num `StrEnum` do domínio, e não um `ALTER TYPE` numa janela de manutenção.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "registro_mensagem",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "recebido_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("aplicacao", sa.Text(), nullable=False),
        sa.Column("ator", sa.Text(), nullable=False),
        sa.Column("direcao", sa.Text(), nullable=False),
        sa.Column("categoria", sa.Text(), nullable=True),
        sa.Column("pais", sa.Text(), nullable=False),
        sa.Column("cobravel", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("id_externo", sa.Text(), nullable=True),
        sa.Column("conteudo", sa.Text(), nullable=True),
        sa.Column(
            "metadados",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Idempotência pelo `wamid`. Parcial porque `id_externo` é opcional: quem não manda abriu mão
    # da idempotência, e essas linhas ficam fora do índice.
    op.create_index(
        "uq_registro_mensagem_aplicacao_id_externo",
        "registro_mensagem",
        ["aplicacao", "id_externo"],
        unique=True,
        postgresql_where=sa.text("id_externo IS NOT NULL"),
    )

    # Os eixos do painel, com `aplicacao` na frente em todos — como em `registro_llm`.
    op.create_index(
        "ix_registro_mensagem_aplicacao_criado", "registro_mensagem", ["aplicacao", "criado_em"]
    )
    op.create_index(
        "ix_registro_mensagem_aplicacao_ator_criado",
        "registro_mensagem",
        ["aplicacao", "ator", "criado_em"],
    )
    op.create_index(
        "ix_registro_mensagem_aplicacao_categoria_criado",
        "registro_mensagem",
        ["aplicacao", "categoria", "criado_em"],
    )


def downgrade() -> None:
    op.drop_index("ix_registro_mensagem_aplicacao_categoria_criado", table_name="registro_mensagem")
    op.drop_index("ix_registro_mensagem_aplicacao_ator_criado", table_name="registro_mensagem")
    op.drop_index("ix_registro_mensagem_aplicacao_criado", table_name="registro_mensagem")
    op.drop_index("uq_registro_mensagem_aplicacao_id_externo", table_name="registro_mensagem")
    op.drop_table("registro_mensagem")
