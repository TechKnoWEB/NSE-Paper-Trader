from fastapi import HTTPException, status


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DhanAuthError(AppException):
    def __init__(self, message: str = "Dhan API authentication failed. Check your API credentials."):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class DhanRateLimitError(AppException):
    def __init__(self, message: str = "Dhan API rate limit exceeded. Retry after 1 second."):
        super().__init__(message, status_code=status.HTTP_429_TOO_MANY_REQUESTS)


class DhanAPIError(AppException):
    def __init__(self, message: str = "Dhan API returned an error.", status_code: int = 502):
        super().__init__(message, status_code=status_code)


class MarketClosedError(AppException):
    def __init__(self, message: str = "Market is closed. Orders can only be placed during market hours (09:15 - 15:30 IST on trading days)."):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


class InsufficientMarginError(AppException):
    def __init__(self, message: str = "Insufficient virtual margin available for this order."):
        super().__init__(message, status_code=status.HTTP_402_PAYMENT_REQUIRED)


class InvalidLotSizeError(AppException):
    def __init__(self, message: str = "Order quantity must be a positive multiple of the instrument's lot size."):
        super().__init__(message, status_code=status.HTTP_400_BAD_REQUEST)


class OrderNotCancellableError(AppException):
    def __init__(self, status: str = ""):
        msg = f"Order cannot be cancelled. Current status: {status}" if status else "Order cannot be cancelled in its current state."
        super().__init__(msg, status_code=status.HTTP_409_CONFLICT)


class PositionNotFoundError(AppException):
    def __init__(self, message: str = "Position not found."):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict."):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)


class NotFoundError(AppException):
    def __init__(self, message: str = "Resource not found."):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


def app_exception_handler(request, exc: AppException):
    raise HTTPException(status_code=exc.status_code, detail=exc.message)
