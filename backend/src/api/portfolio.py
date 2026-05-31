from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.deps import get_current_user, get_cache_service, get_greeks_service, get_pnl_service, get_session
from src.models.paper_order import PaperOrder
from src.models.position import Position
from src.models.trade import Trade
from src.models.user import User
from src.config.pricing import get_tier_capital
from src.services.cache_service import CacheService
from src.services.greeks_service import GreeksService
from src.services.pnl_service import PnLService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("")
async def get_portfolio(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    cache: CacheService = Depends(get_cache_service),
    pnl_svc: PnLService = Depends(get_pnl_service),
    greeks_svc: GreeksService = Depends(get_greeks_service),
):
    user_result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "User not found")

    positions_result = await db.execute(
        select(Position).where(
            Position.user_id == UUID(user_id),
            Position.deleted_at.is_(None),
        )
    )
    positions = positions_result.scalars().all()

    positions_count = len(positions)
    ltps: dict[str, int] = {}
    pos_dicts = []
    for pos in positions:
        ltp = await cache.get_ltp(pos.security_id)
        if ltp is not None:
            ltps[pos.security_id] = ltp
        pos_dicts.append({
            "id": str(pos.id),
            "security_id": pos.security_id,
            "symbol": pos.symbol,
            "avg_entry_price": pos.avg_entry_price,
            "quantity": pos.quantity,
            "direction": pos.direction,
            "greeks": pos.greeks or {},
        })

    unrealized_pnl = pnl_svc.compute_portfolio_unrealized_pnl(pos_dicts, ltps)
    net_greeks = greeks_svc.compute_portfolio_greeks(pos_dicts)

    margin_available = user.virtual_cash - user.margin_used

    today_pnl_result = await db.execute(
        select(func.coalesce(func.sum(Trade.net_pnl), 0))
        .where(
            Trade.user_id == UUID(user_id),
            func.date(Trade.exit_timestamp) == func.current_date(),
        )
    )
    daily_pnl = today_pnl_result.scalar() or 0

    return {
        "virtual_cash": user.virtual_cash,
        "margin_used": user.margin_used,
        "margin_available": margin_available,
        "daily_pnl": daily_pnl,
        "total_realized_pnl": user.total_realized_pnl,
        "unrealized_pnl": unrealized_pnl,
        "total_equity": user.virtual_cash + user.total_realized_pnl + unrealized_pnl,
        "positions_count": positions_count,
        "subscription_tier": user.subscription_tier,
        "net_delta": net_greeks["delta"],
        "net_gamma": net_greeks["gamma"],
        "net_theta": net_greeks["theta"],
        "net_vega": net_greeks["vega"],
        "net_rho": net_greeks["rho"],
    }


@router.get("/pnl-history")
async def get_pnl_history(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    pnl_svc: PnLService = Depends(get_pnl_service),
):
    history = await pnl_svc.get_pnl_history(db, UUID(user_id), days=days)
    return {
        "days": days,
        "history": history,
    }


@router.post("/reset")
async def reset_portfolio(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    user_result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "User not found")

    now = datetime.now(timezone.utc)

    await db.execute(
        update(Position).where(
            Position.user_id == UUID(user_id),
            Position.deleted_at.is_(None),
        ).values(deleted_at=now)
    )

    capital = get_tier_capital(user.subscription_tier)
    user.virtual_cash = capital
    user.margin_used = 0
    user.day_start_cash = capital
    db.add(user)

    await db.commit()

    return {
        "virtual_cash": user.virtual_cash,
        "margin_used": user.margin_used,
        "message": "Portfolio reset successfully",
    }
