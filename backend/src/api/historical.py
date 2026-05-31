from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from src.config.instruments import get_instrument
from src.deps import get_cache_service, get_current_user, get_dhan_client
from src.services.cache_service import CacheService
from src.services.dhan_client import DhanClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/charts", tags=["charts"])


@router.get("/historical")
async def get_historical(
    security_id: str = Query(..., min_length=1),
    from_date: str = Query(..., min_length=8),
    to_date: str = Query(..., min_length=8),
    interval: str = Query("1", regex="^(1|3|5|10|15|30|60|D|W|M)$"),
    exchange_segment: str = Query("NSE_FNO"),
    instrument_type: str = Query("OPTIDX"),
    user_id: str = Depends(get_current_user),
    cache: CacheService = Depends(get_cache_service),
    dhan: DhanClient = Depends(get_dhan_client),
):
    cached = await cache.get_historical(security_id, interval, from_date, to_date)
    if cached is not None:
        return cached

    try:
        data = await dhan.get_historical(
            security_id=security_id,
            exchange_segment=exchange_segment,
            instrument=instrument_type,
            from_date=from_date,
            to_date=to_date,
            interval=interval,
        )
    except Exception as exc:
        raise HTTPException(502, f"Dhan API error: {exc}")

    if data:
        await cache.set_historical(security_id, interval, from_date, to_date, data)

    return data
