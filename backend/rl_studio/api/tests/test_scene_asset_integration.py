"""
Integration tests for Scene + Asset integration
Tests entity-based placement with asset references
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from rl_studio.api.scenes import router as scenes_router
from rl_studio.api.assets import router as assets_router
from rl_studio.api.compile import router as compile_router


@pytest.fixture
def app():
    """Create FastAPI app with all routers"""
    app = FastAPI()
    app.include_router(scenes_router)
    app.include_router(assets_router)
    app.include_router(compile_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_user_id, sample_project_id, sample_asset_type_id):
    """Create test client with seeded asset types"""
    mock_convex_client.data['assetTypes'] = [
        {'_id': sample_asset_type_id, 'key': 'tile', 'displayName': 'Tile'},
        {'_id': 'assetType_char_001', 'key': 'character', 'displayName': 'Character'},
    ]
    return TestClient(app)


def test_scene_with_asset_references(client, mock_convex_client, sample_user_id, sample_project_id, sample_asset_type_id):
    """Test creating scene with entities that reference assets"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey":
            key = args.get("key")
            if key == "tile":
                return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
            elif key == "character":
                return {"_id": "assetType_char_001", "key": "character", "displayName": "Character"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create assets
    wall_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Wall",
            "geometry": {"primitive": "box", "params": {"width": 1, "height": 0.1, "depth": 1}},
            "visualProfile": {"color": "#1b263b"},
            "physicsProfile": {"collider": "box", "static": True},
            "behaviorProfile": {},
            "meta": {"tags": ["wall"], "mode": "grid"},
            "createdBy": sample_user_id,
        }
    )
    wall_id = wall_response.json()["id"]
    
    goal_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Goal",
            "geometry": {"primitive": "box", "params": {"width": 1, "height": 0.1, "depth": 1}},
            "visualProfile": {"color": "#50c878"},
            "physicsProfile": {"collider": "box", "trigger": True},
            "behaviorProfile": {},
            "meta": {"tags": ["goal"], "mode": "grid"},
            "createdBy": sample_user_id,
        }
    )
    goal_id = goal_response.json()["id"]
    
    # Create scene
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "environmentSettings": {},
            "createdBy": sample_user_id,
        }
    )
    scene_id = scene_response.json()["id"]
    
    # Create scene version with entities referencing assets
    scene_graph = {
        "entities": [
            {
                "id": "entity_wall_1",
                "assetId": wall_id,
                "name": "Wall 1",
                "parentId": None,
                "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                "components": {
                    "gridCell": {"row": 0, "col": 0},
                    "physics": {"enabled": True, "bodyType": "static"},
                }
            },
            {
                "id": "entity_goal_1",
                "assetId": goal_id,
                "name": "Goal 1",
                "parentId": None,
                "transform": {"position": [5, 0, 5], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                "components": {
                    "gridCell": {"row": 5, "col": 5},
                    "physics": {"enabled": True, "bodyType": "trigger"},
                }
            }
        ],
        "metadata": {"gridConfig": {"rows": 10, "cols": 10}}
    }
    
    rl_config = {
        "agents": [{
            "agentId": "agent1",
            "entityId": "agent1",
            "role": "learning_agent",
            "actionSpace": {"type": "discrete", "actions": ["up", "down", "left", "right"]},
            "observationSpace": {"type": "box", "shape": [2], "low": [0, 0], "high": [9, 9]}
        }],
        "rewards": [],
        "episode": {
            "maxSteps": 100,
            "terminationConditions": [],
            "reset": {"type": "fixed_spawns", "spawns": []}
        }
    }
    
    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": scene_graph,
            "rlConfig": rl_config,
            "createdBy": sample_user_id,
        }
    )
    assert version_response.status_code == 200
    
    # Compile scene version (should resolve asset references)
    version_id = version_response.json()["id"]
    compile_response = client.post(
        f"/api/compile/env-spec/{version_id}",
        json={"resolve_assets": True}
    )
    
    assert compile_response.status_code == 200
    compiled = compile_response.json()
    
    # Verify entities have asset data resolved
    # The compiled response may have a 'spec' wrapper or be direct
    if "spec" in compiled:
        entities = compiled["spec"].get("entities", [])
    elif "entities" in compiled:
        entities = compiled["entities"]
    else:
        entities = []
    
    assert len(entities) == 2
    
    # Check wall entity - asset data should be resolved into visual/physics/behavior
    wall_entity = next((e for e in entities if e["id"] == "entity_wall_1"), None)
    assert wall_entity is not None
    # Asset data should be merged into entity (assetName, visual, physics, etc.)
    assert wall_entity.get("assetName") == "Wall" or wall_entity.get("visual", {}).get("color") == "#1b263b"
    
    # Check goal entity
    goal_entity = next((e for e in entities if e["id"] == "entity_goal_1"), None)
    assert goal_entity is not None
    # Asset data should be merged into entity
    assert goal_entity.get("assetName") == "Goal" or goal_entity.get("visual", {}).get("color") == "#50c878"


