import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Index, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrecoModelo(Base):
    """O preço por milhão de tokens de um modelo, a partir de uma data."""

    __tablename__ = "preco_modelo"

    __table_args__ = (
        UniqueConstraint("modelo", "vigencia_inicio", name="uq_preco_modelo_vigencia"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    provedor: Mapped[str | None] = mapped_column(Text, nullable=True)
    modelo: Mapped[str] = mapped_column(Text)
    vigencia_inicio: Mapped[date] = mapped_column(Date)

    moeda: Mapped[str] = mapped_column(Text)
    """`USD` em todas as linhas no v1. Misturar moedas na mesma agregação é o único jeito de o
    número do painel sair errado sem ninguém notar — conversão é problema da exibição."""

    entrada_por_milhao: Mapped[Decimal] = mapped_column(Numeric)
    saida_por_milhao: Mapped[Decimal] = mapped_column(Numeric)
    cache_leitura_por_milhao: Mapped[Decimal] = mapped_column(Numeric, server_default="0")
    cache_escrita_por_milhao: Mapped[Decimal] = mapped_column(Numeric, server_default="0")


class PrecoMensagem(Base):
    """O preço de uma mensagem cobrável do WhatsApp, a partir de uma data.

    A chave do preço é outra que a de `preco_modelo` — a Meta cobra por `(categoria, país do
    destinatário)`, não por modelo. É por isso que são duas tabelas e não uma com `tipo`: metade
    das colunas nula em cada linha são duas tabelas fingindo ser uma."""

    __tablename__ = "preco_mensagem"

    __table_args__ = (
        UniqueConstraint("categoria", "pais", "vigencia_inicio", name="uq_preco_mensagem_vigencia"),
        # A busca do lateral: iguala categoria e país, pega a vigência mais recente que já valia.
        Index("ix_preco_mensagem_busca", "categoria", "pais", text("vigencia_inicio DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    categoria: Mapped[str] = mapped_column(Text)
    """`marketing`, `utility` ou `authentication`. `text` e não `enum` do banco: categoria nova da
    Meta vira uma linha no `StrEnum` do domínio, e não um `ALTER TYPE` em migration."""

    pais: Mapped[str] = mapped_column(Text)
    """ISO-3166 alfa-2 maiúsculo do destinatário (`BR`, `US`). Casa por igualdade exata com o
    `pais` da mensagem — sem curinga de mercado: país não cadastrado sai com custo `null`, e é
    esse buraco visível que pede o cadastro."""

    vigencia_inicio: Mapped[date] = mapped_column(Date)

    moeda: Mapped[str] = mapped_column(Text)
    """`USD`, como em `preco_modelo` — as duas somas caem no mesmo consolidado."""

    por_mensagem: Mapped[Decimal] = mapped_column(Numeric)
    """O valor de **uma** mensagem cobrável. Uma coluna de valor só: sem BSP não há markup. Se um
    dia entrar, é uma coluna a mais e uma parcela a mais na fórmula."""
