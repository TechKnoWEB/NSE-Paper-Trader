from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from src.deps import get_cache_service, get_current_user, get_dhan_client
from src.services.cache_service import CacheService
from src.services.dhan_client import DhanClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/option-chain", tags=["option_chain"])


@router.get("")
async def get_option_chain(
    symbol: str = Query(..., min_length=1),
    expiry: str = Query(..., min_length=8),
    user_id: str = Depends(get_current_user),
    cache: CacheService = Depends(get_cache_service),
    dhan: DhanClient = Depends(get_dhan_client),
):
    cached = await cache.get_option_chain(symbol, expiry)
    if cached is not None:
        return cached

    try:
        data = await dhan.get_option_chain(symbol, expiry)
    except Exception as exc:
        raise HTTPException(502, f"Dhan API error: {exc}")

    if data:
        from src.utils.ist_clock import is_market_open
        await cache.set_option_chain(symbol, expiry, data, is_market_open=is_market_open())

    return data


@router.get("/expirylist")
async def get_expiry_list(
    symbol: str = Query(..., min_length=1),
    user_id: str = Depends(get_current_user),
    cache: CacheService = Depends(get_cache_service),
    dhan: DhanClient = Depends(get_dhan_client),
):
    cached = await cache.get_expiry_list(symbol)
    if cached is not None:
        return {"symbol": symbol.upper(), "expiries": cached}

    try:
        data = await dhan.get_expiry_list(symbol)
    except Exception as exc:
        raise HTTPException(502, f"Dhan API error: {exc}")

    if data:
        await cache.set_expiry_list(symbol, data)

    return {"symbol": symbol.upper(), "expiries": data}
