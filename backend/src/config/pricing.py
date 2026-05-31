from dataclasses import dataclass


@dataclass
class SubscriptionTier:
    key: str
    label: str
    price_monthly: int  # in paise (₹)
    virtual_capital: int  # in paise


TIERS: dict[str, SubscriptionTier] = {
    "free": SubscriptionTier(
        key="free",
        label="Free",
        price_monthly=0,
        virtual_capital=200_000,  # ₹2,000
    ),
    "basic": SubscriptionTier(
        key="basic",
        label="Basic",
        price_monthly=9_900,  # ₹99
        virtual_capital=10_000_000,  # ₹1,00,000
    ),
    "pro": SubscriptionTier(
        key="pro",
        label="Pro",
        price_monthly=29_900,  # ₹299
        virtual_capital=50_000_000,  # ₹50,00,000
    ),
    "elite": SubscriptionTier(
        key="elite",
        label="Elite",
        price_monthly=99_900,  # ₹999
        virtual_capital=100_000_000,  # ₹1,00,00,000
    ),
}


def get_tier_capital(tier_key: str) -> int:
    tier = TIERS.get(tier_key)
    if tier is None:
        return TIERS["free"].virtual_capital
    return tier.virtual_capital
