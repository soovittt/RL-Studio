"""
Tests for custom exception classes and error handling.
"""
import pytest
from rl_studio.exceptions import (
    RLStudioError,
    ValidationError,
    APIError,
    TrainingError,
    RolloutError,
    NetworkError,
    TimeoutError,
    ConvexError,
    NotFoundError,
    AuthenticationError,
)


class TestRLStudioError:
    """Test base RLStudioError class."""

    def test_basic_error_creation(self):
        """Test creating a basic error."""
        error = RLStudioError("Test error", "TEST_ERROR")
        assert str(error) == "[TEST_ERROR] Test error (ID: " + error.error_id + ")"
        assert error.error_code == "TEST_ERROR"
        assert error.user_message == "Test error"
        assert error.error_id is not None
        assert len(error.error_id) == 8

    def test_error_with_context(self):
        """Test error with context."""
        context = {"user_id": "123", "action": "test"}
        error = RLStudioError("Test error", "TEST_ERROR", context=context)
        assert error.context == context
        assert error.to_dict()["context"] == context

    def test_error_with_user_message(self):
        """Test error with custom user message."""
        error = RLStudioError(
            "Technical error", "TEST_ERROR", user_message="User-friendly message"
        )
        assert error.user_message == "User-friendly message"
        assert str(error) != "Technical error"  # Should use user message

    def test_error_to_dict(self):
        """Test error serialization to dict."""
        error = RLStudioError("Test error", "TEST_ERROR", retryable=True)
        error_dict = error.to_dict()
        assert error_dict["error_code"] == "TEST_ERROR"
        assert error_dict["message"] == "Test error"
        assert error_dict["error_id"] == error.error_id
        assert error_dict["retryable"] is True

    def test_error_with_original_error(self):
        """Test error preserving original exception."""
        original = ValueError("Original error")
        error = RLStudioError("Wrapped error", "TEST_ERROR", original_error=original)
        assert error.original_error == original


class TestValidationError:
    """Test ValidationError class."""

    def test_validation_error_creation(self):
        """Test creating validation error."""
        error = ValidationError("Invalid input", field="email")
        assert error.error_code == "VALIDATION_ERROR"
        assert error.context["field"] == "email"

    def test_validation_error_without_field(self):
        """Test validation error without field."""
        error = ValidationError("Invalid input")
        assert error.error_code == "VALIDATION_ERROR"
        assert "field" not in error.context or error.context.get("field") is None


class TestAPIError:
    """Test APIError class."""

    def test_api_error_creation(self):
        """Test creating API error."""
        error = APIError("API error", status_code=400)
        assert error.error_code == "API_ERROR"
        assert error.status_code == 400

    def test_api_error_default_status(self):
        """Test API error with default status code."""
        error = APIError("API error")
        assert error.status_code == 500


class TestTrainingError:
    """Test TrainingError class."""

    def test_training_error_creation(self):
        """Test creating training error."""
        error = TrainingError("Training failed", run_id="run123")
        assert error.error_code == "TRAINING_ERROR"
        assert error.context["run_id"] == "run123"

    def test_training_error_without_run_id(self):
        """Test training error without run_id."""
        error = TrainingError("Training failed")
        assert error.error_code == "TRAINING_ERROR"
        assert "run_id" not in error.context or error.context.get("run_id") is None


class TestNetworkError:
    """Test NetworkError class."""

    def test_network_error_retryable(self):
        """Test that network errors are retryable."""
        error = NetworkError("Connection failed")
        assert error.retryable is True
        assert error.error_code == "NETWORK_ERROR"


class TestTimeoutError:
    """Test TimeoutError class."""

    def test_timeout_error_retryable(self):
        """Test that timeout errors are retryable."""
        error = TimeoutError("Request timed out")
        assert error.retryable is True
        assert error.error_code == "TIMEOUT_ERROR"


class TestConvexError:
    """Test ConvexError class."""

    def test_convex_error_creation(self):
        """Test creating Convex error."""
        error = ConvexError("Convex connection failed", retryable=True)
        assert error.error_code == "CONVEX_ERROR"
        assert error.context["service"] == "Convex"
        assert error.retryable is True


class TestNotFoundError:
    """Test NotFoundError class."""

    def test_not_found_error_creation(self):
        """Test creating not found error."""
        error = NotFoundError("User", resource_id="user123")
        assert error.error_code == "NOT_FOUND"
        assert error.status_code == 404
        assert error.context["resource"] == "User"
        assert error.context["resource_id"] == "user123"


class TestAuthenticationError:
    """Test AuthenticationError class."""

    def test_authentication_error_creation(self):
        """Test creating authentication error."""
        error = AuthenticationError("Invalid credentials")
        assert error.error_code == "AUTH_ERROR"
        assert error.status_code == 401


class TestErrorInheritance:
    """Test error inheritance and polymorphism."""

    def test_error_isinstance(self):
        """Test isinstance checks."""
        error = ValidationError("Invalid")
        assert isinstance(error, RLStudioError)
        assert isinstance(error, ValidationError)

    def test_error_inheritance_chain(self):
        """Test error inheritance chain."""
        error = NotFoundError("Resource", "id123")
        assert isinstance(error, RLStudioError)
        assert isinstance(error, APIError)
        assert isinstance(error, NotFoundError)

