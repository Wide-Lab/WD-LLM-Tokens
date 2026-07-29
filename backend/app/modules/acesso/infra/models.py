import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Usuario(Base):
    """Um usuário do painel."""

    __tablename__ = "usuario"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    email: Mapped[str] = mapped_column(Text, unique=True)
    """Guardado sempre em minúsculas (ver `normalizar_email`) — o `UNIQUE` do Postgres é
    sensível a caixa, e sem normalizar `Ana@x.com` e `ana@x.com` viram duas contas."""

    nome: Mapped[str] = mapped_column(Text)
    senha_hash: Mapped[str] = mapped_column(Text)

    ativo: Mapped[bool] = mapped_column(Boolean, server_default="true")
    """Desligar aqui derruba a sessão em aberto: o cookie carrega só o id, e todo request
    reconfere a linha no banco."""

    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChaveApi(Base):
    """Uma chave de API emitida pelo admin.

    Diferente de `registro_llm`, esta tabela **muda**: `ultimo_uso_em` e `revogada_em` são
    `UPDATE`. O append-only vale para o que é fato consumado (um evento aconteceu e não
    desacontece); uma credencial é estado, e estado tem que poder ser desligado."""

    __tablename__ = "chave_api"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    nome: Mapped[str] = mapped_column(Text)
    """Para gente: "famossul produção", "script de relatório". É o que aparece na listagem junto
    do prefixo, e o que permite revogar a certa."""

    escopo: Mapped[str] = mapped_column(Text)
    """`escrita` ou `leitura` (`EscopoChave`). `Text` e não `ENUM` do Postgres: acrescentar um
    escopo vira uma linha no `StrEnum`, e não um `ALTER TYPE` em migration."""

    aplicacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    """Preenchida só nas de escrita — é ela que o `POST /v1/llm/eventos` cobra do payload."""

    prefixo: Mapped[str] = mapped_column(Text, unique=True)
    """Os 8 hex do meio da chave, em claro. Não é segredo e não autentica nada: existe para a
    listagem mostrar `ltc_7f3a9c21…` e alguém reconhecer qual chave está olhando."""

    impressao: Mapped[str] = mapped_column(Text, unique=True)
    """SHA-256 da chave inteira (ver `infra/chave.py`). Único porque é por ele que a autenticação
    busca: um índice, não uma varredura."""

    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    ultimo_uso_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    """Carimbado no máximo de hora em hora (ver `ChaveApiRepository.marcar_uso`). Responde a
    única pergunta que importa antes de revogar: isso ainda está em uso?"""

    revogada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    """Revogar é carimbar aqui, não apagar a linha: a chave revogada continua no histórico com o
    nome de quem a usava. `NULL` = ativa."""
