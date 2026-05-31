from __future__ import annotations

import json
import logging
from typing import Any, Callable
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, dispatch_fn: Callable[[str, dict], Any] | None = None):
        self._dispatch = dispatch_fn

    async def send_trade_confirmation(self, user_id: str | UUID, order: dict) -> None:
        payload = {
            "type": "TRADE_CONFIRMATION",
            "data": {
                "order_id": str(order.get("id", "")),
                "security_id": order.get("security_id", ""),
                "symbol": order.get("symbol", ""),
                "action": order.get("action", ""),
                "quantity": order.get("quantity", 0),
                "fill_price": order.get("fill_price"),
                "status": order.get("status", ""),
                "total_charges": order.get("total_charges", 0),
                "margin_blocked": order.get("margin_blocked", 0),
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def send_sl_triggered(self, user_id: str | UUID, position: dict, trade: dict) -> None:
        payload = {
            "type": "SL_TRIGGERED",
            "data": {
                "position_id": str(position.get("id", "")),
                "symbol": position.get("symbol", ""),
                "strike_price": position.get("strike_price", 0),
                "option_type": position.get("option_type", ""),
                "entry_price": position.get("avg_entry_price", 0),
                "exit_price": trade.get("exit_price", 0),
                "quantity": trade.get("quantity", 0),
                "pnl": trade.get("net_pnl", 0),
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def send_margin_alert(self, user_id: str | UUID, utilization_pct: float, level: str) -> None:
        payload = {
            "type": "MARGIN_ALERT",
            "data": {
                "utilization": round(utilization_pct, 4),
                "level": level,
                "message": f"Margin utilization at {utilization_pct:.1%} ({level})",
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def send_mtm_update(self, user_id: str | UUID, daily_pnl: int, total_pnl: int) -> None:
        payload = {
            "type": "MTM_UPDATE",
            "data": {
                "daily_pnl": daily_pnl,
                "total_pnl": total_pnl,
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def send_expiry_warning(self, user_id: str | UUID, count: int, symbols: list[str]) -> None:
        payload = {
            "type": "EXPIRY_WARNING",
            "data": {
                "count": count,
                "symbols": symbols,
                "expiry_at": "15:30 IST",
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def send_trading_halted(self, user_id: str | UUID, reason: str) -> None:
        payload = {
            "type": "TRADING_HALTED",
            "data": {
                "reason": reason,
            },
        }
        await self._try_dispatch(str(user_id), payload)

    async def _try_dispatch(self, user_id: str, payload: dict) -> None:
        if self._dispatch is None:
            return
        try:
            await self._dispatch(user_id, payload)
        except Exception:
            logger.exception("Failed to dispatch notification to user %s", user_id)
