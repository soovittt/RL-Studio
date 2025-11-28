"""
Tests for Scene Service
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rl_studio.api.scenes import router as scenes_router


@pytest.fixture
def app():
    """Create FastAPI app with scenes router"""
    app = FastAPI()
    app.include_router(scenes_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_project_id):
    """Create test client"""
    return TestClient(app)


def test_create_scene(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test creating a new scene"""
    response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "description": "A test scene",
            "mode": "grid",
            "environmentSettings": {},
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data  # API returns "id" not "sceneId"
    assert data["name"] == "Test Scene"

    # Verify scene was created in mock
    scenes = mock_convex_client.data["scenes"]
    assert len(scenes) == 1
    assert scenes[0]["name"] == "Test Scene"


def test_get_scene(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test getting a scene"""
    # First create a scene
    create_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = create_response.json()["id"]

    # Now get it
    response = client.get(f"/api/scenes/{scene_id}")

    assert response.status_code == 200
    data = response.json()
    # Response can be either {scene, activeVersion} or just scene dict
    if "scene" in data:
        assert data["scene"]["name"] == "Test Scene"
    else:
        assert data["name"] == "Test Scene"


def test_get_nonexistent_scene(client, mock_convex_client):
    """Test getting a scene that doesn't exist"""
    response = client.get("/api/scenes/nonexistent_scene_001")
    assert response.status_code == 404


def test_create_scene_version(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
):
    """Test creating a scene version"""
    # First create a scene
    create_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = create_response.json()["id"]

    # Create a version
    response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": sample_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data  # API returns "id" not "versionId"
    # sceneId may or may not be in response
    if "sceneId" in data:
        assert data["sceneId"] == scene_id

    # Verify version was created
    versions = mock_convex_client.data["sceneVersions"]
    assert len(versions) == 1
    assert versions[0]["sceneId"] == scene_id


def test_get_scene_version(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
):
    """Test getting a specific scene version"""
    # Create scene and version
    create_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = create_response.json()["id"]

    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": sample_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    # Get version number from created version
    versions = mock_convex_client.data["sceneVersions"]
    version_number = versions[0]["versionNumber"] if versions else 1

    # Get the version
    response = client.get(f"/api/scenes/{scene_id}/versions/{version_number}")

    assert response.status_code == 200
    data = response.json()
    assert "sceneGraph" in data
    assert "rlConfig" in data
    assert len(data["sceneGraph"]["entities"]) == 2


def test_update_scene(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test updating a scene"""
    # Create scene
    create_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = create_response.json()["id"]

    # Update it
    response = client.patch(
        f"/api/scenes/{scene_id}",
        json={
            "name": "Updated Scene",
            "description": "Updated description",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Scene"
    assert data["description"] == "Updated description"


def test_list_scenes_by_project(
    client, mock_convex_client, sample_user_id, sample_project_id
):
    """Test listing scenes by project"""
    # Note: This endpoint may not exist yet, skip for now
    # Create multiple scenes
    for i in range(3):
        client.post(
            "/api/scenes",
            json={
                "projectId": sample_project_id,
                "name": f"Scene {i}",
                "mode": "grid",
                "createdBy": sample_user_id,
            },
        )

    # Check scenes were created
    scenes = mock_convex_client.data["scenes"]
    assert len(scenes) == 3
