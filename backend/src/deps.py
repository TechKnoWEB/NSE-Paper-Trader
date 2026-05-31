from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.middleware.auth_middleware import validate_supabase_token
from src.models import SessionFactory, get_session as _get_session
from src.models.user import User
from src.services.cache_service import CacheService
from src.services.dhan_client import DhanClient
from src.services.greeks_service import GreeksService
from src.services.notification_service import NotificationService
from src.services.paper_engine import PaperEngine
from src.services.pnl_service import PnLService
from src.middleware.rate_limit import RateLimiter


async def get_session() -> AsyncSession:
    async for session in _get_session():
        yield session


def get_cache_service(request: Request) -> CacheService:
    cache: CacheService | None = getattr(request.app.state, "cache_service", None)
    if cache is None:
        raise HTTPException(503, "Cache service not available")
    return cache


def get_dhan_client(request: Request) -> DhanClient:
    dhan: DhanClient | None = getattr(request.app.state, "dhan_client", None)
    if dhan is None:
        raise HTTPException(503, "Dhan API client not available")
    return dhan


def get_paper_engine(request: Request) -> PaperEngine:
    engine: PaperEngine | None = getattr(request.app.state, "paper_engine", None)
    if engine is None:
        raise HTTPException(503, "Paper engine not available")
    return engine


def get_pnl_service(request: Request) -> PnLService:
    svc: PnLService | None = getattr(request.app.state, "pnl_service", None)
    if svc is None:
        raise HTTPException(503, "P&L service not available")
    return svc


def get_greeks_service(request: Request) -> GreeksService:
    return GreeksService()


def get_rate_limiter(request: Request) -> RateLimiter:
    limiter: RateLimiter | None = getattr(request.app.state, "rate_limiter", None)
    if limiter is None:
        raise HTTPException(503, "Rate limiter not available")
    return limiter


async def get_current_user_payload(request: Request) -> dict:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization header")
    token = auth.split(" ")[1]
    return validate_supabase_token(token)


async def get_current_user(request: Request) -> str:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization header")
    token = auth.split(" ")[1]
    payload = validate_supabase_token(token)
    supabase_user_id: str = payload["sub"]

    async with SessionFactory() as db:
        result = await db.execute(
            select(User).where(User.supabase_user_id == supabase_user_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(404, "User not found — call POST /auth/session first")
        return str(user.id)


async def get_current_user_id(request: Request) -> UUID:
    user_id_str = await get_current_user(request)
    try:
        return UUID(user_id_str)
    except ValueError:
        raise HTTPException(401, "Invalid user ID in token")
