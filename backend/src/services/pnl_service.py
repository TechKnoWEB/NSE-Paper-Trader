from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User
from src.models.trade import Trade

logger = logging.getLogger(__name__)


class PnLService:
    @staticmethod
    def compute_unrealized_pnl(current_ltp: int, avg_entry: int, quantity: int, direction: str) -> int:
        multiplier = 1 if direction.upper() == "LONG" else -1
        return (current_ltp - avg_entry) * quantity * multiplier

    @staticmethod
    def compute_portfolio_unrealized_pnl(positions: list[dict], ltps: dict[str, int]) -> int:
        total = 0
        for pos in positions:
            sid = pos.get("security_id", "")
            ltp = ltps.get(sid)
            if ltp is None:
                continue
            total += PnLService.compute_unrealized_pnl(
                current_ltp=ltp,
                avg_entry=int(pos.get("avg_entry_price", 0)),
                quantity=int(pos.get("quantity", 0)),
                direction=pos.get("direction", "LONG"),
            )
        return total

    async def get_pnl_history(self, db: AsyncSession, user_id: UUID, days: int = 30) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)

        result = await db.execute(
            select(
                func.date(Trade.exit_timestamp).label("date"),
                func.sum(Trade.net_pnl).label("pnl"),
                func.count(Trade.id).label("trade_count"),
            )
            .where(
                Trade.user_id == user_id,
                Trade.exit_timestamp >= since,
            )
            .group_by(func.date(Trade.exit_timestamp))
            .order_by(func.date(Trade.exit_timestamp))
        )

        rows = result.all()
        return [
            {
                "date": str(row.date),
                "pnl": int(row.pnl),
                "trade_count": int(row.trade_count),
            }
            for row in rows
        ]

    async def get_analytics_summary(self, db: AsyncSession, user_id: UUID) -> dict:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            return {}

        trades_result = await db.execute(
            select(
                func.count(Trade.id).label("total_trades"),
                func.sum(Trade.net_pnl).label("total_realized_pnl"),
                func.sum(case((Trade.net_pnl > 0, Trade.net_pnl), else_=0)).label("gross_profit"),
                func.sum(case((Trade.net_pnl < 0, Trade.net_pnl), else_=0)).label("gross_loss"),
                func.count(case((Trade.net_pnl > 0, 1))).label("winning_trades"),
                func.count(case((Trade.net_pnl < 0, 1))).label("losing_trades"),
            ).where(Trade.user_id == user_id)
        )
        row = trades_result.one()

        total_trades = int(row.total_trades) if row.total_trades else 0
        winning_trades = int(row.winning_trades) if row.winning_trades else 0
        win_rate = round(winning_trades / total_trades * 100, 2) if total_trades > 0 else 0.0

        return {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": int(row.losing_trades) if row.losing_trades else 0,
            "win_rate": win_rate,
            "gross_profit": int(row.gross_profit) if row.gross_profit else 0,
            "gross_loss": int(row.gross_loss) if row.gross_loss else 0,
            "net_realized_pnl": int(row.total_realized_pnl) if row.total_realized_pnl else 0,
            "virtual_cash": user.virtual_cash,
            "margin_used": user.margin_used,
            "total_equity": user.total_equity,
        }
