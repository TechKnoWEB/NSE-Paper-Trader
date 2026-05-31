import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import Base, TimestampMixin, UUIDMixin


class PaperOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "paper_orders"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    security_id: Mapped[str] = mapped_column(String(20), nullable=False)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    underlying: Mapped[str] = mapped_column(String(20), nullable=False)
    strike_price: Mapped[int] = mapped_column(Integer, nullable=False)
    option_type: Mapped[str] = mapped_column(String(2), nullable=False)
    expiry_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    exchange_segment: Mapped[str] = mapped_column(String(20), nullable=False)
    lot_size: Mapped[int] = mapped_column(Integer, nullable=False)

    action: Mapped[str] = mapped_column(String(4), nullable=False)
    order_type: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    limit_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    trigger_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    status: Mapped[str] = mapped_column(String(15), nullable=False, default="PENDING", index=True)
    fill_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    fill_timestamp: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    brokerage: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    stt: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    exchange_charges: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    gst: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    stamp_duty: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    sebi_fee: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_charges: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    margin_blocked: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    strategy_tag: Mapped[str | None] = mapped_column(String(50), nullable=True)
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="orders", lazy="selectin")
