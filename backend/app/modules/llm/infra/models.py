import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Index, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RegistroLlm(Base):
    """Uma linha por chamada ao LLM. Append-only: nunca `UPDATE`, nunca `DELETE`.

    Como é uma linha por requisição, "número de requisições" é `COUNT(*)` — sem contador, sem
    rollup. Com ~50 req/dia, agregar em tempo de consulta sobra."""

    __tablename__ = "registro_llm"

    __table_args__ = (
        # Idempotência: o retry de um app não conta em dobro. **Parcial** porque `id_externo` é
        # opcional — no Postgres `NULL` não colide com `NULL`, mas o índice parcial deixa isso
        # explícito e mantém fora do índice as linhas que nunca vão ser consultadas por ele.
        Index(
            "uq_registro_llm_aplicacao_id_externo",
            "aplicacao",
            "id_externo",
            unique=True,
            postgresql_where=text("id_externo IS NOT NULL"),
        ),
        # Os três eixos do painel. `aplicacao` na frente em todos porque toda consulta do serviço
        # é dentro de uma aplicação (ou de todas, e aí o índice não muda nada).
        Index("ix_registro_llm_aplicacao_criado", "aplicacao", "criado_em"),
        Index("ix_registro_llm_aplicacao_ator_criado", "aplicacao", "ator", "criado_em"),
        Index("ix_registro_llm_aplicacao_modelo_criado", "aplicacao", "modelo", "criado_em"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    """A hora da chamada, digitada pelo app. É esta que manda no preço vigente e nos gráficos."""

    recebido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    """A hora em que o servidor recebeu. Existe para quando as duas discordarem: sem ela, um
    relógio torto num app vira "sumiu evento" e não "chegou com data errada"."""

    aplicacao: Mapped[str] = mapped_column(Text)
    ator: Mapped[str] = mapped_column(Text)
    """Quem consumiu: `wa_id`, telefone, `user_id`. Texto opaco — o serviço não interpreta."""

    modelo: Mapped[str] = mapped_column(Text)
    provedor: Mapped[str | None] = mapped_column(Text, nullable=True)

    tokens_entrada: Mapped[int] = mapped_column(Integer, server_default="0")
    """Entrada **não** cacheada. Os quatro baldes são não-sobrepostos por convenção do serviço:
    quem reporta normaliza antes do `POST` (na OpenAI, `prompt_tokens - cached_tokens`). Sem
    isso o mesmo token é cobrado duas vezes e o custo infla em silêncio."""

    tokens_saida: Mapped[int] = mapped_column(Integer, server_default="0")
    tokens_cache_leitura: Mapped[int] = mapped_column(Integer, server_default="0")
    tokens_cache_escrita: Mapped[int] = mapped_column(Integer, server_default="0")

    id_externo: Mapped[str | None] = mapped_column(Text, nullable=True)
    """O id do provedor (`response.id`). É a chave da idempotência."""

    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    """O que o ator mandou. Coluna própria, e não uma chave em `metadados`: é o que a tela de
    detalhe do ator abre em toda linha, e um `jsonb` opaco não deixa isso ser contrato."""

    resposta: Mapped[str | None] = mapped_column(Text, nullable=True)
    """O que o agente devolveu. `NULL` é "não veio no evento" — inclusive nos eventos gravados
    antes destas duas colunas existirem —, e não "o agente não respondeu"."""

    metadados: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
