from datetime import date, datetime, time, timedelta
from typing import Self


HOLIDAYS: set[str] = {
    "2025-01-01", "2025-01-26", "2025-03-14", "2025-03-31", "2025-04-10",
    "2025-04-14", "2025-05-01", "2025-08-15", "2025-08-27", "2025-10-02",
    "2025-10-22", "2025-10-23", "2025-11-05", "2025-12-25",
    "2026-01-01", "2026-01-26", "2026-03-06", "2026-03-31", "2026-04-03",
    "2026-04-14", "2026-05-01", "2026-08-15", "2026-09-11", "2026-10-02",
    "2026-10-12", "2026-11-04", "2026-11-06", "2026-12-25",
}

MARKET_OPEN_TIME = time(9, 15)
MARKET_CLOSE_TIME = time(15, 30)
PRE_OPEN_START = time(9, 0)
PRE_OPEN_END = time(9, 15)


def is_holiday(d: date) -> bool:
    return d.strftime("%Y-%m-%d") in HOLIDAYS


def is_trading_day(d: date) -> bool:
    return d.weekday() < 5 and not is_holiday(d)


def is_market_open_now(current_datetime: datetime) -> bool:
    if not is_trading_day(current_datetime.date()):
        return False
    return MARKET_OPEN_TIME <= current_datetime.time() < MARKET_CLOSE_TIME


def is_pre_open_now(current_datetime: datetime) -> bool:
    if not is_trading_day(current_datetime.date()):
        return False
    return PRE_OPEN_START <= current_datetime.time() < MARKET_OPEN_TIME


def is_market_closed_now(current_datetime: datetime) -> bool:
    if not is_trading_day(current_datetime.date()):
        return True
    return current_datetime.time() >= MARKET_CLOSE_TIME


def get_next_trading_day(start: date | None = None) -> date:
    d = (start or date.today()) + timedelta(days=1)
    while not is_trading_day(d):
        d += timedelta(days=1)
    return d


def get_previous_trading_day(start: date | None = None) -> date:
    d = (start or date.today()) - timedelta(days=1)
    while not is_trading_day(d):
        d -= timedelta(days=1)
    return d


def get_current_expiry(reference_date: date | None = None) -> date:
    ref = reference_date or date.today()
    days_ahead = 3 - ref.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    expiry = ref + timedelta(days=days_ahead)
    while is_holiday(expiry):
        expiry -= timedelta(days=1)
    return expiry


def is_samache_saturday(expiry: date) -> bool:
    return expiry.weekday() == 5
