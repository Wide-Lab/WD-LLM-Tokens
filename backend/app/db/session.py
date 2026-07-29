"""O engine e a fábrica de sessões. Quem abre sessão é a `UnitOfWork` (`app/db/uow.py`) — é ela
que sabe quando commitar, e é por ela que as rotas e os serviços pedem transação."""

import logging
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_config

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    logger.info("Iniciando o engine do banco de dados...")
    return create_async_engine(get_config().DATABASE_URL, echo=False, future=True)


@lru_cache(maxsize=1)
def get_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), expire_on_commit=False, class_=AsyncSession)


async def dispose_engine() -> None:
    await get_engine().dispose()
