from __future__ import annotations

import logging
from typing import Any

import httpx

from src.config.settings import settings
from src.utils.exceptions import DhanAPIError, DhanAuthError, DhanRateLimitError

logger = logging.getLogger(__name__)

DHAN_BASE = "https://api.dhan.co/v2"

ENDPOINTS = {
    "option_chain": "/optionchain",
    "quote": "/marketfeed/quote",
    "historical": "/charts/historical",
    "expiry": "/expirylist",
    "funds": "/funds",
    "orders": "/orders",
}


class DhanClient:
    def __init__(self, client_id: str | None = None, access_token: str | None = None):
        self.client_id = client_id or settings.DHAN_CLIENT_ID
        self.access_token = access_token or settings.DHAN_ACCESS_TOKEN
        self._http: httpx.AsyncClient | None = None

    async def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(
                base_url=DHAN_BASE,
                headers={
                    "access-token": self.access_token,
                    "client-id": self.client_id,
                    "Accept": "application/json",
                },
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
        return self._http

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        client = await self._get_http()
        try:
            resp = await client.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise DhanAPIError("Dhan API request timed out.")
        except httpx.RequestError as exc:
            raise DhanAPIError(f"Dhan API connection error: {exc}")

        if resp.status_code == 401:
            raise DhanAuthError()
        if resp.status_code == 429:
            raise DhanRateLimitError()

        try:
            data = resp.json()
        except Exception:
            raise DhanAPIError(f"Invalid JSON response from Dhan API: {resp.text[:500]}")

        if resp.status_code >= 400:
            msg = data.get("remarks") or data.get("message") or "Unknown Dhan API error"
            raise DhanAPIError(msg, status_code=resp.status_code)

        return data

    async def get_option_chain(self, symbol: str, expiry_date: str) -> dict:
        data = await self._request(
            "GET",
            ENDPOINTS["option_chain"],
            params={"UnderlyingScrip": symbol, "Expiry": expiry_date},
        )
        return data

    async def get_quotes(self, security_ids: list[str]) -> dict:
        if not security_ids:
            return {}
        payload = [{"securityId": sid} for sid in security_ids]
        data = await self._request("POST", ENDPOINTS["quote"], json=payload)
        return data

    async def get_historical(
        self,
        security_id: str,
        exchange_segment: str,
        instrument: str,
        from_date: str,
        to_date: str,
        interval: str,
    ) -> dict:
        data = await self._request(
            "GET",
            ENDPOINTS["historical"],
            params={
                "securityId": security_id,
                "exchangeSegment": exchange_segment,
                "instrument": instrument,
                "fromDate": from_date,
                "toDate": to_date,
                "interval": interval,
            },
        )
        return data

    async def get_expiry_list(self, symbol: str) -> list[str]:
        data = await self._request(
            "GET",
            ENDPOINTS["expiry"],
            params={"UnderlyingScrip": symbol},
        )
        raw = data if isinstance(data, list) else data.get("expiryList", data.get("data", []))
        return [str(e) for e in raw]

    async def get_fund_limits(self) -> dict:
        data = await self._request("GET", ENDPOINTS["funds"])
        return data

    async def check_health(self) -> dict:
        try:
            await self.get_fund_limits()
            return {"status": "ok", "provider": "dhan"}
        except DhanAuthError:
            return {"status": "auth_error", "provider": "dhan"}
        except Exception as exc:
            return {"status": "error", "provider": "dhan", "detail": str(exc)}

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()
