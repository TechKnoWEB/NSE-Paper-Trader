import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDMixin


class Position(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "positions"

    __table_args__ = (
        UniqueConstraint("user_id", "security_id", "direction", "deleted_at", name="uq_user_security_direction"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    security_id: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    underlying: Mapped[str] = mapped_column(String(20), nullable=False)
    strike_price: Mapped[int] = mapped_column(Integer, nullable=False)
    option_type: Mapped[str] = mapped_column(String(2), nullable=False)
    expiry_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    exchange_segment: Mapped[str] = mapped_column(String(20), nullable=False)
    lot_size: Mapped[int] = mapped_column(Integer, nullable=False)

    direction: Mapped[str] = mapped_column(String(5), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_entry_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    margin_blocked: Mapped[int] = mapped_column(BigInteger, nullable=False)

    greeks: Mapped[dict | None] = mapped_column(JSON, nullable=False, default=dict)

    last_ltp: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    last_ltp_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    realized_pnl: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    close_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    closed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    stop_loss_pct: Mapped[float | None] = mapped_column(nullable=True)
    strategy_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)

    user = relationship("User", back_populates="positions", lazy="selectin")
    trades = relationship("Trade", back_populates="position", lazy="selectin")

    @property
    def is_open(self) -> bool:
        return self.deleted_at is None and self.closed_at is None

    @property
    def unrealized_pnl(self) -> int | None:
        if self.last_ltp is None:
            return None
        multiplier = 1 if self.direction == "LONG" else -1
        return (self.last_ltp - self.avg_entry_price) * self.quantity * multiplier

    @property
    def lots_count(self) -> int:
        return self.quantity // self.lot_size if self.lot_size else 0
