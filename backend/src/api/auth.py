from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import SessionResponse
from src.config.pricing import get_tier_capital
from src.deps import get_current_user_payload, get_session
from src.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/session", response_model=SessionResponse)
async def create_session(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_session),
):
    supabase_user_id: str = payload["sub"]
    email: str = payload.get("email", "")

    result = await db.execute(
        select(User).where(User.supabase_user_id == supabase_user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        tier = "free"
        capital = get_tier_capital(tier)
        user = User(
            supabase_user_id=supabase_user_id,
            email=email,
            display_name=email.split("@")[0],
            virtual_cash=capital,
            day_start_cash=capital,
            subscription_tier=tier,
            preferences={
                "max_lots_per_order": 50,
                "max_lots_per_position": 100,
                "margin_cap_pct": 0.80,
                "max_open_positions": 20,
                "daily_loss_limit": 50000,
            },
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        logger.info("Created local user for %s (%s)", email, supabase_user_id)
    else:
        user.last_login = datetime.now(timezone.utc)
        user.email = email
        db.add(user)

    return SessionResponse(
        supabase_user_id=supabase_user_id,
        email=email,
        display_name=user.display_name,
        virtual_balance=user.virtual_cash,
        local_user_id=str(user.id),
        subscription_tier=user.subscription_tier,
    )


@router.get("/me", response_model=SessionResponse)
async def get_me(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_session),
):
    supabase_user_id: str = payload["sub"]
    email: str = payload.get("email", "")

    result = await db.execute(
        select(User).where(User.supabase_user_id == supabase_user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        from fastapi import HTTPException
        raise HTTPException(404, "User not found — create session first")

    return SessionResponse(
        supabase_user_id=supabase_user_id,
        email=email,
        display_name=user.display_name,
        virtual_balance=user.virtual_cash,
        local_user_id=str(user.id),
        subscription_tier=user.subscription_tier,
    )
