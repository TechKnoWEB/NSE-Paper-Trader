from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.config.instruments import get_instrument, validate_quantity
from src.models.paper_order import PaperOrder
from src.models.position import Position
from src.models.trade import Trade
from src.models.user import User
from src.services.cache_service import CacheService
from src.services.charges import compute_charges
from src.services.dhan_client import DhanClient
from src.services.margin_service import MarginService
from src.services.notification_service import NotificationService
from src.services.pnl_service import PnLService
from src.services.slippage import compute_slippage
from src.utils.exceptions import (
    InsufficientMarginError,
    InvalidLotSizeError,
    MarketClosedError,
    NotFoundError,
    OrderNotCancellableError,
    PositionNotFoundError,
)
from src.utils.ist_clock import get_ist_now, is_market_open

logger = logging.getLogger(__name__)


class PaperEngine:
    def __init__(
        self,
        db_factory: async_sessionmaker[AsyncSession],
        cache: CacheService,
        dhan: DhanClient,
        margin_service: MarginService | None = None,
        pnl_service: PnLService | None = None,
        notification_service: NotificationService | None = None,
    ):
        self.db_factory = db_factory
        self.cache = cache
        self.dhan = dhan
        self.margin_service = margin_service or MarginService()
        self.pnl_service = pnl_service or PnLService()
        self.notification = notification_service or NotificationService()

    # ──────────────────────────────────────────────────────────────
    #  FILL PAPER ORDER (MARKET orders → immediate fill)
    # ──────────────────────────────────────────────────────────────

    async def fill_paper_order(self, order_data: dict, user_id: str | UUID) -> dict:
        action = order_data.get("action", "BUY").upper()
        order_type = order_data.get("order_type", "MARKET").upper()
        symbol = order_data.get("symbol", "").upper()
        quantity = int(order_data.get("quantity", 0))
        security_id = order_data.get("security_id", "")
        strike_price = int(order_data.get("strike_price", 0))
        option_type = order_data.get("option_type", "").upper()
        expiry_date = order_data.get("expiry_date")
        if isinstance(expiry_date, str):
            from datetime import date as dt_date
            expiry_date = dt_date.fromisoformat(expiry_date)
        exchange_segment = order_data.get("exchange_segment", "NSE_FNO")
        lot_size = int(order_data.get("lot_size", 0))
        limit_price = order_data.get("limit_price")
        if limit_price is not None:
            limit_price = int(limit_price)
        trigger_price = order_data.get("trigger_price")
        if trigger_price is not None:
            trigger_price = int(trigger_price)
        strategy_tag = order_data.get("strategy_tag")
        notes = order_data.get("notes")

        instrument = get_instrument(symbol)
        if instrument is None:
            raise NotFoundError(f"Instrument not found for symbol: {symbol}")
        if not lot_size:
            lot_size = instrument["lot_size"]
        lot_size = int(lot_size)

        # V1 — Market Hours (allow LIMIT orders when closed)
        if not is_market_open() and order_type == "MARKET":
            raise MarketClosedError()

        # V2 — Instrument Validity
        today = get_ist_now().date()
        if expiry_date and expiry_date < today:
            raise NotFoundError("This contract has already expired.")

        # V3 — Lot Size
        if quantity <= 0:
            raise InvalidLotSizeError("Quantity must be greater than zero.")
        if not validate_quantity(symbol, quantity):
            raise InvalidLotSizeError(
                f"Quantity {quantity} is not a valid lot multiple. Lot size is {lot_size}."
            )

        # V4 — Limit Price validation
        if order_type == "LIMIT":
            if limit_price is None or limit_price <= 0:
                raise InvalidLotSizeError("Limit price must be positive for LIMIT orders.")

        # V5 — Check for self-offsetting position
        direction = "LONG" if action == "BUY" else "SHORT"
        opposite_dir = "SHORT" if direction == "LONG" else "LONG"

        async with self.db_factory() as db:
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if not user:
                raise NotFoundError("User not found.")

            # Check same-direction existing position
            existing_same = await self._find_position(db, user_id, security_id, direction)

            # Check opposite-direction existing position (self-offsetting)
            existing_opp = await self._find_position(db, user_id, security_id, opposite_dir)

            if existing_opp and quantity > existing_opp.quantity:
                notes_existing = notes or ""
                notes = (
                    f"{notes_existing}; Auto-split: closed {existing_opp.quantity} of "
                    f"opposite position, opened net {quantity - existing_opp.quantity} {direction}"
                ).strip()

            # Price discovery
            if order_type == "MARKET":
                ltp = await self._fetch_ltp(security_id)
                slippage_amount = compute_slippage(ltp, strike_price, action, is_index=True)
                fill_price_paise = max(1, ltp + slippage_amount)
            else:
                fill_price_paise = limit_price
                slippage_amount = 0

            # Charges
            charges = compute_charges(fill_price_paise, quantity, action, strike_price)

            # Margin
            margin_required = self.margin_service.compute(
                order_type=order_type,
                fill_price_paise=fill_price_paise,
                quantity=quantity,
                strike_price=strike_price,
                lot_size=lot_size,
                action=action,
            )

            # Determine final status
            if order_type == "LIMIT":
                order_status = "PENDING"
                margin_to_block = margin_required
            else:
                order_status = "FILLED"
                margin_to_block = margin_required

            # Margin check
            if user.margin_used + margin_to_block > user.virtual_cash and order_type == "MARKET":
                raise InsufficientMarginError(
                    f"Insufficient margin. Required: ₹{margin_to_block / 100:,.2f}, "
                    f"Available: ₹{(user.virtual_cash - user.margin_used) / 100:,.2f}"
                )

            if order_type == "MARKET":
                preferences = user.preferences or {}

                # R1-01 — Max order size
                max_lots = int(preferences.get("max_lots_per_order", 50))
                if quantity // lot_size > max_lots:
                    raise InvalidLotSizeError(
                        f"Order exceeds maximum {max_lots} lots per order. "
                        f"Place multiple smaller orders."
                    )

                # R1-02 — Max single position size
                max_pos_lots = int(preferences.get("max_lots_per_position", 100))
                existing_lots = (existing_same.quantity // lot_size) if existing_same else 0
                new_total_lots = existing_lots + (quantity // lot_size)
                if new_total_lots > max_pos_lots:
                    raise InvalidLotSizeError(
                        f"Position would exceed maximum {max_pos_lots} lots. Reduce quantity."
                    )

                # R1-03 — Margin utilization cap
                max_util = float(preferences.get("margin_cap_pct", 0.80))
                post_margin = user.margin_used + margin_to_block
                if post_margin > user.virtual_cash * max_util:
                    raise InsufficientMarginError(
                        "This order would utilize >80% of your virtual capital. "
                        "Consider reducing size."
                    )

                # R1-04 — Expiry proximity warning (just log for now)
                if action == "SELL" and expiry_date:
                    days_to_expiry = (expiry_date - today).days
                    if days_to_expiry <= 1:
                        logger.warning(
                            "User %s: Selling options on expiry day (symbol=%s). Extreme Gamma risk.",
                            user_id, symbol,
                        )

                # R2-03 — Concurrent positions limit
                max_positions = int(preferences.get("max_open_positions", 20))
                if not existing_same and not existing_opp:
                    open_count_result = await db.execute(
                        select(func.count(Position.id)).where(
                            Position.user_id == user_id,
                            Position.deleted_at.is_(None),
                        )
                    )
                    open_count = open_count_result.scalar() or 0
                    if open_count >= max_positions:
                        raise InvalidLotSizeError(
                            f"Maximum {max_positions} open positions reached. "
                            f"Close some positions before opening new ones."
                        )

            # Handle self-offsetting: close opposite first
            self._handle_self_offsetting = None
            if existing_opp:
                close_qty = min(quantity, existing_opp.quantity)
                await self._close_position_internal(
                    db, user, existing_opp, close_qty, fill_price_paise, charges, today
                )
                remaining_qty = quantity - close_qty
                if remaining_qty <= 0:
                    order_status = "FILLED"
                    margin_to_block = 0
                    quantity = close_qty
                    notes = notes or "Closed opposite position (self-offsetting)."

            # Handle self-offsetting residual — add to same-side
            if existing_same and existing_same.quantity > 0:
                if order_type == "MARKET":
                    new_qty = existing_same.quantity + quantity
                    new_avg = (
                        (existing_same.avg_entry_price * existing_same.quantity)
                        + (fill_price_paise * quantity)
                    ) // new_qty
                    existing_same.quantity = new_qty
                    existing_same.avg_entry_price = new_avg
                    existing_same.margin_blocked += margin_to_block
                    db.add(existing_same)
            elif not existing_opp or (existing_opp and quantity > existing_opp.quantity):
                if order_type == "MARKET":
                    net_qty = quantity - (existing_opp.quantity if existing_opp else 0)
                    if net_qty > 0:
                        new_position = Position(
                            user_id=user.id,
                            security_id=security_id,
                            symbol=symbol,
                            underlying=order_data.get("underlying", symbol),
                            strike_price=strike_price,
                            option_type=option_type,
                            expiry_date=expiry_date,
                            exchange_segment=exchange_segment,
                            lot_size=lot_size,
                            direction=direction,
                            quantity=net_qty,
                            avg_entry_price=fill_price_paise,
                            margin_blocked=margin_to_block,
                            strategy_tag=strategy_tag,
                        )
                        db.add(new_position)

            immediate_ltp = fill_price_paise if order_type == "MARKET" else None

            paper_order = PaperOrder(
                user_id=user.id,
                security_id=security_id,
                symbol=symbol,
                underlying=order_data.get("underlying", symbol),
                strike_price=strike_price,
                option_type=option_type,
                expiry_date=expiry_date,
                exchange_segment=exchange_segment,
                lot_size=lot_size,
                action=action,
                order_type=order_type,
                quantity=quantity,
                limit_price=limit_price,
                trigger_price=trigger_price,
                status=order_status,
                fill_price=fill_price_paise if order_status == "FILLED" else None,
                fill_timestamp=datetime.now(timezone.utc) if order_status == "FILLED" else None,
                brokerage=charges["brokerage"],
                stt=charges["stt"],
                exchange_charges=charges["exchange_charges"],
                gst=charges["gst"],
                stamp_duty=charges["stamp_duty"],
                sebi_fee=charges["sebi_fee"],
                total_charges=charges["total_charges"],
                margin_blocked=margin_to_block,
                notes=notes,
                strategy_tag=strategy_tag,
            )
            db.add(paper_order)

            if order_status == "FILLED":
                user.margin_used += margin_to_block

            db.add(user)
            await db.commit()
            await db.refresh(paper_order)

        if order_status == "FILLED":
            await self._check_post_fill_risk(user_id)

        return self._order_to_dict(paper_order)

    # ──────────────────────────────────────────────────────────────
    #  CLOSE POSITION (full or partial)
    # ──────────────────────────────────────────────────────────────

    async def close_position(self, position_id: str, quantity: int, user_id: str | UUID) -> dict:
        async with self.db_factory() as db:
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if not user:
                raise NotFoundError("User not found.")

            pos_result = await db.execute(
                select(Position).where(
                    Position.id == position_id,
                    Position.user_id == user_id,
                    Position.deleted_at.is_(None),
                )
            )
            position = pos_result.scalar_one_or_none()
            if not position:
                raise PositionNotFoundError()

            if quantity <= 0:
                raise InvalidLotSizeError("Close quantity must be positive.")
            if quantity % position.lot_size != 0:
                raise InvalidLotSizeError(
                    f"Close quantity {quantity} is not a valid lot multiple. "
                    f"Lot size is {position.lot_size}."
                )
            if quantity > position.quantity:
                raise InvalidLotSizeError(
                    f"Cannot close {quantity} lots; only {position.quantity} held."
                )

            ltp = await self._fetch_ltp(position.security_id)
            exit_action = "SELL" if position.direction == "LONG" else "BUY"
            slippage_amount = compute_slippage(
                ltp, position.strike_price, exit_action, is_index=True
            )
            exit_price = max(1, ltp + slippage_amount)
            charges = compute_charges(exit_price, quantity, exit_action, position.strike_price)
            direction_sign = 1 if position.direction == "LONG" else -1
            gross_pnl = (exit_price - position.avg_entry_price) * quantity * direction_sign
            net_pnl = gross_pnl - charges["total_charges"]
            released_margin = self.margin_service.compute_release(
                quantity, position.quantity, position.margin_blocked
            )

            today = get_ist_now().date()

            trade = Trade(
                user_id=user.id,
                position_id=position.id,
                security_id=position.security_id,
                symbol=position.symbol,
                underlying=position.underlying,
                strike_price=position.strike_price,
                option_type=position.option_type,
                expiry_date=position.expiry_date,
                direction=position.direction,
                quantity=quantity,
                entry_price=position.avg_entry_price,
                exit_price=exit_price,
                gross_pnl=gross_pnl,
                total_charges=charges["total_charges"],
                net_pnl=net_pnl,
                entry_greeks=position.greeks or {},
                exit_greeks={},
                entry_spot=None,
                exit_spot=None,
                entry_timestamp=position.created_at,
                exit_timestamp=datetime.now(timezone.utc),
                strategy_tag=position.strategy_tag,
            )
            db.add(trade)

            if quantity >= position.quantity:
                await db.execute(
                    update(Position)
                    .where(Position.id == position.id)
                    .values(deleted_at=datetime.now(timezone.utc))
                )
            else:
                position.quantity -= quantity
                position.margin_blocked -= released_margin
                db.add(position)

            user.virtual_cash += net_pnl
            user.total_realized_pnl += net_pnl
            user.margin_used = max(0, user.margin_used - released_margin)
            db.add(user)

            await db.commit()
            await db.refresh(trade)

        await self.notification.send_trade_confirmation(str(user_id), {
            "id": trade.id,
            "security_id": trade.security_id,
            "symbol": trade.symbol,
            "action": "SELL" if exit_action == "SELL" else "BUY",
            "quantity": trade.quantity,
            "fill_price": trade.exit_price,
            "status": "FILLED",
            "total_charges": trade.total_charges,
            "margin_blocked": 0,
        })

        return {
            "trade_id": str(trade.id),
            "position_id": str(position.id),
            "symbol": trade.symbol,
            "quantity": trade.quantity,
            "entry_price": trade.entry_price,
            "exit_price": trade.exit_price,
            "gross_pnl": gross_pnl,
            "total_charges": trade.total_charges,
            "net_pnl": net_pnl,
            "direction": trade.direction,
        }

    # ──────────────────────────────────────────────────────────────
    #  CANCEL PENDING ORDER
    # ──────────────────────────────────────────────────────────────

    async def cancel_order(self, order_id: str, user_id: str | UUID) -> dict:
        async with self.db_factory() as db:
            result = await db.execute(
                select(PaperOrder).where(
                    PaperOrder.id == order_id,
                    PaperOrder.user_id == user_id,
                    PaperOrder.deleted_at.is_(None),
                )
            )
            order = result.scalar_one_or_none()
            if not order:
                raise NotFoundError("Order not found.")
            if order.status != "PENDING":
                raise OrderNotCancellableError(order.status)

            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()

            order.status = "CANCELLED"
            if user and order.margin_blocked > 0:
                user.margin_used = max(0, user.margin_used - order.margin_blocked)
                db.add(user)
            db.add(order)
            await db.commit()
            await db.refresh(order)

        return self._order_to_dict(order)

    # ──────────────────────────────────────────────────────────────
    #  CHECK LIMIT ORDERS (called by scheduler every 5s)
    # ──────────────────────────────────────────────────────────────

    async def check_limit_orders(self) -> list[dict]:
        filled_orders: list[dict] = []
        async with self.db_factory() as db:
            result = await db.execute(
                select(PaperOrder)
                .where(
                    PaperOrder.status == "PENDING",
                    PaperOrder.order_type == "LIMIT",
                    PaperOrder.deleted_at.is_(None),
                )
                .order_by(PaperOrder.created_at.asc())
            )
            pending_orders = result.scalars().all()

            for order in pending_orders:
                ltp = await self._fetch_ltp(order.security_id, raise_on_miss=False)
                if ltp is None:
                    continue

                should_fill = False
                if order.action == "BUY" and ltp <= order.limit_price:
                    should_fill = True
                elif order.action == "SELL" and ltp >= order.limit_price:
                    should_fill = True

                if not should_fill:
                    continue

                charges = compute_charges(
                    order.limit_price, order.quantity, order.action, order.strike_price
                )
                margin_required = self.margin_service.compute(
                    order_type="LIMIT",
                    fill_price_paise=order.limit_price,
                    quantity=order.quantity,
                    strike_price=order.strike_price,
                    lot_size=order.lot_size,
                    action=order.action,
                )

                user_result = await db.execute(
                    select(User).where(User.id == order.user_id)
                )
                user = user_result.scalar_one_or_none()
                if not user:
                    continue

                if user.margin_used + margin_required > user.virtual_cash:
                    logger.warning(
                        "Limit order %s can't fill: insufficient margin for user %s",
                        order.id, user.id,
                    )
                    continue

                direction = "LONG" if order.action == "BUY" else "SHORT"
                existing_same = await self._find_position(db, order.user_id, order.security_id, direction)

                if existing_same:
                    new_qty = existing_same.quantity + order.quantity
                    new_avg = (
                        (existing_same.avg_entry_price * existing_same.quantity)
                        + (order.limit_price * order.quantity)
                    ) // new_qty
                    existing_same.quantity = new_qty
                    existing_same.avg_entry_price = new_avg
                    existing_same.margin_blocked += margin_required
                    db.add(existing_same)
                else:
                    new_position = Position(
                        user_id=order.user_id,
                        security_id=order.security_id,
                        symbol=order.symbol,
                        underlying=order.underlying,
                        strike_price=order.strike_price,
                        option_type=order.option_type,
                        expiry_date=order.expiry_date,
                        exchange_segment=order.exchange_segment,
                        lot_size=order.lot_size,
                        direction=direction,
                        quantity=order.quantity,
                        avg_entry_price=order.limit_price,
                        margin_blocked=margin_required,
                        strategy_tag=order.strategy_tag,
                    )
                    db.add(new_position)

                order.status = "FILLED"
                order.fill_price = order.limit_price
                order.fill_timestamp = datetime.now(timezone.utc)
                order.brokerage = charges["brokerage"]
                order.stt = charges["stt"]
                order.exchange_charges = charges["exchange_charges"]
                order.gst = charges["gst"]
                order.stamp_duty = charges["stamp_duty"]
                order.sebi_fee = charges["sebi_fee"]
                order.total_charges = charges["total_charges"]
                order.margin_blocked = margin_required
                db.add(order)

                user.margin_used += margin_required
                db.add(user)

                await db.flush()
                filled_orders.append(self._order_to_dict(order))

            if pending_orders:
                await db.commit()

        return filled_orders

    # ──────────────────────────────────────────────────────────────
    #  EXPIRE POSITIONS (called at 15:30 IST on expiry day)
    # ──────────────────────────────────────────────────────────────

    async def expire_positions(self, today: date) -> list[dict]:
        settled: list[dict] = []
        async with self.db_factory() as db:
            result = await db.execute(
                select(Position).where(
                    Position.expiry_date == today,
                    Position.deleted_at.is_(None),
                )
            )
            expiring_positions = result.scalars().all()

            for position in expiring_positions:
                ltp = await self._fetch_ltp(position.security_id, raise_on_miss=False)
                if ltp is None:
                    ltp = 5
                ltp_rupees = ltp / 100.0

                is_ce = position.option_type == "CE"
                strike_rupees = position.strike_price / 100.0 if position.strike_price > 1000 else position.strike_price
                spot_rupees = await self._fetch_ltp(
                    self._get_underlying_security_id(position.underlying),
                    raise_on_miss=False,
                )
                if spot_rupees:
                    spot_rupees = spot_rupees / 100.0
                else:
                    spot_rupees = strike_rupees

                if is_ce:
                    intrinsic = max(0.0, spot_rupees - strike_rupees)
                else:
                    intrinsic = max(0.0, strike_rupees - spot_rupees)

                is_worthless = ltp_rupees <= 0.05
                direction_sign = 1 if position.direction == "LONG" else -1

                if is_worthless:
                    settlement_price = 5
                    pnl = (5 - position.avg_entry_price) * position.quantity * direction_sign
                elif (direction_sign == 1 and intrinsic > 0) or (direction_sign == -1 and intrinsic > 0):
                    settlement_price = int(intrinsic * 100)
                    if direction_sign == 1:
                        pnl = (settlement_price - position.avg_entry_price) * position.quantity
                    else:
                        pnl = (position.avg_entry_price - settlement_price) * position.quantity
                else:
                    if direction_sign == 1:
                        pnl = -position.avg_entry_price * position.quantity
                    else:
                        pnl = position.avg_entry_price * position.quantity
                    settlement_price = 5

                exit_action = "SELL" if position.direction == "LONG" else "BUY"
                charges = compute_charges(
                    settlement_price, position.quantity, exit_action, position.strike_price
                )
                net_pnl = pnl - charges["total_charges"]

                trade = Trade(
                    user_id=position.user_id,
                    position_id=position.id,
                    security_id=position.security_id,
                    symbol=position.symbol,
                    underlying=position.underlying,
                    strike_price=position.strike_price,
                    option_type=position.option_type,
                    expiry_date=position.expiry_date,
                    direction=position.direction,
                    quantity=position.quantity,
                    entry_price=position.avg_entry_price,
                    exit_price=settlement_price,
                    gross_pnl=pnl,
                    total_charges=charges["total_charges"],
                    net_pnl=net_pnl,
                    entry_greeks=position.greeks or {},
                    exit_greeks={},
                    entry_timestamp=position.created_at,
                    exit_timestamp=datetime.now(timezone.utc),
                    strategy_tag=position.strategy_tag,
                    notes=f"Auto-expiry settlement at ₹{settlement_price / 100:.2f}",
                )
                db.add(trade)

                await db.execute(
                    update(Position)
                    .where(Position.id == position.id)
                    .values(deleted_at=datetime.now(timezone.utc))
                )

                user_result = await db.execute(
                    select(User).where(User.id == position.user_id)
                )
                user = user_result.scalar_one_or_none()
                if user:
                    user.virtual_cash += net_pnl
                    user.total_realized_pnl += net_pnl
                    user.margin_used = max(0, user.margin_used - position.margin_blocked)
                    db.add(user)

                settled.append({
                    "position_id": str(position.id),
                    "symbol": position.symbol,
                    "settlement_price": settlement_price,
                    "gross_pnl": pnl,
                    "charges": charges["total_charges"],
                    "net_pnl": net_pnl,
                    "user_id": str(position.user_id),
                })

                logger.info(
                    "Position %s (%s) expired. Settlement: ₹%.2f. P&L: ₹%.2f",
                    position.symbol, position.security_id,
                    settlement_price / 100.0, net_pnl / 100.0,
                )

            # Cancel remaining pending limit orders for today's expiry
            await db.execute(
                update(PaperOrder)
                .where(
                    PaperOrder.status == "PENDING",
                    PaperOrder.expiry_date == today,
                    PaperOrder.deleted_at.is_(None),
                )
                .values(
                    status="CANCELLED",
                    notes="Auto-cancelled on expiry day at 15:30 IST.",
                )
            )

            if expiring_positions:
                await db.commit()

        return settled

    # ──────────────────────────────────────────────────────────────
    #  INTERNAL HELPERS
    # ──────────────────────────────────────────────────────────────

    async def _fetch_ltp(self, security_id: str, raise_on_miss: bool = True) -> int:
        ltp = await self.cache.get_ltp(security_id)
        if ltp is not None:
            return ltp

        try:
            quotes = await self.dhan.get_quotes([security_id])
            raw = None
            if isinstance(quotes, dict):
                for val in quotes.values():
                    if isinstance(val, dict):
                        raw = val.get("ltp") or val.get("lastPrice") or val.get("last_price")
                        break
                if raw is None and security_id in quotes:
                    raw = quotes[security_id]
            if raw is not None:
                ltp = int(raw)
                await self.cache.set_quote(security_id, {"ltp": ltp})
                return ltp
        except Exception:
            logger.warning("Failed to fetch LTP for %s from Dhan", security_id, exc_info=True)

        if raise_on_miss:
            raise NotFoundError(f"Could not fetch current price for security {security_id}.")
        return None

    @staticmethod
    def _get_underlying_security_id(underlying: str) -> str:
        from src.config.instruments import INSTRUMENTS
        inst = INSTRUMENTS.get(underlying.upper())
        if inst:
            return inst.get("index_security_id", "13")
        return "13"

    @staticmethod
    async def _find_position(db: AsyncSession, user_id: UUID, security_id: str, direction: str) -> Position | None:
        result = await db.execute(
            select(Position).where(
                Position.user_id == user_id,
                Position.security_id == security_id,
                Position.direction == direction,
                Position.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def _close_position_internal(
        self,
        db: AsyncSession,
        user: User,
        position: Position,
        quantity: int,
        exit_price: int,
        charges: dict,
        today: date,
    ) -> None:
        direction_sign = 1 if position.direction == "LONG" else -1
        gross_pnl = (exit_price - position.avg_entry_price) * quantity * direction_sign
        net_pnl = gross_pnl - charges["total_charges"]
        released_margin = self.margin_service.compute_release(
            quantity, position.quantity, position.margin_blocked
        )

        trade = Trade(
            user_id=user.id,
            position_id=position.id,
            security_id=position.security_id,
            symbol=position.symbol,
            underlying=position.underlying,
            strike_price=position.strike_price,
            option_type=position.option_type,
            expiry_date=position.expiry_date,
            direction=position.direction,
            quantity=quantity,
            entry_price=position.avg_entry_price,
            exit_price=exit_price,
            gross_pnl=gross_pnl,
            total_charges=charges["total_charges"],
            net_pnl=net_pnl,
            entry_greeks=position.greeks or {},
            exit_greeks={},
            entry_timestamp=position.created_at,
            exit_timestamp=datetime.now(timezone.utc),
            strategy_tag=position.strategy_tag,
            notes="Closed via self-offsetting order.",
        )
        db.add(trade)

        if quantity >= position.quantity:
            await db.execute(
                update(Position)
                .where(Position.id == position.id)
                .values(deleted_at=datetime.now(timezone.utc))
            )
        else:
            position.quantity -= quantity
            position.margin_blocked -= released_margin
            db.add(position)

        user.virtual_cash += net_pnl
        user.total_realized_pnl += net_pnl
        user.margin_used = max(0, user.margin_used - released_margin)
        db.add(user)

    async def _check_post_fill_risk(self, user_id: str | UUID) -> None:
        async with self.db_factory() as db:
            user_result = await db.execute(select(User).where(User.id == user_id))
            user = user_result.scalar_one_or_none()
            if not user:
                return

            preferences = user.preferences or {}

            # R2-01 — Daily loss limit
            daily_loss_limit = int(preferences.get("daily_loss_limit", 50000))
            if user.day_start_cash is not None:
                daily_loss = user.day_start_cash - user.virtual_cash
                if daily_loss >= daily_loss_limit:
                    user.trading_halted = True
                    db.add(user)
                    await db.commit()
                    await self.notification.send_trading_halted(
                        str(user_id),
                        f"Daily loss limit reached. Limit: ₹{daily_loss_limit / 100:.2f}",
                    )
                    return

            # R2-02 — Capital preservation floor
            positions_result = await db.execute(
                select(Position).where(
                    Position.user_id == user.id,
                    Position.deleted_at.is_(None),
                )
            )
            positions = positions_result.scalars().all()
            ltps: dict[str, int] = {}
            for pos in positions:
                ltp = await self._fetch_ltp(pos.security_id, raise_on_miss=False)
                if ltp is not None:
                    ltps[pos.security_id] = ltp

            unrealized_pnl = self.pnl_service.compute_portfolio_unrealized_pnl(
                [self._pos_to_dict(p) for p in positions], ltps
            )
            total_equity = user.virtual_cash + unrealized_pnl
            if total_equity < 100000:
                user.trading_halted = True
                db.add(user)
                await db.commit()
                await self.notification.send_trading_halted(
                    str(user_id),
                    "Virtual capital critically low (< ₹1,000). Trading halted.",
                )

    @staticmethod
    def _order_to_dict(order: PaperOrder) -> dict:
        return {
            "id": str(order.id),
            "user_id": str(order.user_id),
            "security_id": order.security_id,
            "symbol": order.symbol,
            "underlying": order.underlying,
            "strike_price": order.strike_price,
            "option_type": order.option_type,
            "expiry_date": str(order.expiry_date) if order.expiry_date else None,
            "exchange_segment": order.exchange_segment,
            "lot_size": order.lot_size,
            "action": order.action,
            "order_type": order.order_type,
            "quantity": order.quantity,
            "limit_price": order.limit_price,
            "trigger_price": order.trigger_price,
            "status": order.status,
            "fill_price": order.fill_price,
            "fill_timestamp": order.fill_timestamp.isoformat() if order.fill_timestamp else None,
            "brokerage": order.brokerage,
            "stt": order.stt,
            "exchange_charges": order.exchange_charges,
            "gst": order.gst,
            "stamp_duty": order.stamp_duty,
            "sebi_fee": order.sebi_fee,
            "total_charges": order.total_charges,
            "margin_blocked": order.margin_blocked,
            "notes": order.notes,
            "strategy_tag": order.strategy_tag,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        }

    @staticmethod
    def _pos_to_dict(pos: Position) -> dict:
        return {
            "id": str(pos.id),
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
            "greeks": pos.greeks or {},
            "last_ltp": pos.last_ltp,
            "stop_loss_pct": pos.stop_loss_pct,
            "strategy_tag": pos.strategy_tag,
        }


