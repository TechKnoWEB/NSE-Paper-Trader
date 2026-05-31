from __future__ import annotations

from jose import jwt
from fastapi import HTTPException

from src.config.settings import settings

ALGORITHM = "HS256"


def validate_supabase_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[ALGORITHM],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Supabase token expired")
    except jwt.JWTError:
        raise HTTPException(401, "Invalid Supabase token")