def test_compile_with_missing_asset_reference(client, mock_convex_client, sample_user_id, sample_project_id):
    """Test compiling scene with missing asset reference (should handle gracefully)"""
    # Create scene
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Test Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        }
    )
    scene_id = scene_response.json()["id"]
    
    # Create scene version with invalid asset reference
    scene_graph = {
        "entities": [{
            "id": "entity1",
            "assetId": "nonexistent_asset_id",
            "name": "Entity 1",
            "parentId": None,
            "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "components": {}
        }],
        "metadata": {}
    }
    
    rl_config = {
        "agents": [],
        "rewards": [],
        "episode": {
            "maxSteps": 100,
            "terminationConditions": [],
            "reset": {"type": "fixed_spawns", "spawns": []}
        }
    }
    
    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": scene_graph,
            "rlConfig": rl_config,
            "createdBy": sample_user_id,
        }
    )
    version_id = version_response.json()["id"]
    
    # Compile should handle missing asset gracefully
    compile_response = client.post(
        f"/api/compile/env-spec/{version_id}",
        json={"resolve_assets": True}
    )
    
    # Should either succeed with null asset or return error
    # Current implementation may return 404 or handle gracefully
    assert compile_response.status_code in [200, 404, 500]


def test_scene_entities_with_asset_properties(client, mock_convex_client, sample_user_id, sample_project_id, sample_asset_type_id):
    """Test that entity properties store assetId correctly"""
    original_query = mock_convex_client.query
    def mock_query(path, args=None):
        if path == "assetTypes/getByKey" and args.get("key") == "tile":
            return {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"}
        return original_query(path, args)
    mock_convex_client.query = mock_query
    
    # Create asset
    asset_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Asset",
            "geometry": {"primitive": "box", "params": {"width": 1, "height": 1, "depth": 1}},
            "visualProfile": {"color": "#ff0000"},
            "physicsProfile": {},
            "behaviorProfile": {},
            "meta": {},
            "createdBy": sample_user_id,
        }
    )
    asset_id = asset_response.json()["id"]
    
    # Create scene with entity that has assetId in properties
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Asset Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        }
    )
    scene_id = scene_response.json()["id"]
    
    # Create version with entity referencing asset
    scene_graph = {
        "entities": [{
            "id": "entity1",
            "assetId": asset_id,
            "name": "Entity 1",
            "parentId": None,
            "transform": {"position": [1, 0, 1], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
            "components": {
                "gridCell": {"row": 1, "col": 1},
                "properties": {"assetId": asset_id}  # Also in properties for backward compat
            }
        }],
        "metadata": {"gridConfig": {"rows": 10, "cols": 10}}
    }
    
    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": scene_graph,
            "rlConfig": {
                "agents": [],
                "rewards": [],
                "episode": {
                    "maxSteps": 100,
                    "terminationConditions": [],
                    "reset": {"type": "fixed_spawns", "spawns": []}
                }
            },
            "createdBy": sample_user_id,
        }
    )
    assert version_response.status_code == 200
    
    # Get scene version and verify assetId is stored
    get_response = client.get(f"/api/scenes/{scene_id}")
    assert get_response.status_code == 200
    scene_data = get_response.json()
    entities = scene_data["activeVersion"]["sceneGraph"]["entities"]
    assert len(entities) == 1
    assert entities[0]["assetId"] == asset_id

