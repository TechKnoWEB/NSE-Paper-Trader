from __future__ import annotations

import math
from typing import Any

from src.config.settings import settings


class GreeksService:
    def __init__(self, risk_free_rate: float | None = None):
        self.r = risk_free_rate if risk_free_rate is not None else settings.RISK_FREE_RATE

    @staticmethod
    def _norm_pdf(x: float) -> float:
        return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

    @staticmethod
    def _norm_cdf(x: float) -> float:
        if x < 0:
            return 1.0 - GreeksService._norm_cdf(-x)

        k = 1.0 / (1.0 + 0.2316419 * x)
        poly = k * (
            0.319381530
            + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429)))
        )
        return 1.0 - GreeksService._norm_pdf(x) * poly

    def _d1_d2(self, S: float, K: float, T: float, sigma: float) -> tuple[float, float]:
        if T <= 0 or sigma <= 0:
            return (0.0, 0.0)
        sigma_sq = sigma * sigma
        d1 = (math.log(S / K) + (self.r + 0.5 * sigma_sq) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        return d1, d2

    def compute_option_price(self, S: float, K: float, T: float, sigma: float, option_type: str) -> float:
        if T <= 0:
            intrinsic = max(0.0, (S - K) if option_type.upper() == "CE" else (K - S))
            return intrinsic

        d1, d2 = self._d1_d2(S, K, T, sigma)
        is_call = option_type.upper() == "CE"

        if is_call:
            price = S * self._norm_cdf(d1) - K * math.exp(-self.r * T) * self._norm_cdf(d2)
        else:
            price = K * math.exp(-self.r * T) * self._norm_cdf(-d2) - S * self._norm_cdf(-d1)

        return max(price, 0.0)

    def compute_greeks(self, S: float, K: float, T: float, sigma: float, option_type: str) -> dict[str, float]:
        if T <= 0 or sigma <= 0:
            return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

        d1, d2 = self._d1_d2(S, K, T, sigma)
        is_call = option_type.upper() == "CE"
        nd1 = self._norm_cdf(d1)
        pdf_d1 = self._norm_pdf(d1)
        sqrt_T = math.sqrt(T)

        delta = nd1 if is_call else (nd1 - 1.0)

        gamma = pdf_d1 / (S * sigma * sqrt_T)

        term = -S * pdf_d1 * sigma / (2.0 * sqrt_T)
        if is_call:
            theta = (term - self.r * K * math.exp(-self.r * T) * self._norm_cdf(d2)) / 365.0
        else:
            theta = (term + self.r * K * math.exp(-self.r * T) * self._norm_cdf(-d2)) / 365.0

        vega = S * pdf_d1 * sqrt_T / 100.0

        if is_call:
            rho = K * T * math.exp(-self.r * T) * self._norm_cdf(d2) / 100.0
        else:
            rho = -K * T * math.exp(-self.r * T) * self._norm_cdf(-d2) / 100.0

        return {
            "delta": round(delta, 4),
            "gamma": round(gamma, 4),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
            "rho": round(rho, 4),
        }

    def compute_iv(
        self, market_price: float, S: float, K: float, T: float, option_type: str
    ) -> float | None:
        if T <= 0 or market_price <= 0:
            return None

        sigma = 0.30
        max_iter = 100
        tolerance = 0.001

        for _ in range(max_iter):
            price = self.compute_option_price(S, K, T, sigma, option_type)
            diff = price - market_price

            if abs(diff) < tolerance:
                return round(sigma, 4)

            d1, _ = self._d1_d2(S, K, T, sigma)
            pdf_d1 = self._norm_pdf(d1)
            vega_val = S * pdf_d1 * math.sqrt(T)

            if abs(vega_val) < 1e-12:
                return None

            sigma = sigma - diff / vega_val

            if sigma <= 0.001:
                return 0.001

        return None

    def compute_payoff_table(
        self,
        legs: list[dict[str, Any]],
        spot_min: float,
        spot_max: float,
        step: float,
        scenario: dict[str, Any] | None = None,
    ) -> list[dict[str, float]]:
        iv_shift = (scenario or {}).get("iv_shift", 0.0)
        days_forward = (scenario or {}).get("days_forward", 0)

        table: list[dict[str, float]] = []
        spot = spot_min
        while spot <= spot_max + 0.001:
            total_pnl = 0.0
            for leg in legs:
                entry_price = float(leg.get("entry_price", 0))
                qty = int(leg.get("quantity", 1))
                direction = 1 if leg.get("direction", "LONG").upper() == "LONG" else -1

                strike = float(leg.get("strike_price", 0))
                opt_type = leg.get("option_type", "CE")
                original_iv = float(leg.get("iv", 0.20))
                original_T = float(leg.get("time_to_expiry", 7 / 365))

                adj_iv = original_iv + iv_shift
                adj_T = max(original_T - days_forward / 365.0, 0.001)

                theory_price = self.compute_option_price(spot, strike, adj_T, adj_iv, opt_type)
                leg_pnl = (theory_price - entry_price) * qty * direction
                total_pnl += leg_pnl

            table.append({"spot_price": round(spot, 2), "pnl": round(total_pnl, 2)})
            spot += step

        return table

    @staticmethod
    def compute_breakevens(payoff_table: list[dict[str, float]]) -> list[float]:
        breakevens: list[float] = []
        for i in range(1, len(payoff_table)):
            prev = payoff_table[i - 1]
            curr = payoff_table[i]
            if prev["pnl"] * curr["pnl"] <= 0 and abs(prev["pnl"] - curr["pnl"]) > 0.01:
                ratio = abs(prev["pnl"]) / (abs(prev["pnl"]) + abs(curr["pnl"]))
                be = prev["spot_price"] + ratio * (curr["spot_price"] - prev["spot_price"])
                breakevens.append(round(be, 2))
        return sorted(set(round(b, 2) for b in breakevens))

    def compute_portfolio_greeks(self, positions: list[dict[str, Any]]) -> dict[str, float]:
        net = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
        for pos in positions:
            greeks = pos.get("greeks", {})
            qty = int(pos.get("quantity", 0))
            direction = 1 if pos.get("direction", "LONG").upper() == "LONG" else -1
            for greek in net:
                val = float(greeks.get(greek, 0.0))
                net[greek] += val * qty * direction
        return {k: round(v, 4) for k, v in net.items()}
