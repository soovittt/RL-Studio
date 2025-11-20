"""
Edge case tests for Asset Service
Tests error handling, validation, and edge cases
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from rl_studio.api.assets import router as assets_router


@pytest.fixture
def app():
    """Create FastAPI app with assets router"""
    app = FastAPI()
    app.include_router(assets_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Create test client"""
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
    return TestClient(app)


def test_create_asset_invalid_asset_type(client, mock_convex_client, sample_user_id):
    """Test creating asset with invalid asset type"""
    response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "nonexistent",
            "name": "Test",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


def test_get_nonexistent_asset(client):
    """Test getting asset that doesn't exist"""
    response = client.get("/api/assets/nonexistent_id_12345")
    assert response.status_code == 404


def test_update_nonexistent_asset(client):
    """Test updating asset that doesn't exist"""
    response = client.patch(
        "/api/assets/nonexistent_id_12345",
        json={"name": "Updated"}
    )
    assert response.status_code == 404


def test_delete_nonexistent_asset(client):
    """Test deleting asset that doesn't exist"""
    response = client.delete("/api/assets/nonexistent_id_12345")
    assert response.status_code == 404


def test_delete_asset_with_references(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test deleting asset that is referenced in scene versions"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        elif path == "assets/checkReferences":
            # Simulate asset is referenced
            return [{"sceneId": "scene1", "versionId": "version1", "entityId": "entity1"}]
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create asset
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Referenced Asset",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    asset_id = create_response.json()["id"]
    
    # Try to delete (should fail due to references)
    delete_response = client.delete(f"/api/assets/{asset_id}")
    assert delete_response.status_code == 400
    assert "referenced" in delete_response.json()["detail"].lower()


def test_list_assets_pagination(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test asset listing with pagination"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create 10 assets
    for i in range(10):
        client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": f"Asset {i}",
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {"mode": "grid"},
                "createdBy": sample_user_id,
            }
        )
    
    # List with limit
    response = client.get("/api/assets?limit=5")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 5
    
    # List with offset
    response = client.get("/api/assets?limit=5&offset=5")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 5


def test_list_assets_filter_by_mode(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test filtering assets by mode"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create assets with different modes
    modes = ["grid", "2d", "3d", "grid", "2d"]
    for i, mode in enumerate(modes):
        client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": f"Asset {i}",
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {"mode": mode},
                "createdBy": sample_user_id,
            }
        )
    
    # Filter by grid mode
    response = client.get("/api/assets?mode=grid")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 2
    assert all(a["meta"]["mode"] == "grid" for a in assets)
    
    # Filter by 2d mode
    response = client.get("/api/assets?mode=2d")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 2
    assert all(a["meta"]["mode"] == "2d" for a in assets)


def test_list_assets_filter_by_tag(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test filtering assets by tag"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create assets with different tags
    tags_sets = [
        ["wall", "obstacle"],
        ["agent", "character"],
        ["goal", "reward"],
        ["wall", "grid"],
    ]
    
    for i, tags in enumerate(tags_sets):
        client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": f"Asset {i}",
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {"tags": tags},
                "createdBy": sample_user_id,
            }
        )
    
    # Filter by "wall" tag
    response = client.get("/api/assets?tag=wall")
    assert response.status_code == 200
    assets = response.json()
    # Should have 2 assets with "wall" tag (Asset 0 and Asset 3)
    assert len(assets) >= 2
    assert all("wall" in a["meta"]["tags"] for a in assets)


def test_list_assets_empty_result(client):
    """Test listing assets when none exist"""
    response = client.get("/api/assets")
    assert response.status_code == 200
    assets = response.json()
    assert isinstance(assets, list)
    assert len(assets) == 0


def test_create_asset_missing_required_fields(client, mock_convex_client, sample_user_id):
    """Test creating asset with missing required fields"""
    # Missing name
    response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    assert response.status_code == 422  # Validation error
    
    # Missing assetTypeKey
    response = client.post(
        "/api/assets",
        json={
            "name": "Test",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    assert response.status_code == 422


def test_update_asset_partial(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test partial update of asset (only some fields)"""
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
            "name": "Original",
            "geometry": {"primitive": "box", "params": {"width": 1, "height": 1, "depth": 1}},
            "visualProfile": {"color": "#000000"},
            "physicsProfile": {"mass": 10},
            "behaviorProfile": {"speed": 5},
            "meta": {"tags": ["original"]},
            "createdBy": sample_user_id,
        }
    )
    asset_id = create_response.json()["id"]
    
    # Update only name (other fields should remain unchanged)
    update_response = client.patch(
        f"/api/assets/{asset_id}",
        json={"name": "Updated Name"}
    )
    
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Updated Name"
    # Other fields should still be present
    assert updated["visualProfile"]["color"] == "#000000"
    assert updated["geometry"]["primitive"] == "box"


def test_asset_cache_invalidation(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test that cache is invalidated on create/update/delete"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # List assets (should cache)
    response1 = client.get("/api/assets")
    assert response1.status_code == 200
    
    # Create new asset (should invalidate cache)
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
        }
    )
    assert create_response.status_code == 200
    
    # List again (should see new asset)
    response2 = client.get("/api/assets")
    assert response2.status_code == 200
    # Should have one more asset now
    assert len(response2.json()) == len(response1.json()) + 1

