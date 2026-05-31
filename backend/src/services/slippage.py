import random


def _classify_option(ltp_paise: int, strike_price: int) -> str:
    ltp_rupees = ltp_paise / 100.0
    strike_rupees = strike_price / 100.0 if strike_price > 1000 else strike_price

    if strike_rupees <= 0:
        return "ATM"

    diff_ratio = abs(ltp_rupees - strike_rupees) / strike_rupees

    if diff_ratio < 0.05:
        return "ATM"
    if ltp_rupees < 30:
        return "OTM"
    return "ITM"


def compute_slippage(ltp_paise: int, strike_price: int, action: str, is_index: bool = True) -> int:
    delta = 1 if action.upper() in ("BUY", "LONG") else -1

    if action.upper() in ("SELL", "SHORT"):
        classification = _classify_option(ltp_paise, strike_price)
    else:
        classification = _classify_option(ltp_paise, strike_price)

    if is_index:
        if classification == "ATM":
            low, high = 50, 100
        elif classification == "OTM":
            low, high = 100, 300
        else:
            low, high = 100, 300
    else:
        low, high = 200, 500

    raw = random.uniform(low, high)
    slippage = int(round(raw))
    if delta < 0:
        slippage = -slippage

    return slippage
