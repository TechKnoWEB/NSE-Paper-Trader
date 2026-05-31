from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    display_name: str | None = None


class RegisterResponse(BaseModel):
    user_id: str
    email: str
    message: str = "Account created. Check email for confirmation."


class SessionResponse(BaseModel):
    supabase_user_id: str
    email: str
    display_name: str | None = None
    virtual_balance: int
    local_user_id: str
    subscription_tier: str = "free"


class DhanLinkRequest(BaseModel):
    dhan_client_id: str
    dhan_access_token: str


class DhanLinkResponse(BaseModel):
    message: str = "Dhan account linked successfully"


class PaperOrderCreate(BaseModel):
    action: str
    order_type: str = "MARKET"
    symbol: str
    quantity: int
    security_id: str
    strike_price: int
    option_type: str
    expiry_date: str
    exchange_segment: str = "NSE_FNO"
    lot_size: int | None = None
    limit_price: int | None = None
    trigger_price: int | None = None
    underlying: str | None = None
    strategy_tag: str | None = None
    notes: str | None = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        v = v.upper()
        if v not in ("BUY", "SELL"):
            raise ValueError("action must be BUY or SELL")
        return v

    @field_validator("order_type")
    @classmethod
    def validate_order_type(cls, v: str) -> str:
        v = v.upper()
        if v not in ("MARKET", "LIMIT", "SL"):
            raise ValueError("order_type must be MARKET, LIMIT, or SL")
        return v

    @field_validator("option_type")
    @classmethod
    def validate_option_type(cls, v: str) -> str:
        v = v.upper()
        if v not in ("CE", "PE"):
            raise ValueError("option_type must be CE or PE")
        return v


class PositionCloseRequest(BaseModel):
    quantity: int

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


class StrategyLeg(BaseModel):
    entry_price: float
    quantity: int = 1
    direction: str = "LONG"
    strike_price: float
    option_type: str = "CE"
    iv: float = 0.20
    time_to_expiry: float = Field(default=7 / 365, description="Time to expiry in years")

    @field_validator("direction")
    @classmethod
    def validate_direction(cls, v: str) -> str:
        v = v.upper()
        if v not in ("LONG", "SHORT"):
            raise ValueError("direction must be LONG or SHORT")
        return v

    @field_validator("option_type")
    @classmethod
    def validate_option_type(cls, v: str) -> str:
        v = v.upper()
        if v not in ("CE", "PE"):
            raise ValueError("option_type must be CE or PE")
        return v


class StrategyPayoffRequest(BaseModel):
    legs: list[StrategyLeg]
    spot_price: float
    spot_range_pct: float = 0.15
    steps: int = 100
    iv_shift: float | None = None
    days_shift: int | None = None
