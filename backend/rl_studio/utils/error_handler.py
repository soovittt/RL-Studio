"""
Error handling utilities for consistent error handling across the application.
"""
import logging
import traceback
from typing import Any, Callable, Dict, Optional, Type, TypeVar
from functools import wraps

from ..exceptions import RLStudioError, NetworkError, TimeoutError

logger = logging.getLogger(__name__)

T = TypeVar("T")


def handle_error(
    error: Exception,
    default_message: str = "An error occurred",
    log_level: int = logging.ERROR,
    include_traceback: bool = True,
    context: Optional[Dict[str, Any]] = None,
) -> RLStudioError:
    """
    Convert any exception to RLStudioError with proper context.

    Args:
        error: The original exception
        default_message: Default message if error has no message
        log_level: Logging level (logging.ERROR, logging.WARNING, etc.)
        include_traceback: Whether to include traceback in log
        context: Additional context to add

    Returns:
        RLStudioError with preserved context
    """
    # If already an RLStudioError, just log and return
    if isinstance(error, RLStudioError):
        if include_traceback:
            logger.log(
                log_level,
                f"[{error.error_code}] {error.user_message} (ID: {error.error_id})",
                exc_info=error.original_error or error,
                extra={"error_id": error.error_id, "context": error.context},
            )
        else:
            logger.log(
                log_level,
                f"[{error.error_code}] {error.user_message} (ID: {error.error_id})",
                extra={"error_id": error.error_id, "context": error.context},
            )
        return error

    # Convert to appropriate RLStudioError
    error_message = str(error) or default_message
    error_type = type(error).__name__

    # Map common exceptions to RLStudioError types
    if isinstance(error, (ConnectionError, OSError)):
        rl_error = NetworkError(
            error_message,
            original_error=error,
            context=context or {},
        )
    elif isinstance(error, TimeoutError):
        rl_error = TimeoutError(
            error_message,
            original_error=error,
            context=context or {},
        )
    else:
        # Generic error
        rl_error = RLStudioError(
            error_message,
            error_code=f"UNKNOWN_ERROR_{error_type}",
            original_error=error,
            context=context or {},
        )

    # Log with context
    if include_traceback:
        logger.log(
            log_level,
            f"[{rl_error.error_code}] {rl_error.user_message} (ID: {rl_error.error_id})",
            exc_info=error,
            extra={"error_id": rl_error.error_id, "context": rl_error.context},
        )
    else:
        logger.log(
            log_level,
            f"[{rl_error.error_code}] {rl_error.user_message} (ID: {rl_error.error_id})",
            extra={"error_id": rl_error.error_id, "context": rl_error.context},
        )

    return rl_error


def safe_execute(
    func: Callable[[], T],
    default: Optional[T] = None,
    error_message: str = "Operation failed",
    log_error: bool = True,
    context: Optional[Dict[str, Any]] = None,
) -> Optional[T]:
    """
    Safely execute a function, catching all exceptions and returning default.

    Use this for non-critical operations that shouldn't break the system.

    Args:
        func: Function to execute
        default: Value to return on error
        error_message: Error message prefix
        log_error: Whether to log the error
        context: Additional context

    Returns:
        Function result or default value
    """
    try:
        return func()
    except Exception as e:
        if log_error:
            handle_error(e, error_message, context=context)
        return default


def retry_on_error(
    max_retries: int = 3,
    retryable_exceptions: tuple = (NetworkError, TimeoutError),
    delay: float = 1.0,
    backoff: float = 2.0,
):
    """
    Decorator to retry function on retryable errors.

    Args:
        max_retries: Maximum number of retries
        retryable_exceptions: Tuple of exception types to retry
        delay: Initial delay between retries (seconds)
        backoff: Backoff multiplier
    """
    import time

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_error = e
                    if attempt < max_retries and e.retryable:
                        logger.warning(
                            f"Retryable error (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                            f"Retrying in {current_delay}s..."
                        )
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        break
                except Exception as e:
                    # Non-retryable error, re-raise immediately
                    raise

            # All retries exhausted
            if last_error:
                logger.error(
                    f"Failed after {max_retries + 1} attempts: {last_error}"
                )
                raise last_error
            raise Exception("Unexpected error in retry logic")

        return wrapper

    return decorator


def error_handler(
    default_message: str = "An error occurred",
    log_level: int = logging.ERROR,
    reraise: bool = True,
):
    """
    Decorator to handle errors in functions consistently.

    Args:
        default_message: Default error message
        log_level: Logging level
        reraise: Whether to re-raise the error (False = return None)
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                rl_error = handle_error(
                    e,
                    default_message,
                    log_level,
                    context={"function": func.__name__, "args": str(args)[:100]},
                )
                if reraise:
                    raise rl_error
                return None

        return wrapper

    return decorator

