from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config.settings import settings
from src.models.base import Base
from src.models.user import User
from src.models.paper_order import PaperOrder
from src.models.position import Position
from src.models.trade import Trade

__all__ = [
    "Base",
    "User",
    "PaperOrder",
    "Position",
    "Trade",
    "create_engine",
    "create_session_factory",
    "get_session",
]

_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    echo=settings.ENVIRONMENT == "development",
)

SessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def create_engine():
    return create_async_engine(
        settings.DATABASE_URL,
        connect_args=_connect_args,
        pool_pre_ping=True,
        echo=settings.ENVIRONMENT == "development",
    )


def create_session_factory(engine):
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_session() -> AsyncSession:
    async with SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
