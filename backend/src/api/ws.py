from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from src.middleware.auth_middleware import validate_supabase_token
from src.models import SessionFactory
from src.models.position import Position
from src.services.cache_service import CacheService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/market-feed")
async def market_feed_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    try:
        payload = validate_supabase_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()

    try:
        async with SessionFactory() as db:
            result = await db.execute(
                select(Position).where(
                    Position.user_id == UUID(user_id),
                    Position.deleted_at.is_(None),
                )
            )
            positions = result.scalars().all()
            security_ids = list({p.security_id for p in positions})

        subscribed_ids = set(security_ids)
        await websocket.send_json({
            "type": "CONNECTED",
            "user_id": user_id,
            "subscribed_securities": list(subscribed_ids),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        cache = CacheService()

        async def send_ticks():
            while True:
                for sid in list(subscribed_ids):
                    quote = await cache.get_quote(sid)
                    if quote:
                        tick = {
                            "type": "TICK",
                            "security_id": sid,
                            "data": quote,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                        try:
                            await websocket.send_json(tick)
                        except Exception:
                            return
                await asyncio.sleep(2)

        tick_task = asyncio.create_task(send_ticks())

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                    msg_type = msg.get("type", "")

                    if msg_type == "SUBSCRIBE":
                        new_ids = msg.get("security_ids", [])
                        if isinstance(new_ids, list):
                            subscribed_ids.update(new_ids)
                            await websocket.send_json({
                                "type": "SUBSCRIBED",
                                "security_ids": list(new_ids),
                            })

                    elif msg_type == "UNSUBSCRIBE":
                        remove_ids = msg.get("security_ids", [])
                        if isinstance(remove_ids, list):
                            subscribed_ids.difference_update(remove_ids)
                            await websocket.send_json({
                                "type": "UNSUBSCRIBED",
                                "security_ids": list(remove_ids),
                            })

                    elif msg_type == "PING":
                        await websocket.send_json({"type": "PONG"})

                except json.JSONDecodeError:
                    await websocket.send_json({"type": "ERROR", "message": "Invalid JSON"})

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected for user %s", user_id)
        finally:
            tick_task.cancel()
            try:
                await tick_task
            except asyncio.CancelledError:
                pass

    except Exception as exc:
        logger.error("WebSocket error for user %s: %s", user_id, exc)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        await cache.close()
