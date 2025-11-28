"""
Tests for Admin Service
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rl_studio.api.admin import router as admin_router


@pytest.fixture
def app():
    """Create FastAPI app with admin router"""
    app = FastAPI()
    app.include_router(admin_router)
    return app


@pytest.fixture
def client(app, mock_convex_client):
    """Create test client"""
    return TestClient(app)


def test_admin_health(client):
    """Test admin health check"""
    response = client.get("/api/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "convex_connected" in data
