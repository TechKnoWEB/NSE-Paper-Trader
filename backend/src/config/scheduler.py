from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore


def create_scheduler() -> AsyncIOScheduler:
    jobstores = {
        "default": MemoryJobStore(),
    }

    job_defaults = {
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 300,
    }

    scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        job_defaults=job_defaults,
        timezone="Asia/Kolkata",
    )

    return scheduler


def market_hours_trigger() -> CronTrigger:
    return CronTrigger(
        day_of_week="mon-fri",
        hour="9-15",
        minute="*",
        second="*/30",
        timezone="Asia/Kolkata",
    )


def market_open_trigger() -> CronTrigger:
    return CronTrigger(
        day_of_week="mon-fri",
        hour=9,
        minute=15,
        timezone="Asia/Kolkata",
    )


def market_close_trigger() -> CronTrigger:
    return CronTrigger(
        day_of_week="mon-fri",
        hour=15,
        minute=30,
        timezone="Asia/Kolkata",
    )


def daily_expiry_trigger() -> CronTrigger:
    return CronTrigger(
        day_of_week="mon-fri",
        hour=9,
        minute=0,
        timezone="Asia/Kolkata",
    )
