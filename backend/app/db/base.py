from typing import Any

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base dos models SQLAlchemy."""

    __mapper_args__: dict[str, Any] = {"eager_defaults": True}
    """Traz os valores gerados pelo banco (`server_default`) já no RETURNING do INSERT.

    Sem isto, ler `registro.recebido_em` logo depois de inserir dispara um SELECT preguiçoso —
    que, numa sessão async, estoura `MissingGreenlet`."""
