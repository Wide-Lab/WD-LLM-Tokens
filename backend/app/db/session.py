import logging
from collections.abc import AsyncGenerator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
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


async def get_session() -> AsyncGenerator[AsyncSession]:
    """Uma sessão por request, fechada no fim."""

    async with get_session_maker()() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
