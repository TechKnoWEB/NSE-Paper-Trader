from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api import auth, historical, market_feed, option_chain, paper_orders, portfolio, positions, strategy, ws
from src.config.settings import settings
from src.middleware.rate_limit import RateLimiter
from src.middleware.request_logger import RequestLoggingMiddleware
from src.models import Base, engine, SessionFactory
from src.services.cache_service import CacheService
from src.services.dhan_client import DhanClient
from src.services.greeks_service import GreeksService
from src.services.margin_service import MarginService
from src.services.notification_service import NotificationService
from src.services.paper_engine import PaperEngine
from src.services.pnl_service import PnLService
from src.utils.exceptions import AppException
from src.utils.ist_clock import get_ist_now, is_market_open

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created / verified")


async def check_limit_orders_job():
    try:
        app_state = getattr(check_limit_orders_job, "app_state", None)
        if app_state is None:
            return
        paper_engine: PaperEngine = app_state.get("paper_engine")
        if paper_engine:
            filled = await paper_engine.check_limit_orders()
            if filled:
                logger.info("Filled %d limit orders", len(filled))
    except Exception:
        logger.exception("Limit order check failed")


async def expire_positions_job():
    try:
        app_state = getattr(expire_positions_job, "app_state", None)
        if app_state is None:
            return
        paper_engine: PaperEngine = app_state.get("paper_engine")
        if paper_engine:
            today = date.today()
            settled = await paper_engine.expire_positions(today)
            if settled:
                logger.info("Settled %d expiring positions", len(settled))
    except Exception:
        logger.exception("Position expiry job failed")


async def reset_day_start_cash_job():
    try:
        app_state = getattr(reset_day_start_cash_job, "app_state", None)
        if app_state is None:
            return
        async with SessionFactory() as db:
            from sqlalchemy import select, update
            from src.models.user import User
            result = await db.execute(select(User))
            users = result.scalars().all()
            for user in users:
                user.day_start_cash = user.virtual_cash
                user.trading_halted = False
                db.add(user)
            await db.commit()
            logger.info("Reset day_start_cash for %d users", len(users))
    except Exception:
        logger.exception("Day start cash reset job failed")


async def cleanup_expired_data_job():
    try:
        async with SessionFactory() as db:
            from sqlalchemy import delete
            from src.models.paper_order import PaperOrder
            cutoff = datetime.now(timezone.utc)
            result = await db.execute(
                delete(PaperOrder).where(
                    PaperOrder.deleted_at.isnot(None),
                    PaperOrder.deleted_at < cutoff,
                )
            )
            if result.rowcount > 0:
                logger.info("Cleaned up %d soft-deleted orders", result.rowcount)
            await db.commit()
    except Exception:
        logger.exception("Data cleanup job failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NSE Paper Trader API...")

    try:
        await init_db()
        logger.info("Database tables created / verified")
    except Exception as e:
        logger.warning("Database init failed (will retry on first use): %s", e)

    cache_service = CacheService()
    redis_available = False
    try:
        await cache_service._get_redis()
        redis_available = True
        logger.info("Redis cache initialized")
    except Exception as e:
        logger.warning("Redis unavailable — caching disabled: %s", e)

    dhan_client = DhanClient()
    logger.info("Dhan API client initialized")

    margin_service = MarginService()
    pnl_service = PnLService()
    greeks_service = GreeksService()
    notification_service = NotificationService()

    paper_engine = PaperEngine(
        db_factory=SessionFactory,
        cache=cache_service,
        dhan=dhan_client,
        margin_service=margin_service,
        pnl_service=pnl_service,
        notification_service=notification_service,
    )

    rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

    app.state.cache_service = cache_service
    app.state.dhan_client = dhan_client
    app.state.paper_engine = paper_engine
    app.state.margin_service = margin_service
    app.state.pnl_service = pnl_service
    app.state.greeks_service = greeks_service
    app.state.notification_service = notification_service
    app.state.rate_limiter = rate_limiter

    app_state_ref = {
        "paper_engine": paper_engine,
    }
    check_limit_orders_job.app_state = app_state_ref
    expire_positions_job.app_state = app_state_ref
    reset_day_start_cash_job.app_state = app_state_ref

    scheduler.add_job(
        check_limit_orders_job,
        "interval",
        seconds=5,
        id="check_limit_orders",
        replace_existing=True,
    )

    scheduler.add_job(
        expire_positions_job,
        "cron",
        hour=15,
        minute=30,
        day_of_week="mon-fri",
        id="expire_positions",
        replace_existing=True,
    )

    scheduler.add_job(
        reset_day_start_cash_job,
        "cron",
        hour=9,
        minute=5,
        day_of_week="mon-fri",
        id="reset_day_start_cash",
        replace_existing=True,
    )

    scheduler.add_job(
        cleanup_expired_data_job,
        "cron",
        hour=2,
        minute=0,
        id="cleanup_expired_data",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with all jobs")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")

    await dhan_client.close()
    await cache_service.close()
    await engine.dispose()
    logger.info("NSE Paper Trader API shut down")


app = FastAPI(
    title="NSE Paper Trader API",
    version="1.0.0",
    description="Backend API for NSE Paper Trader - virtual options trading platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(auth.router)
app.include_router(paper_orders.router)
app.include_router(positions.router)
app.include_router(option_chain.router)
app.include_router(market_feed.router)
app.include_router(historical.router)
app.include_router(portfolio.router)
app.include_router(strategy.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    dhan = getattr(app.state, "dhan_client", None)
    dhan_status = "unknown"
    if dhan:
        try:
            dhan_status = (await dhan.check_health()).get("status", "unknown")
        except Exception:
            dhan_status = "error"

    cache = getattr(app.state, "cache_service", None)
    redis_status = "connected" if cache else "unavailable"

    return {
        "status": "ok",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "market_open": is_market_open(),
        "ist_time": get_ist_now().isoformat(),
        "services": {
            "dhan_api": dhan_status,
            "redis": redis_status,
            "scheduler": scheduler.running,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )
