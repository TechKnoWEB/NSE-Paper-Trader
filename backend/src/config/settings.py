from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DHAN_CLIENT_ID: str = ""
    DHAN_ACCESS_TOKEN: str = ""
    DATABASE_URL: str = "sqlite+aiosqlite:///./nse_paper_trader.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    SECRET_KEY: str = "change_me_in_production"
    PAPER_TRADING_CAPITAL: int = 200000
    ENVIRONMENT: str = "development"
    BACKEND_PORT: int = 8000
    FRONTEND_PORT: int = 5173
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    RISK_FREE_RATE: float = 0.065
    OPTION_CHAIN_CACHE_TTL_MARKET: int = 30
    OPTION_CHAIN_CACHE_TTL_POSTMARKET: int = 3600
    QUOTE_CACHE_TTL: int = 5
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"
    JWT_EXPIRY_HOURS: int = 24

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
