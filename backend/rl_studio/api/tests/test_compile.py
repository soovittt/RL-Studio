"""
Tests for Compile Service
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from rl_studio.api.compile import router as compile_router


@pytest.fixture
def app():
    """Create FastAPI app with compile router"""
    app = FastAPI()
    app.include_router(compile_router)
    return app


@pytest.fixture
def client(app, mock_convex_client, sample_scene_graph, sample_rl_config):
    """Create test client"""
    return TestClient(app)


def test_compile_from_data(client, sample_scene_graph, sample_rl_config):
    """Test compiling scene_graph + rl_config directly"""
    response = client.post(
        "/api/compile/env-spec/from-data",
        json={
            "scene_graph": sample_scene_graph,
            "rl_config": sample_rl_config,
            "resolve_assets": False,
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "spec" in data
    assert data["format"] == "runtime_spec_v1"
    
    spec = data["spec"]
    assert "entities" in spec
    assert "metadata" in spec
    assert "rlConfig" in spec
    assert len(spec["entities"]) == 2


def test_compile_from_data_with_asset_resolution(
    client, mock_convex_client, sample_user_id, sample_asset_type_id,
    sample_scene_graph, sample_rl_config
):
    """Test compiling with asset resolution"""
    # Create an asset first
    asset_id = mock_convex_client.mutation("assets/create", {
        "assetTypeId": sample_asset_type_id,
        "name": "Agent",
        "visualProfile": {"color": "#4a90e2"},
        "physicsProfile": {"dynamic": True},
        "behaviorProfile": {},
        "meta": {},
        "createdBy": sample_user_id,
    })
    
    # Update scene graph to reference the asset
    sample_scene_graph["entities"][0]["assetId"] = asset_id
    
    response = client.post(
        "/api/compile/env-spec/from-data",
        json={
            "scene_graph": sample_scene_graph,
            "rl_config": sample_rl_config,
            "resolve_assets": True,
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    
    # Check that asset was resolved
    spec = data["spec"]
    entity = spec["entities"][0]
    assert "visual" in entity
    assert "physics" in entity
    assert entity.get("assetName") == "Agent"


def test_compile_invalid_scene_graph(client, sample_rl_config):
    """Test compiling with invalid scene graph"""
    invalid_scene_graph = {
        "entities": "not a list",  # Invalid
        "metadata": {},
    }
    
    response = client.post(
        "/api/compile/env-spec/from-data",
        json={
            "scene_graph": invalid_scene_graph,
            "rl_config": sample_rl_config,
        }
    )
    
    assert response.status_code == 400


def test_compile_invalid_rl_config(client, sample_scene_graph):
    """Test compiling with invalid RL config"""
    invalid_rl_config = {
        "agents": "not a list",  # Invalid
    }
    
    response = client.post(
        "/api/compile/env-spec/from-data",
        json={
            "scene_graph": sample_scene_graph,
            "rl_config": invalid_rl_config,
        }
    )
    
    assert response.status_code == 400

