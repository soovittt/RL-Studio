"""
Tests for error handling middleware.
"""
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from rl_studio.exceptions import RLStudioError, APIError, NotFoundError
from rl_studio.middleware.error_middleware import ErrorHandlingMiddleware


@pytest.fixture
def app_with_middleware():
    """Create FastAPI app with error middleware."""
    app = FastAPI()
    app.add_middleware(ErrorHandlingMiddleware)

    @app.get("/success")
    async def success():
        return {"success": True, "message": "OK"}

    @app.get("/rlstudio-error")
    async def rlstudio_error():
        raise RLStudioError("Test error", "TEST_ERROR", user_message="User-friendly error")

    @app.get("/api-error")
    async def api_error():
        raise NotFoundError("Resource", "id123")

    @app.get("/generic-error")
    async def generic_error():
        raise ValueError("Generic error")

    return app


class TestErrorHandlingMiddleware:
    """Test error handling middleware."""

    def test_successful_request(self, app_with_middleware):
        """Test middleware with successful request."""
        client = TestClient(app_with_middleware)
        response = client.get("/success")
        assert response.status_code == 200
        assert "X-Request-ID" in response.headers
        assert response.json() == {"success": True, "message": "OK"}

    def test_rlstudio_error(self, app_with_middleware):
        """Test middleware with RLStudioError."""
        client = TestClient(app_with_middleware)
        response = client.get("/rlstudio-error")
        assert response.status_code == 500
        assert "X-Request-ID" in response.headers
        data = response.json()
        assert data["success"] is False
        assert "error" in data
        assert data["error"]["error_code"] == "TEST_ERROR"
        assert data["error"]["message"] == "User-friendly error"
        assert "error_id" in data["error"]
        assert "request_id" in data

    def test_api_error_status_code(self, app_with_middleware):
        """Test middleware with APIError (should use status_code)."""
        client = TestClient(app_with_middleware)
        response = client.get("/api-error")
        assert response.status_code == 404  # NotFoundError has status_code 404
        data = response.json()
        assert data["success"] is False
        assert data["error"]["error_code"] == "NOT_FOUND"

    def test_generic_error(self, app_with_middleware):
        """Test middleware with generic exception."""
        client = TestClient(app_with_middleware)
        response = client.get("/generic-error")
        assert response.status_code == 500
        data = response.json()
        assert data["success"] is False
        assert data["error"]["error_code"] == "INTERNAL_ERROR"
        assert "request_id" in data
        assert "X-Request-ID" in response.headers

    def test_request_id_present(self, app_with_middleware):
        """Test that request ID is always present."""
        client = TestClient(app_with_middleware)
        response = client.get("/success")
        assert "X-Request-ID" in response.headers
        request_id = response.headers["X-Request-ID"]
        assert len(request_id) == 8  # Short ID

        # Error response should also have request ID
        response = client.get("/rlstudio-error")
        assert "X-Request-ID" in response.headers
        assert response.json()["request_id"] == response.headers["X-Request-ID"]

