from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from src.api.schemas import StrategyPayoffRequest
from src.deps import get_current_user, get_greeks_service
from src.services.greeks_service import GreeksService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategy", tags=["strategy"])


@router.post("/payoff")
async def compute_payoff(
    body: StrategyPayoffRequest,
    user_id: str = Depends(get_current_user),
    greeks_svc: GreeksService = Depends(get_greeks_service),
):
    if not body.legs:
        raise HTTPException(400, "At least one leg is required")

    spot_min = body.spot_price * (1.0 - body.spot_range_pct)
    spot_max = body.spot_price * (1.0 + body.spot_range_pct)
    step = (spot_max - spot_min) / body.steps

    legs_dicts = [leg.model_dump() for leg in body.legs]

    scenario = {}
    if body.iv_shift is not None:
        scenario["iv_shift"] = body.iv_shift
    if body.days_shift is not None:
        scenario["days_forward"] = body.days_shift

    payoff_table = greeks_svc.compute_payoff_table(
        legs=legs_dicts,
        spot_min=spot_min,
        spot_max=spot_max,
        step=step,
        scenario=scenario if scenario else None,
    )

    breakevens = greeks_svc.compute_breakevens(payoff_table)

    pnls = [row["pnl"] for row in payoff_table]
    max_profit = max(pnls) if pnls else 0.0
    max_loss = min(pnls) if pnls else 0.0

    return {
        "breakevens": breakevens,
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "payoff_table": payoff_table,
        "spot_current": body.spot_price,
        "spot_range": {
            "min": round(spot_min, 2),
            "max": round(spot_max, 2),
        },
    }
