"""
Tests for Asset Service
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
def client(app, mock_convex_client, sample_user_id, sample_project_id, sample_asset_type_id):
    """Create test client"""
    # Pre-populate asset type
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
    return TestClient(app)


def test_create_asset(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test creating a new asset"""
    # Add asset type to mock with key
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
    
    # Mock the getByKey query
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Wall",
            "geometry": {
                "primitive": "box",
                "params": {"width": 1, "height": 0.1, "depth": 1}
            },
            "visualProfile": {"color": "#1b263b"},
            "physicsProfile": {"collider": "box", "static": True},
            "behaviorProfile": {},
            "meta": {"tags": ["wall", "grid"], "mode": "grid", "palette": "primary"},
            "createdBy": sample_user_id,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "id" in data  # API returns "id" not "assetId"
    assert data["name"] == "Test Wall"
    
    # Verify asset was created with geometry
    assets = mock_convex_client.data["assets"]
    assert len(assets) == 1
    assert assets[0]["name"] == "Test Wall"
    assert assets[0].get("geometry") is not None
    assert assets[0]["geometry"]["primitive"] == "box"


def test_get_asset(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test getting an asset"""
    # Add asset type and mock query
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create asset first
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Wall",
            "visualProfile": {"color": "#1b263b"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    asset_id = create_response.json()["id"]
    
    # Get it
    response = client.get(f"/api/assets/{asset_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Wall"


def test_list_assets(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test listing assets with filters"""
    # Add asset type and mock query
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create multiple assets
    for name in ["Wall", "Agent", "Goal"]:
        client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": name,
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {"mode": "grid", "tags": [name.lower()]},
                "createdBy": sample_user_id,
            }
        )
    
    # List all
    response = client.get("/api/assets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    
    # Filter by mode
    response = client.get("/api/assets?mode=grid")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_update_asset(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test updating an asset"""
    # Add asset type and mock query
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
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
            "name": "Test Wall",
            "visualProfile": {"color": "#1b263b"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    asset_id = create_response.json()["id"]
    
    # Update it
    response = client.patch(
        f"/api/assets/{asset_id}",
        json={
            "name": "Updated Wall",
            "visualProfile": {"color": "#ff0000"},
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Wall"
    assert data["visualProfile"]["color"] == "#ff0000"


def test_delete_asset(client, mock_convex_client, sample_user_id, sample_asset_type_id):
    """Test deleting an asset"""
    # Add asset type and mock query
    mock_convex_client.data["assetTypes"].append({
        "_id": sample_asset_type_id,
        "key": "tile",
        "displayName": "Tile",
    })
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
            "name": "Test Wall",
            "visualProfile": {},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    asset_id = create_response.json()["id"]
    
    # Delete it
    response = client.delete(f"/api/assets/{asset_id}")
    assert response.status_code == 200
    
    # Verify it's gone from mock data
    assets = mock_convex_client.data["assets"]
    assert len([a for a in assets if a.get("_id") == asset_id]) == 0

