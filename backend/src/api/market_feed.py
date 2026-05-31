from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from src.deps import get_cache_service, get_current_user, get_dhan_client
from src.services.cache_service import CacheService
from src.services.dhan_client import DhanClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/market-feed", tags=["market_feed"])


@router.get("/quote")
async def get_quote(
    security_ids: str = Query(..., min_length=1),
    user_id: str = Depends(get_current_user),
    cache: CacheService = Depends(get_cache_service),
    dhan: DhanClient = Depends(get_dhan_client),
):
    ids = [s.strip() for s in security_ids.split(",") if s.strip()]
    if not ids:
        raise HTTPException(400, "At least one security_id is required")

    result = {}
    uncached_ids = []
    for sid in ids:
        cached = await cache.get_quote(sid)
        if cached is not None:
            result[sid] = cached
        else:
            uncached_ids.append(sid)

    if uncached_ids:
        try:
            quotes = await dhan.get_quotes(uncached_ids)
            if isinstance(quotes, dict):
                for sid, quote_data in quotes.items():
                    if isinstance(quote_data, dict):
                        result[sid] = quote_data
                        await cache.set_quote(sid, quote_data)
        except Exception as exc:
            logger.warning("Dhan quote fetch failed for %s: %s", uncached_ids, exc)

    return result
