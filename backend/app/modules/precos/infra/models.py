import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrecoModelo(Base):
    """O preço por milhão de tokens de um modelo, a partir de uma data."""

    __tablename__ = "preco_modelo"

    __table_args__ = (
        UniqueConstraint("modelo", "vigencia_inicio", name="uq_preco_modelo_vigencia"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

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
