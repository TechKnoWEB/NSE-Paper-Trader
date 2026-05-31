import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDMixin


class Trade(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "trades"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    position_id: Mapped[UUID | None] = mapped_column(ForeignKey("positions.id"), nullable=True)

    security_id: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    underlying: Mapped[str] = mapped_column(String(20), nullable=False)
    strike_price: Mapped[int] = mapped_column(Integer, nullable=False)
    option_type: Mapped[str] = mapped_column(String(2), nullable=False)
    expiry_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)

    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    exit_price: Mapped[int] = mapped_column(BigInteger, nullable=False)

    gross_pnl: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_charges: Mapped[int] = mapped_column(BigInteger, nullable=False)
    net_pnl: Mapped[int] = mapped_column(BigInteger, nullable=False)

    entry_greeks: Mapped[dict | None] = mapped_column(JSON, nullable=False, default=dict)
    exit_greeks: Mapped[dict | None] = mapped_column(JSON, nullable=False, default=dict)
    entry_iv: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    exit_iv: Mapped[float | None] = mapped_column(Numeric(8, 4), nullable=True)
    entry_spot: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    exit_spot: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    entry_timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    strategy_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", back_populates="trades", lazy="selectin")
    position = relationship("Position", back_populates="trades", lazy="selectin")
