import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    supabase_user_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    virtual_cash: Mapped[int] = mapped_column(BigInteger, nullable=False, default=200000)
    margin_used: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_realized_pnl: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    subscription_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    subscription_expires_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    preferences: Mapped[dict | None] = mapped_column(JSON, nullable=False, default=dict)
    trading_halted: Mapped[bool] = mapped_column(nullable=False, default=False)
    day_start_cash: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    orders = relationship("PaperOrder", back_populates="user", lazy="selectin")
    positions = relationship("Position", back_populates="user", lazy="selectin")
    trades = relationship("Trade", back_populates="user", lazy="selectin")

    @property
    def margin_available(self) -> int:
        return self.virtual_cash - self.margin_used

    @property
    def total_equity(self) -> int:
        return self.virtual_cash + self.total_realized_pnl
