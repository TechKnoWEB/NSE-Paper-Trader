from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class MarginService:
    @staticmethod
    def compute(order_type: str, fill_price_paise: int, quantity: int, strike_price: int, lot_size: int, action: str) -> int:
        action_upper = action.upper()

        if action_upper in ("BUY", "LONG"):
            return fill_price_paise * quantity

        if action_upper in ("SELL", "SHORT"):
            if lot_size <= 0:
                return 0
            lots = quantity // lot_size
            strike_rupees = strike_price / 100.0 if strike_price > 1000 else strike_price
            notional_value_paise = int(strike_rupees * 100 * lot_size * lots)
            span_margin = int(notional_value_paise * 0.15)
            exposure_margin = int(notional_value_paise * 0.03)
            return span_margin + exposure_margin

        return 0

    @staticmethod
    def compute_release(close_quantity: int, total_quantity: int, total_margin_blocked: int) -> int:
        if total_quantity <= 0:
            return 0
        ratio = close_quantity / total_quantity
        return int(ratio * total_margin_blocked)
