"""
FastAPI middleware for error handling and request ID tracking.
"""
import logging
import uuid
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ..exceptions import RLStudioError, APIError

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware to handle errors and add request IDs."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            return response
        except RLStudioError as e:
            # Handle RLStudioError with proper status code
            logger.error(
                f"[{e.error_code}] {e.user_message} (Request: {request_id}, Error: {e.error_id})",
                exc_info=e.original_error,
                extra={
                    "request_id": request_id,
                    "error_id": e.error_id,
                    "error_code": e.error_code,
                    "context": e.context,
                },
            )

            status_code = getattr(e, "status_code", 500)
            return JSONResponse(
                status_code=status_code,
                content={
                    "success": False,
                    "error": e.to_dict(),
                    "request_id": request_id,
                },
                headers={"X-Request-ID": request_id},
            )
        except Exception as e:
            # Handle unexpected errors
            error_id = str(uuid.uuid4())[:8]
            logger.error(
                f"Unexpected error: {e} (Request: {request_id}, Error: {error_id})",
                exc_info=True,
                extra={"request_id": request_id, "error_id": error_id},
            )

            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": {
                        "error_code": "INTERNAL_ERROR",
                        "message": "An internal error occurred",
                        "error_id": error_id,
                        "retryable": False,
                    },
                    "request_id": request_id,
                },
                headers={"X-Request-ID": request_id},
            )

