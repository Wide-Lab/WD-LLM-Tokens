import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Usuario(Base):
    """Um usuário do painel."""

    __tablename__ = "usuario"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email: Mapped[str] = mapped_column(Text, unique=True)
    """Guardado sempre em minúsculas (ver `normalizar_email`) — o `UNIQUE` do Postgres é
    sensível a caixa, e sem normalizar `Ana@x.com` e `ana@x.com` viram duas contas."""

    nome: Mapped[str] = mapped_column(Text)
    senha_hash: Mapped[str] = mapped_column(Text)

    ativo: Mapped[bool] = mapped_column(Boolean, server_default="true")
    """Desligar aqui derruba a sessão em aberto: o cookie carrega só o id, e todo request
    reconfere a linha no banco."""

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
