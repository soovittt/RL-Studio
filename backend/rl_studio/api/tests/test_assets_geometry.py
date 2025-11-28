"""
Comprehensive tests for Asset geometry field
Tests edge cases, validation, and all geometry-related operations
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

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
    # Pre-populate asset type
    mock_convex_client.data["assetTypes"].append(
        {
            "_id": sample_asset_type_id,
            "key": "tile",
            "displayName": "Tile",
        }
    )
    return TestClient(app)


def test_create_asset_with_geometry_box(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test creating asset with box geometry"""
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
            "name": "Box Asset",
            "geometry": {
                "primitive": "box",
                "params": {"width": 2, "height": 1, "depth": 3},
            },
            "visualProfile": {"color": "#ff0000"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data

    # Verify geometry in stored asset
    assets = mock_convex_client.data["assets"]
    assert len(assets) == 1
    assert assets[0]["geometry"]["primitive"] == "box"
    assert assets[0]["geometry"]["params"]["width"] == 2
    assert assets[0]["geometry"]["params"]["height"] == 1
    assert assets[0]["geometry"]["params"]["depth"] == 3


def test_create_asset_with_geometry_sphere(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test creating asset with sphere geometry"""
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
            "name": "Sphere Asset",
            "geometry": {
                "primitive": "sphere",
                "params": {"radius": 0.5, "widthSegments": 16, "heightSegments": 16},
            },
            "visualProfile": {"color": "#00ff00"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    assets = mock_convex_client.data["assets"]
    assert assets[0]["geometry"]["primitive"] == "sphere"
    assert assets[0]["geometry"]["params"]["radius"] == 0.5


def test_create_asset_with_geometry_cylinder(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test creating asset with cylinder geometry"""
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
            "name": "Cylinder Asset",
            "geometry": {
                "primitive": "cylinder",
                "params": {
                    "radiusTop": 0.5,
                    "radiusBottom": 0.5,
                    "height": 1,
                    "radialSegments": 32,
                },
            },
            "visualProfile": {"color": "#0000ff"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    assets = mock_convex_client.data["assets"]
    assert assets[0]["geometry"]["primitive"] == "cylinder"
    assert assets[0]["geometry"]["params"]["height"] == 1


def test_create_asset_without_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test creating asset without geometry (should be optional)"""
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
            "name": "No Geometry Asset",
            "visualProfile": {"color": "#888888"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )

    assert response.status_code == 200
    assets = mock_convex_client.data["assets"]
    assert len(assets) == 1
    # Geometry should be None/undefined if not provided
    assert assets[0].get("geometry") is None or assets[0].get("geometry") == {}


def test_update_asset_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test updating asset geometry"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset with box geometry
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Asset",
            "geometry": {
                "primitive": "box",
                "params": {"width": 1, "height": 1, "depth": 1},
            },
            "visualProfile": {"color": "#000000"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # Update to sphere geometry
    update_response = client.patch(
        f"/api/assets/{asset_id}",
        json={"geometry": {"primitive": "sphere", "params": {"radius": 0.8}}},
    )

    assert update_response.status_code == 200
    updated_asset = update_response.json()
    assert updated_asset["geometry"]["primitive"] == "sphere"
    assert updated_asset["geometry"]["params"]["radius"] == 0.8


def test_update_asset_remove_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test removing geometry from asset (set to null)"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset with geometry
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Asset",
            "geometry": {
                "primitive": "box",
                "params": {"width": 1, "height": 1, "depth": 1},
            },
            "visualProfile": {"color": "#000000"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # Update to remove geometry (set to None)
    # Note: Setting to None might not remove it, but should update it
    update_response = client.patch(f"/api/assets/{asset_id}", json={"geometry": None})

    assert update_response.status_code == 200
    # Verify geometry was updated (may be None or removed)
    updated_asset = update_response.json()
    # Geometry should be None or not present in response
    assert updated_asset.get("geometry") is None or updated_asset.get("geometry") == {}


def test_get_asset_with_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test getting asset with geometry"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset with geometry
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Geometry Asset",
            "geometry": {
                "primitive": "box",
                "params": {"width": 5, "height": 2, "depth": 3},
            },
            "visualProfile": {"color": "#ff00ff"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # Get asset
    get_response = client.get(f"/api/assets/{asset_id}")
    assert get_response.status_code == 200
    asset = get_response.json()
    assert asset["geometry"]["primitive"] == "box"
    assert asset["geometry"]["params"]["width"] == 5


def test_list_assets_with_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test listing assets includes geometry"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create multiple assets with different geometries
    geometries = [
        {"primitive": "box", "params": {"width": 1, "height": 1, "depth": 1}},
        {"primitive": "sphere", "params": {"radius": 0.5}},
        {
            "primitive": "cylinder",
            "params": {"radiusTop": 0.5, "radiusBottom": 0.5, "height": 1},
        },
    ]

    for i, geom in enumerate(geometries):
        client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": f"Asset {i+1}",
                "geometry": geom,
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {},
                "createdBy": sample_user_id,
            },
        )

    # List all assets
    response = client.get("/api/assets")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 3

    # Verify all have geometry
    for asset in assets:
        assert "geometry" in asset
        assert "primitive" in asset["geometry"]
        assert "params" in asset["geometry"]


def test_clone_asset_preserves_geometry(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test cloning asset preserves geometry"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    # Create asset with geometry
    create_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Original",
            "geometry": {
                "primitive": "box",
                "params": {"width": 2, "height": 3, "depth": 4},
            },
            "visualProfile": {"color": "#123456"},
            "physicsProfile": {"mass": 10},
            "behaviorProfile": {},
            "meta": {"tags": ["test"]},
            "createdBy": sample_user_id,
        },
    )
    asset_id = create_response.json()["id"]

    # Clone asset
    clone_response = client.post(
        f"/api/assets/{asset_id}/clone",
        json={
            "projectId": None,
            "createdBy": sample_user_id,
        },
    )

    assert clone_response.status_code == 200
    cloned_id = clone_response.json()["id"]

    # Verify cloned asset has same geometry
    cloned_asset = mock_convex_client.data["assets"][-1]  # Last added
    assert cloned_asset["geometry"]["primitive"] == "box"
    assert cloned_asset["geometry"]["params"]["width"] == 2
    assert cloned_asset["geometry"]["params"]["height"] == 3
    assert cloned_asset["geometry"]["params"]["depth"] == 4


def test_geometry_with_all_primitives(
    client, mock_convex_client, sample_user_id, sample_asset_type_id
):
    """Test all supported geometry primitives"""
    original_query = mock_convex_client.query

    def mock_query(path, args=None):
        if path == "assetTypes/getByKey":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)

    mock_convex_client.query = mock_query

    primitives = [
        ("rectangle", {"width": 10, "height": 5}),
        ("box", {"width": 2, "height": 3, "depth": 4}),
        ("sphere", {"radius": 1.5}),
        ("cylinder", {"radiusTop": 1, "radiusBottom": 1, "height": 2}),
        ("curve", {"points": [[0, 0, 0], [1, 1, 1]], "shapeRadius": 0.1}),
    ]

    for primitive, params in primitives:
        response = client.post(
            "/api/assets",
            json={
                "assetTypeKey": "tile",
                "name": f"{primitive.capitalize()} Asset",
                "geometry": {"primitive": primitive, "params": params},
                "visualProfile": {},
                "physicsProfile": {},
                "behaviorProfile": {},
                "meta": {},
                "createdBy": sample_user_id,
            },
        )
        assert response.status_code == 200, f"Failed to create {primitive} asset"

        # Verify geometry stored correctly
        assets = mock_convex_client.data["assets"]
        created = next(
            (a for a in assets if a["name"] == f"{primitive.capitalize()} Asset"), None
        )
        assert created is not None
        assert created["geometry"]["primitive"] == primitive
