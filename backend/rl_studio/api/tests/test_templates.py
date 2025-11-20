"""
Tests for Template Service
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from rl_studio.api.templates import router as templates_router


@pytest.fixture
def app():
    """Create FastAPI app with templates router"""
    app = FastAPI()
    app.include_router(templates_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_project_id, sample_scene_graph, sample_rl_config):
    """Create test client with pre-populated template"""
    # Create a template in the mock data
    scene_id = mock_convex_client._generate_id("scene")
    version_id = mock_convex_client._generate_id("version")
    template_id = mock_convex_client._generate_id("template")
    
    # Create scene
    mock_convex_client.data["scenes"].append({
        "_id": scene_id,
        "projectId": sample_project_id,
        "name": "Template Scene",
        "mode": "grid",
        "activeVersionId": version_id,
        "createdBy": sample_user_id,
        "createdAt": 1234567890,
        "updatedAt": 1234567890,
    })
    
    # Create version
    mock_convex_client.data["sceneVersions"].append({
        "_id": version_id,
        "sceneId": scene_id,
        "versionNumber": 1,
        "sceneGraph": sample_scene_graph,
        "rlConfig": sample_rl_config,
        "createdBy": sample_user_id,
        "createdAt": 1234567890,
    })
    
    # Create template
    mock_convex_client.data["templates"].append({
        "_id": template_id,
        "name": "Basic Gridworld",
        "description": "A simple gridworld",
        "sceneVersionId": version_id,
        "category": "grid",
        "tags": ["grid", "navigation"],
        "meta": {"mode": "grid", "difficulty": "beginner"},
        "isPublic": True,
        "createdBy": sample_user_id,
        "createdAt": 1234567890,
    })
    
    return TestClient(app)


def test_list_templates(client, mock_convex_client):
    """Test listing templates"""
    response = client.get("/api/templates")
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Basic Gridworld"


def test_list_templates_with_filters(client, mock_convex_client):
    """Test listing templates with filters"""
    # Filter by category
    response = client.get("/api/templates?category=grid")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    
    # Filter by public
    response = client.get("/api/templates?isPublic=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


def test_get_template(client, mock_convex_client):
    """Test getting a template"""
    template_id = mock_convex_client.data["templates"][0]["_id"]
    
    response = client.get(f"/api/templates/{template_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "template" in data
    assert "sceneVersion" in data
    assert data["template"]["name"] == "Basic Gridworld"
    assert "sceneGraph" in data["sceneVersion"]
    assert "rlConfig" in data["sceneVersion"]


def test_instantiate_template(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test instantiating a template"""
    template_id = mock_convex_client.data["templates"][0]["_id"]
    
    response = client.post(
        f"/api/templates/{template_id}/instantiate",
        json={
            "templateId": template_id,  # Required in request body
            "projectId": sample_project_id,
            "name": "My Gridworld",
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "sceneId" in data
    assert "versionId" in data
    
    # Verify new scene was created
    scenes = mock_convex_client.data["scenes"]
    assert len(scenes) == 2  # Original template scene + new instance
    assert scenes[1]["name"] == "My Gridworld"
    
    # Verify new version was created
    versions = mock_convex_client.data["sceneVersions"]
    assert len(versions) == 2  # Original + copy


def test_instantiate_nonexistent_template(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test instantiating a template that doesn't exist"""
    response = client.post(
        "/api/templates/nonexistent_template_001/instantiate",
        json={
            "templateId": "nonexistent_template_001",
            "projectId": sample_project_id,
            "name": "My Gridworld",
        }
    )
    
    assert response.status_code == 404

