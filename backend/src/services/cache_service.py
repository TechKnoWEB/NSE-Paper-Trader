from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis

from src.config.settings import settings
from src.utils.ist_clock import is_market_open

logger = logging.getLogger(__name__)

QC = "quote_cache"
OC = "option_chain"
HI = "historical"
EX = "expiry_list"
IM = "instruments_master"
WS = "ws_subs"
TK = "ticks"


class CacheService:
    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=5,
                health_check_interval=30,
            )
        return self._redis

    async def _try(self, coro: Any, default: Any = None) -> Any:
        try:
            return await coro
        except (aioredis.RedisError, ConnectionError, OSError) as exc:
            logger.warning("Redis error: %s", exc)
            return default

    # ── Option Chain ──────────────────────────────────────────────

    async def get_option_chain(self, symbol: str, expiry: str) -> dict | None:
        r = await self._get_redis()
        val = await self._try(r.get(f"{OC}:{symbol.upper()}:{expiry}"))
        return json.loads(val) if val else None

    async def set_option_chain(self, symbol: str, expiry: str, data: dict, is_market_open: bool | None = None) -> None:
        r = await self._get_redis()
        market_open = is_market_open if is_market_open is not None else is_market_open()
        ttl = settings.OPTION_CHAIN_CACHE_TTL_MARKET if market_open else settings.OPTION_CHAIN_CACHE_TTL_POSTMARKET
        await self._try(r.setex(f"{OC}:{symbol.upper()}:{expiry}", ttl, json.dumps(data, default=str)))

    # ── Quote / LTP ─────────────────────────────────────────────────

    async def get_quote(self, security_id: str) -> dict | None:
        r = await self._get_redis()
        val = await self._try(r.get(f"{QC}:{security_id}"))
        return json.loads(val) if val else None

    async def set_quote(self, security_id: str, data: dict) -> None:
        r = await self._get_redis()
        await self._try(r.setex(f"{QC}:{security_id}", settings.QUOTE_CACHE_TTL, json.dumps(data, default=str)))

    async def get_ltp(self, security_id: str) -> int | None:
        quote = await self.get_quote(security_id)
        if quote is None:
            return None
        raw = quote.get("ltp") or quote.get("lastPrice") or quote.get("last_price")
        return int(raw) if raw is not None else None

    # ── Historical ─────────────────────────────────────────────────

    async def get_historical(self, security_id: str, interval: str, from_date: str, to_date: str) -> dict | None:
        r = await self._get_redis()
        key = f"{HI}:{security_id}:{interval}:{from_date}:{to_date}"
        val = await self._try(r.get(key))
        return json.loads(val) if val else None

    async def set_historical(self, security_id: str, interval: str, from_date: str, to_date: str, data: dict) -> None:
        r = await self._get_redis()
        key = f"{HI}:{security_id}:{interval}:{from_date}:{to_date}"
        await self._try(r.setex(key, 3600, json.dumps(data, default=str)))

    # ── Expiry List ─────────────────────────────────────────────────

    async def get_expiry_list(self, symbol: str) -> list[str] | None:
        r = await self._get_redis()
        val = await self._try(r.get(f"{EX}:{symbol.upper()}"))
        return json.loads(val) if val else None

    async def set_expiry_list(self, symbol: str, data: list) -> None:
        r = await self._get_redis()
        await self._try(r.setex(f"{EX}:{symbol.upper()}", 3600, json.dumps(data)))

    # ── Instruments Master ─────────────────────────────────────────

    async def get_instruments_master(self) -> dict | None:
        r = await self._get_redis()
        val = await self._try(r.get(IM))
        return json.loads(val) if val else None

    async def set_instruments_master(self, data: dict) -> None:
        r = await self._get_redis()
        await self._try(r.setex(IM, 86400, json.dumps(data, default=str)))

    # ── WebSocket Subscriptions ─────────────────────────────────────

    async def get_ws_subscriptions(self, user_id: str) -> set[str]:
        r = await self._get_redis()
        val = await self._try(r.smembers(f"{WS}:{user_id}"))
        return set(val) if val else set()

    async def add_ws_subscription(self, user_id: str, security_id: str) -> None:
        r = await self._get_redis()
        await self._try(r.sadd(f"{WS}:{user_id}", security_id))

    async def remove_ws_subscription(self, user_id: str, security_id: str) -> None:
        r = await self._get_redis()
        await self._try(r.srem(f"{WS}:{user_id}", security_id))

    # ── Tick Pub/Sub ────────────────────────────────────────────────

    async def publish_tick(self, security_id: str, tick_data: dict) -> None:
        r = await self._get_redis()
        await self._try(r.publish(f"{TK}:{security_id}", json.dumps(tick_data, default=str)))

    # ── Lifecycle ──────────────────────────────────────────────────

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None
