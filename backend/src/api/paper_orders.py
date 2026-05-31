from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import PaperOrderCreate
from src.deps import get_current_user, get_paper_engine, get_session
from src.models.paper_order import PaperOrder
from src.services.paper_engine import PaperEngine
from src.utils.exceptions import AppException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/paper/orders", tags=["paper_orders"])


@router.post("")
async def place_order(
    order_data: PaperOrderCreate,
    user_id: str = Depends(get_current_user),
    engine: PaperEngine = Depends(get_paper_engine),
):
    try:
        result = await engine.fill_paper_order(
            order_data=order_data.model_dump(),
            user_id=UUID(user_id),
        )
        return result
    except AppException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("")
async def list_orders(
    status: str | None = Query(None, regex="^(PENDING|FILLED|CANCELLED|REJECTED)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    query = select(PaperOrder).where(
        PaperOrder.user_id == UUID(user_id),
        PaperOrder.deleted_at.is_(None),
    )
    if status:
        query = query.where(PaperOrder.status == status.upper())
    query = query.order_by(PaperOrder.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)

    count_query = select(func.count(PaperOrder.id)).where(
        PaperOrder.user_id == UUID(user_id),
        PaperOrder.deleted_at.is_(None),
    )
    if status:
        count_query = count_query.where(PaperOrder.status == status.upper())

    total = await db.scalar(count_query) or 0
    result = await db.execute(query)
    orders = result.scalars().all()

    return {
        "orders": [
            {
                "id": str(o.id),
                "user_id": str(o.user_id),
                "security_id": o.security_id,
                "symbol": o.symbol,
                "underlying": o.underlying,
                "strike_price": o.strike_price,
                "option_type": o.option_type,
                "expiry_date": str(o.expiry_date) if o.expiry_date else None,
                "exchange_segment": o.exchange_segment,
                "lot_size": o.lot_size,
                "action": o.action,
                "order_type": o.order_type,
                "quantity": o.quantity,
                "limit_price": o.limit_price,
                "trigger_price": o.trigger_price,
                "status": o.status,
                "fill_price": o.fill_price,
                "fill_timestamp": o.fill_timestamp.isoformat() if o.fill_timestamp else None,
                "brokerage": o.brokerage,
                "stt": o.stt,
                "exchange_charges": o.exchange_charges,
                "gst": o.gst,
                "stamp_duty": o.stamp_duty,
                "sebi_fee": o.sebi_fee,
                "total_charges": o.total_charges,
                "margin_blocked": o.margin_blocked,
                "notes": o.notes,
                "strategy_tag": o.strategy_tag,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "updated_at": o.updated_at.isoformat() if o.updated_at else None,
            }
            for o in orders
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    user_id: str = Depends(get_current_user),
    engine: PaperEngine = Depends(get_paper_engine),
):
    try:
        result = await engine.cancel_order(
            order_id=order_id,
            user_id=UUID(user_id),
        )
        return result
    except AppException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
