import datetime
from datetime import date, datetime, time, timedelta, timezone

from src.config.market_calendar import (
    MARKET_CLOSE_TIME,
    MARKET_OPEN_TIME,
    PRE_OPEN_END,
    PRE_OPEN_START,
    is_holiday,
    is_trading_day,
)

IST = timezone(timedelta(hours=5, minutes=30))


def get_ist_now() -> datetime:
    return datetime.now(IST)


def is_market_open() -> bool:
    now = get_ist_now()
    if not is_trading_day(now.date()):
        return False
    return MARKET_OPEN_TIME <= now.time() < MARKET_CLOSE_TIME


def is_pre_open() -> bool:
    now = get_ist_now()
    if not is_trading_day(now.date()):
        return False
    return PRE_OPEN_START <= now.time() < PRE_OPEN_END


def is_market_closed() -> bool:
    now = get_ist_now()
    if not is_trading_day(now.date()):
        return True
    return now.time() >= MARKET_CLOSE_TIME


def is_holiday_today() -> bool:
    return is_holiday(get_ist_now().date())


def get_time_to_expiry_years(expiry_date: date) -> float:
    now = get_ist_now().date()
    days_diff = (expiry_date - now).days
    return max(days_diff, 0) / 365.25


def get_current_expiry(reference_date: date | None = None) -> date:
    ref = reference_date or get_ist_now().date()
    days_ahead = 3 - ref.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    expiry = ref + timedelta(days=days_ahead)
    while is_holiday(expiry):
        expiry -= timedelta(days=1)
    return expiry


def format_ist(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST)
    return ist_dt.strftime("%Y-%m-%d %H:%M:%S IST")


def to_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
