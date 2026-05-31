from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import PositionCloseRequest
from src.deps import get_current_user, get_cache_service, get_paper_engine, get_pnl_service, get_session
from src.models.position import Position
from src.services.cache_service import CacheService
from src.services.paper_engine import PaperEngine
from src.services.pnl_service import PnLService
from src.utils.exceptions import AppException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/positions", tags=["positions"])


@router.get("")
async def list_positions(
    status: str = Query("OPEN", regex="^(OPEN|CLOSED)$"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
    cache: CacheService = Depends(get_cache_service),
    pnl_svc: PnLService = Depends(get_pnl_service),
):
    query = select(Position).where(Position.user_id == UUID(user_id))

    if status == "OPEN":
        query = query.where(Position.deleted_at.is_(None))
    else:
        query = query.where(Position.deleted_at.isnot(None))

    query = query.order_by(Position.created_at.desc())
    result = await db.execute(query)
    positions = result.scalars().all()

    positions_data = []
    for pos in positions:
        ltp = await cache.get_ltp(pos.security_id)
        if ltp is not None:
            pos.last_ltp = ltp
            pos.last_ltp_at = datetime.now(timezone.utc)

        unrealized_pnl = None
        if ltp is not None and pos.avg_entry_price:
            multiplier = 1 if pos.direction == "LONG" else -1
            unrealized_pnl = (ltp - pos.avg_entry_price) * pos.quantity * multiplier

        positions_data.append({
            "id": str(pos.id),
            "user_id": str(pos.user_id),
            "security_id": pos.security_id,
            "symbol": pos.symbol,
            "underlying": pos.underlying,
            "strike_price": pos.strike_price,
            "option_type": pos.option_type,
            "expiry_date": str(pos.expiry_date) if pos.expiry_date else None,
            "exchange_segment": pos.exchange_segment,
            "lot_size": pos.lot_size,
            "direction": pos.direction,
            "quantity": pos.quantity,
            "avg_entry_price": pos.avg_entry_price,
            "margin_blocked": pos.margin_blocked,
            "last_ltp": ltp,
            "unrealized_pnl": unrealized_pnl,
            "greeks": pos.greeks or {},
            "stop_loss_pct": pos.stop_loss_pct,
            "strategy_tag": pos.strategy_tag,
            "created_at": pos.created_at.isoformat() if pos.created_at else None,
        })

    return {
        "positions": positions_data,
        "count": len(positions_data),
    }


@router.post("/{position_id}/close")
async def close_position(
    position_id: str,
    body: PositionCloseRequest,
    user_id: str = Depends(get_current_user),
    engine: PaperEngine = Depends(get_paper_engine),
):
    try:
        result = await engine.close_position(
            position_id=position_id,
            quantity=body.quantity,
            user_id=UUID(user_id),
        )
        return result
    except AppException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
