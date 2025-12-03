"""
Custom exception classes for RL Studio with error codes and context preservation.
"""
from typing import Any, Dict, Optional
import traceback
import uuid


class RLStudioError(Exception):
    """Base exception for RL Studio with error context and codes."""

    def __init__(
        self,
        message: str,
        error_code: str,
        user_message: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        retryable: bool = False,
        original_error: Optional[Exception] = None,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.user_message = user_message or message
        self.context = context or {}
        self.retryable = retryable
        self.original_error = original_error
        self.error_id = str(uuid.uuid4())[:8]  # Short error ID for correlation
        self.traceback_str = traceback.format_exc()

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        result = {
            "error_code": self.error_code,
            "message": self.user_message,
            "error_id": self.error_id,
            "retryable": self.retryable,
        }
        if self.context:
            result["context"] = self.context
        return result

    def __str__(self) -> str:
        return f"[{self.error_code}] {self.user_message} (ID: {self.error_id})"


# Validation Errors
class ValidationError(RLStudioError):
    """Error for validation failures."""

    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        context = kwargs.pop("context", {})
        if field:
            context["field"] = field
        super().__init__(
            message, error_code="VALIDATION_ERROR", context=context, **kwargs
        )


class EnvironmentSpecError(ValidationError):
    """Error for invalid environment specifications."""

    def __init__(self, message: str, **kwargs):
        super().__init__(message, error_code="ENV_SPEC_ERROR", **kwargs)


# API Errors
class APIError(RLStudioError):
    """Base class for API-related errors."""

    def __init__(self, message: str, error_code: str = "API_ERROR", status_code: int = 500, **kwargs):
        super().__init__(message, error_code=error_code, **kwargs)
        self.status_code = status_code


class AuthenticationError(APIError):
    """Authentication/authorization errors."""

    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(
            message, error_code="AUTH_ERROR", status_code=401, **kwargs
        )


class NotFoundError(APIError):
    """Resource not found errors."""

    def __init__(self, resource: str, resource_id: Optional[str] = None, **kwargs):
        message = f"{resource} not found"
        if resource_id:
            message += f": {resource_id}"
        context = kwargs.pop("context", {})
        context.update({"resource": resource, "resource_id": resource_id})
        super().__init__(
            message, error_code="NOT_FOUND", status_code=404, context=context, **kwargs
        )


# External Service Errors
class ExternalServiceError(RLStudioError):
    """Errors from external services (Convex, AWS, etc.)."""

    def __init__(
        self,
        service: str,
        message: str,
        retryable: bool = True,
        **kwargs,
    ):
        context = kwargs.pop("context", {})
        context["service"] = service
        super().__init__(
            f"{service} error: {message}",
            error_code=f"{service.upper()}_ERROR",
            context=context,
            retryable=retryable,
            **kwargs,
        )


class ConvexError(ExternalServiceError):
    """Convex database errors."""

    def __init__(self, message: str, retryable: bool = True, **kwargs):
        super().__init__("Convex", message, retryable=retryable, **kwargs)


class AWSError(ExternalServiceError):
    """AWS service errors."""

    def __init__(self, service: str, message: str, retryable: bool = True, **kwargs):
        super().__init__(f"AWS_{service}", message, retryable=retryable, **kwargs)


# Training Errors
class TrainingError(RLStudioError):
    """Training-related errors."""

    def __init__(self, message: str, run_id: Optional[str] = None, **kwargs):
        context = kwargs.pop("context", {})
        if run_id:
            context["run_id"] = run_id
        super().__init__(
            message, error_code="TRAINING_ERROR", context=context, **kwargs
        )


class RolloutError(RLStudioError):
    """Rollout/simulation errors."""

    def __init__(self, message: str, **kwargs):
        super().__init__(message, error_code="ROLLOUT_ERROR", **kwargs)


# Network/Connection Errors
class NetworkError(RLStudioError):
    """Network/connection errors (retryable)."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, error_code="NETWORK_ERROR", retryable=True, **kwargs
        )


class TimeoutError(RLStudioError):
    """Timeout errors (retryable)."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, error_code="TIMEOUT_ERROR", retryable=True, **kwargs
        )


# Configuration Errors
class ConfigurationError(RLStudioError):
    """Configuration/setup errors."""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message, error_code="CONFIG_ERROR", retryable=False, **kwargs
        )

