"""registro_uso vira registro_llm

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-28

O módulo `uso` sempre foi o do LLM — "uso" só parecia genérico enquanto era o único tipo de
fato. Com a mensagem de WhatsApp chegando, o nome passa a mentir.

Renomeia a tabela **e os índices**. O Postgres mantém os índices funcionando depois de um
`RENAME TABLE`, então renomeá-los não é cosmético por acaso: sem isso o `alembic check` acusa
divergência entre os models e o banco para sempre.

O `ON CONFLICT` do repositório infere o índice pelas colunas e pelo predicado, não pelo nome —
continua funcionando sem tocar em nada.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDICES = [
    ("uq_registro_uso_aplicacao_id_externo", "uq_registro_llm_aplicacao_id_externo"),
    ("ix_registro_uso_aplicacao_criado", "ix_registro_llm_aplicacao_criado"),
    ("ix_registro_uso_aplicacao_ator_criado", "ix_registro_llm_aplicacao_ator_criado"),
    ("ix_registro_uso_aplicacao_modelo_criado", "ix_registro_llm_aplicacao_modelo_criado"),
]
"""Os quatro criados na 0001, na mesma ordem."""


def upgrade() -> None:
    op.rename_table("registro_uso", "registro_llm")
    for antigo, novo in _INDICES:
        op.execute(f'ALTER INDEX "{antigo}" RENAME TO "{novo}"')
    # A PK herdou o nome automático da 0001, que não o declarou. Renomeá-la é higiene, não
    # requisito: nada no código a referencia por nome.
    op.execute(
        'ALTER TABLE "registro_llm" RENAME CONSTRAINT "registro_uso_pkey" TO "registro_llm_pkey"'
    )


def downgrade() -> None:
    op.execute(
        'ALTER TABLE "registro_llm" RENAME CONSTRAINT "registro_llm_pkey" TO "registro_uso_pkey"'
    )
    for antigo, novo in reversed(_INDICES):
        op.execute(f'ALTER INDEX "{novo}" RENAME TO "{antigo}"')
    op.rename_table("registro_llm", "registro_uso")
