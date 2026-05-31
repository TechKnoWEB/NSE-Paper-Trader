from __future__ import annotations

from dataclasses import dataclass


@dataclass
class InstrumentInfo:
    symbol: str
    name: str
    lot_size: int
    strike_interval: int
    exchange_segment: str = "NSE_FNO"


INSTRUMENTS: dict[str, InstrumentInfo] = {
    "NIFTY": InstrumentInfo(
        symbol="NIFTY",
        name="NIFTY 50",
        lot_size=75,
        strike_interval=50,
    ),
    "BANKNIFTY": InstrumentInfo(
        symbol="BANKNIFTY",
        name="Bank NIFTY",
        lot_size=15,
        strike_interval=100,
    ),
    "FINNIFTY": InstrumentInfo(
        symbol="FINNIFTY",
        name="Fin NIFTY",
        lot_size=40,
        strike_interval=50,
    ),
    "MIDCPNIFTY": InstrumentInfo(
        symbol="MIDCPNIFTY",
        name="Midcap NIFTY",
        lot_size=75,
        strike_interval=50,
    ),
    "SENSEX": InstrumentInfo(
        symbol="SENSEX",
        name="SENSEX",
        lot_size=10,
        strike_interval=100,
    ),
}


def get_instrument(symbol: str) -> InstrumentInfo | None:
    return INSTRUMENTS.get(symbol.upper())


def get_lot_size(symbol: str) -> int:
    inst = get_instrument(symbol)
    if inst is None:
        raise ValueError(f"Unknown instrument: {symbol}")
    return inst.lot_size


def get_strike_interval(symbol: str) -> int:
    inst = get_instrument(symbol)
    if inst is None:
        raise ValueError(f"Unknown instrument: {symbol}")
    return inst.strike_interval


def validate_quantity(symbol: str, quantity: int) -> bool:
    inst = get_instrument(symbol)
    if inst is None:
        return False
    return quantity > 0 and quantity % inst.lot_size == 0
