"""
Tests for cache invalidation behavior
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rl_studio.api.assets import router as assets_router
from rl_studio.api.cache import asset_cache, template_cache
from rl_studio.api.templates import router as templates_router


@pytest.fixture
def app():
    """Create FastAPI app"""
    app = FastAPI()
    app.include_router(assets_router)
    app.include_router(templates_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Create test client"""
    mock_convex_client.data["assetTypes"].append(
        {
            "_id": sample_asset_type_id,
            "key": "tile",
            "displayName": "Tile",
        }
    )
    # Clear caches before each test
    asset_cache.clear()
    template_cache.clear()
    return TestClient(app)


def test_asset_cache_invalidation_on_create(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test that creating asset invalidates list cache"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # First list (populates cache)
    response1 = client.get("/api/assets")
    assert response1.status_code == 200
    count1 = len(response1.json())

    # Create asset
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "New Asset",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    assert create_response.status_code == 200

    # List again (should see new asset, cache invalidated)
    response2 = client.get("/api/assets")
    assert response2.status_code == 200
    count2 = len(response2.json())
    assert count2 == count1 + 1


def test_asset_cache_invalidation_on_update(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test that updating asset invalidates both list and get caches"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Original Name",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # Get asset (populates cache)
    get_response1 = client.get(f"/api/assets/{asset_id}")
    assert get_response1.status_code == 200
    assert get_response1.json()["name"] == "Original Name"

    # Update asset
    update_response = client.patch(
        f"/api/assets/{asset_id}", json={"name": "Updated Name"}
    )
    assert update_response.status_code == 200

    # Get again (should see updated name, cache invalidated)
    get_response2 = client.get(f"/api/assets/{asset_id}")
    assert get_response2.status_code == 200
    assert get_response2.json()["name"] == "Updated Name"


def test_asset_cache_invalidation_on_delete(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test that deleting asset invalidates cache"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        elif path == "assets/checkReferences":
            return []  # No references, safe to delete
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "To Delete",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # List assets
    list_response1 = client.get("/api/assets")
    assert list_response1.status_code == 200
    count1 = len(list_response1.json())

    # Delete asset
    delete_response = client.delete(f"/api/assets/{asset_id}")
    assert delete_response.status_code == 200

    # List again (should have one less, cache invalidated)
    list_response2 = client.get("/api/assets")
    assert list_response2.status_code == 200
    count2 = len(list_response2.json())
    assert count2 == count1 - 1


def test_template_cache_invalidation_on_create(
    client, mock_convex_client, sample_user_id, sample_project_id
):
    """Test that creating template invalidates list cache"""
    # Create scene and version for template
    scene_id = "scene_test_001"
    version_id = "version_test_001"
    mock_convex_client.data["scenes"].append(
        {
            "_id": scene_id,
            "projectId": sample_project_id,
            "name": "Template Scene",
            "mode": "grid",
            "activeVersionId": version_id,
            "createdBy": sample_user_id,
            "createdAt": 1234567890,
            "updatedAt": 1234567890,
        }
    )
    mock_convex_client.data["sceneVersions"].append(
        {
            "_id": version_id,
            "sceneId": scene_id,
            "versionNumber": 1,
            "sceneGraph": {"entities": [], "metadata": {}},
            "rlConfig": {"agents": [], "rewards": [], "episode": {}},
            "createdBy": sample_user_id,
            "createdAt": 1234567890,
        }
    )

    # List templates (populates cache)
    response1 = client.get("/api/templates")
    assert response1.status_code == 200
    count1 = len(response1.json())

    # Create template
    create_response = client.post(
        "/api/templates",
        json={
            "name": "New Template",
            "sceneVersionId": version_id,
            "category": "grid",
            "tags": ["test"],
            "isPublic": True,
            "createdBy": sample_user_id,
        },
    )
    assert create_response.status_code == 200

    # List again (should see new template, cache invalidated)
    response2 = client.get("/api/templates")
    assert response2.status_code == 200
    count2 = len(response2.json())
    assert count2 == count1 + 1
