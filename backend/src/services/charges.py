import math


def compute_charges(fill_price_paise: int, quantity: int, action: str, strike_price: int = 0) -> dict:
    premium_value = fill_price_paise * quantity
    action_upper = action.upper()

    is_buy = action_upper in ("BUY", "LONG")

    stt = 0
    if not is_buy:
        stt = max(0, math.ceil(premium_value * 0.000625))

    exc_charge = max(0, math.ceil(premium_value * 0.00053))

    sebi_fee = max(0, math.ceil(premium_value * 0.0000001))

    brokerage = 2000

    taxable = brokerage + exc_charge + sebi_fee
    gst = max(0, math.ceil(taxable * 0.18))

    stamp_duty = 0
    if is_buy:
        stamp_duty = max(0, math.ceil(premium_value * 0.00003))

    total_charges = brokerage + stt + exc_charge + gst + stamp_duty + sebi_fee

    return {
        "brokerage": brokerage,
        "stt": stt,
        "exchange_charges": exc_charge,
        "gst": gst,
        "stamp_duty": stamp_duty,
        "sebi_fee": sebi_fee,
        "total_charges": total_charges,
    }
