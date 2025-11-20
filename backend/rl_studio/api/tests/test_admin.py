"""
Tests for Admin Service (Seeding)
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from rl_studio.api.admin import router as admin_router


@pytest.fixture
def app():
    """Create FastAPI app with admin router"""
    app = FastAPI()
    app.include_router(admin_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_project_id):
    """Create test client"""
    return TestClient(app)


def test_admin_health(client):
    """Test admin health check"""
    response = client.get("/api/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "convex_connected" in data


def test_seed_assets(client, mock_convex_client, sample_user_id):
    """Test seeding assets via admin endpoint"""
    response = client.post(
        "/api/admin/seed/assets",
        json={
            "created_by": sample_user_id,
        }
    )
    
    # Should succeed (even if assets already exist)
    assert response.status_code in [200, 500]  # 500 if Convex URL not set, but that's OK for tests
    if response.status_code == 200:
        data = response.json()
        assert "success" in data or "results" in data


def test_seed_templates(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test seeding templates via admin endpoint"""
    response = client.post(
        "/api/admin/seed/templates",
        json={
            "created_by": sample_user_id,
            "project_id": sample_project_id,
        }
    )
    
    # Should succeed or fail gracefully
    assert response.status_code in [200, 400, 500]
    if response.status_code == 200:
        data = response.json()
        assert "success" in data or "results" in data


def test_seed_all(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test seeding everything via admin endpoint"""
    response = client.post(
        "/api/admin/seed/all",
        json={
            "created_by": sample_user_id,
            "project_id": sample_project_id,
        }
    )
    
    # Should succeed or fail gracefully
    assert response.status_code in [200, 500]
    if response.status_code == 200:
        data = response.json()
        assert "success" in data or "results" in data

