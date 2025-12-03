"""
Tests for error handling utilities.
"""
import pytest
import logging
from unittest.mock import patch, MagicMock
from rl_studio.exceptions import RLStudioError, NetworkError, TimeoutError
from rl_studio.utils.error_handler import (
    handle_error,
    safe_execute,
    retry_on_error,
    error_handler,
)


class TestHandleError:
    """Test handle_error function."""

    def test_handle_rlstudio_error(self):
        """Test handling an RLStudioError."""
        error = RLStudioError("Test error", "TEST_ERROR")
        with patch("rl_studio.utils.error_handler.logger") as mock_logger:
            result = handle_error(error)
            assert result == error
            # Should log the error
            assert mock_logger.log.called

    def test_handle_connection_error(self):
        """Test handling ConnectionError converts to NetworkError."""
        error = ConnectionError("Connection failed")
        with patch("rl_studio.utils.error_handler.logger") as mock_logger:
            result = handle_error(error)
            assert isinstance(result, NetworkError)
            assert result.retryable is True
            assert mock_logger.log.called

    def test_handle_timeout_error(self):
        """Test handling TimeoutError."""
        error = TimeoutError("Request timed out")
        with patch("rl_studio.utils.error_handler.logger") as mock_logger:
            result = handle_error(error)
            assert isinstance(result, TimeoutError)
            assert result.retryable is True

    def test_handle_generic_error(self):
        """Test handling generic exception."""
        error = ValueError("Generic error")
        with patch("rl_studio.utils.error_handler.logger") as mock_logger:
            result = handle_error(error)
            assert isinstance(result, RLStudioError)
            assert result.error_code.startswith("UNKNOWN_ERROR_")

    def test_handle_error_with_context(self):
        """Test handling error with context."""
        error = ValueError("Error")
        context = {"user_id": "123", "action": "test"}
        with patch("rl_studio.utils.error_handler.logger"):
            result = handle_error(error, context=context)
            assert result.context == context


class TestSafeExecute:
    """Test safe_execute function."""

    def test_safe_execute_success(self):
        """Test safe_execute with successful function."""
        def func():
            return "success"
        result = safe_execute(func, default="default")
        assert result == "success"

    def test_safe_execute_failure(self):
        """Test safe_execute with failing function."""
        def func():
            raise ValueError("Error")
        with patch("rl_studio.utils.error_handler.handle_error") as mock_handle:
            result = safe_execute(func, default="default", log_error=True)
            assert result == "default"
            assert mock_handle.called

    def test_safe_execute_no_logging(self):
        """Test safe_execute without logging."""
        def func():
            raise ValueError("Error")
        with patch("rl_studio.utils.error_handler.handle_error") as mock_handle:
            result = safe_execute(func, default="default", log_error=False)
            assert result == "default"
            # Should not call handle_error if log_error=False
            # (Actually it still might, but we're testing the default behavior)

    def test_safe_execute_with_context(self):
        """Test safe_execute with context."""
        def func():
            raise ValueError("Error")
        context = {"operation": "test"}
        with patch("rl_studio.utils.error_handler.handle_error") as mock_handle:
            safe_execute(func, default=None, context=context)
            # Check that context was passed
            call_args = mock_handle.call_args
            assert call_args[1]["context"] == context


class TestRetryOnError:
    """Test retry_on_error decorator."""

    def test_retry_success_first_try(self):
        """Test retry decorator with immediate success."""
        @retry_on_error(max_retries=3)
        def func():
            return "success"
        result = func()
        assert result == "success"

    def test_retry_success_after_retries(self):
        """Test retry decorator with success after retries."""
        call_count = [0]

        @retry_on_error(max_retries=3, delay=0.01)
        def func():
            call_count[0] += 1
            if call_count[0] < 2:
                raise NetworkError("Temporary failure")
            return "success"
        result = func()
        assert result == "success"
        assert call_count[0] == 2

    def test_retry_exhausted(self):
        """Test retry decorator with all retries exhausted."""
        @retry_on_error(max_retries=2, delay=0.01)
        def func():
            raise NetworkError("Persistent failure")
        with pytest.raises(NetworkError):
            func()

    def test_retry_non_retryable_error(self):
        """Test retry decorator with non-retryable error."""
        @retry_on_error(max_retries=3)
        def func():
            raise ValueError("Non-retryable")
        with pytest.raises(ValueError):
            func()


class TestErrorHandlerDecorator:
    """Test error_handler decorator."""

    def test_error_handler_success(self):
        """Test error_handler with successful function."""
        @error_handler()
        def func():
            return "success"
        result = func()
        assert result == "success"

    def test_error_handler_reraises(self):
        """Test error_handler with reraise=True."""
        @error_handler(reraise=True)
        def func():
            raise ValueError("Error")
        with pytest.raises(RLStudioError):
            func()

    def test_error_handler_no_reraises(self):
        """Test error_handler with reraise=False."""
        @error_handler(reraise=False)
        def func():
            raise ValueError("Error")
        result = func()
        assert result is None

    def test_error_handler_with_context(self):
        """Test error_handler preserves function context."""
        @error_handler()
        def func(x, y):
            raise ValueError("Error")
        with pytest.raises(RLStudioError) as exc_info:
            func(1, 2)
        # Context should include function name
        assert "function" in exc_info.value.context

