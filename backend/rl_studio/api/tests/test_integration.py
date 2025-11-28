"""
Integration tests for full workflow: create scene → save → load → compile
Tests the complete flow of creating a scene, saving it, loading it, and compiling it.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rl_studio.api.assets import router as assets_router
from rl_studio.api.compile import router as compile_router
from rl_studio.api.scenes import router as scenes_router
from rl_studio.api.templates import router as templates_router


@pytest.fixture
def app():
    """Create FastAPI app with all routers"""
    app = FastAPI()
    app.include_router(scenes_router)
    app.include_router(compile_router)
    app.include_router(assets_router)
    app.include_router(templates_router)
    return app


@pytest.fixture
def client(
    app, mock_convex_client, sample_user_id, sample_project_id, sample_asset_type_id
):
    """Create test client"""
    # Seed asset types in mock
    mock_convex_client.data["assetTypes"] = [
        {"_id": sample_asset_type_id, "key": "tile", "displayName": "Tile"},
        {"_id": "assetType_test_002", "key": "character", "displayName": "Character"},
    ]
    return TestClient(app)


def test_full_workflow_create_save_load_compile(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
    sample_asset_type_id,
):
    """
    Test the complete workflow:
    1. Create a scene
    2. Save it (create scene version)
    3. Load it (get scene with active version)
    4. Compile it (compile scene version to runtime spec)
    """
    # Step 1: Create a scene
    create_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Integration Test Scene",
            "description": "A scene for integration testing",
            "mode": "grid",
            "environmentSettings": {},
            "createdBy": sample_user_id,
        },
    )
    assert create_response.status_code == 200
    scene_data = create_response.json()
    scene_id = scene_data["id"]
    assert scene_data["name"] == "Integration Test Scene"

    # Verify scene was created
    scenes = mock_convex_client.data["scenes"]
    assert len(scenes) == 1
    assert scenes[0]["_id"] == scene_id

    # Step 2: Save scene (create scene version)
    save_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": sample_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    assert save_response.status_code == 200
    version_data = save_response.json()
    version_id = version_data["id"]

    # Verify version was created
    versions = mock_convex_client.data["sceneVersions"]
    assert len(versions) == 1
    assert versions[0]["_id"] == version_id
    assert versions[0]["sceneId"] == scene_id
    assert versions[0]["versionNumber"] == 1

    # Verify scene's activeVersionId was set
    updated_scene = mock_convex_client.data["scenes"][0]
    assert updated_scene["activeVersionId"] == version_id

    # Step 3: Load scene (get scene with active version)
    load_response = client.get(f"/api/scenes/{scene_id}")
    assert load_response.status_code == 200
    loaded_data = load_response.json()

    # Response should have scene and activeVersion
    assert "scene" in loaded_data or "name" in loaded_data
    if "scene" in loaded_data:
        assert loaded_data["scene"]["name"] == "Integration Test Scene"
        assert "activeVersion" in loaded_data
        active_version = loaded_data["activeVersion"]
    else:
        # Fallback: check if scene has activeVersionId
        assert loaded_data["name"] == "Integration Test Scene"
        # Get version separately if needed
        active_version = None

    # Step 4: Compile scene version
    compile_response = client.post(f"/api/compile/env-spec/{version_id}")
    assert compile_response.status_code == 200
    compile_data = compile_response.json()

    # Verify compilation result
    assert compile_data["success"] is True
    assert "spec" in compile_data
    assert compile_data["format"] == "runtime_spec_v1"

    spec = compile_data["spec"]
    assert "entities" in spec
    assert "metadata" in spec
    assert "rlConfig" in spec

    # Verify entities were compiled correctly
    assert len(spec["entities"]) == len(sample_scene_graph["entities"])

    # Verify RL config was compiled
    assert "agents" in spec["rlConfig"]
    assert "rewards" in spec["rlConfig"]
    assert "episode" in spec["rlConfig"]


def test_workflow_with_assets(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
    sample_asset_type_id,
):
    """
    Test workflow with asset creation and resolution
    """
    # Create an asset first
    asset_response = client.post(
        "/api/assets",
        json={
            "assetTypeKey": "tile",
            "name": "Test Agent",
            "visualProfile": {"color": "#4a90e2", "size": [1, 1, 1]},
            "physicsProfile": {"dynamic": True, "mass": 1},
            "behaviorProfile": {"speed": 2.0},
            "meta": {"tags": ["agent", "grid"], "mode": "grid"},
            "createdBy": sample_user_id,
        },
    )
    assert asset_response.status_code == 200
    asset_data = asset_response.json()
    asset_id = asset_data["id"]

    # Update scene graph to reference the asset
    scene_graph_with_asset = sample_scene_graph.copy()
    scene_graph_with_asset["entities"][0]["assetId"] = asset_id

    # Create scene
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Scene with Asset",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = scene_response.json()["id"]

    # Save scene version with asset reference
    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": scene_graph_with_asset,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    version_id = version_response.json()["id"]

    # Compile with asset resolution
    compile_response = client.post(f"/api/compile/env-spec/{version_id}")
    assert compile_response.status_code == 200
    compile_data = compile_response.json()

    assert compile_data["success"] is True
    spec = compile_data["spec"]

    # Verify asset was resolved
    entity = spec["entities"][0]
    assert "visual" in entity or "assetName" in entity


def test_workflow_template_instantiate_compile(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
):
    """
    Test workflow: instantiate template → compile
    """
    # First, create a template by creating a scene and version
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Template Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = scene_response.json()["id"]

    version_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": sample_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    version_id = version_response.json()["id"]

    # Create template from this scene version
    template_response = client.post(
        "/api/templates",
        json={
            "name": "Test Template",
            "description": "A test template",
            "sceneVersionId": version_id,
            "category": "grid",
            "tags": ["test", "grid"],
            "isPublic": True,
            "createdBy": sample_user_id,
        },
    )
    assert template_response.status_code == 200
    template_data = template_response.json()
    template_id = template_data["id"]
    assert template_id is not None

    # Instantiate template
    instantiate_response = client.post(
        f"/api/templates/{template_id}/instantiate",
        json={
            "templateId": template_id,
            "projectId": sample_project_id,
            "name": "Instantiated Scene",
        },
    )
    assert instantiate_response.status_code == 200
    instantiate_data = instantiate_response.json()
    new_scene_id = instantiate_data["sceneId"]
    new_version_id = instantiate_data["versionId"]

    # Compile the instantiated scene
    compile_response = client.post(f"/api/compile/env-spec/{new_version_id}")
    assert compile_response.status_code == 200
    compile_data = compile_response.json()

    assert compile_data["success"] is True
    spec = compile_data["spec"]
    assert len(spec["entities"]) == len(sample_scene_graph["entities"])


def test_workflow_update_and_recompile(
    client,
    mock_convex_client,
    sample_user_id,
    sample_project_id,
    sample_scene_graph,
    sample_rl_config,
):
    """
    Test workflow: create → save → update → save new version → compile
    """
    # Create scene
    scene_response = client.post(
        "/api/scenes",
        json={
            "projectId": sample_project_id,
            "name": "Updatable Scene",
            "mode": "grid",
            "createdBy": sample_user_id,
        },
    )
    scene_id = scene_response.json()["id"]

    # Save initial version
    version1_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": sample_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    version1_id = version1_response.json()["id"]

    # Update scene metadata
    update_response = client.patch(
        f"/api/scenes/{scene_id}",
        json={
            "name": "Updated Scene Name",
            "description": "Updated description",
        },
    )
    assert update_response.status_code == 200

    # Create new version with modified scene graph
    modified_scene_graph = sample_scene_graph.copy()
    modified_scene_graph["entities"].append(
        {
            "id": "entity_new",
            "name": "New Entity",
            "transform": {
                "position": [5, 0, 5],
                "rotation": [0, 0, 0],
                "scale": [1, 1, 1],
            },
            "components": {},
        }
    )

    version2_response = client.post(
        f"/api/scenes/{scene_id}/versions",
        json={
            "sceneGraph": modified_scene_graph,
            "rlConfig": sample_rl_config,
            "createdBy": sample_user_id,
        },
    )
    version2_id = version2_response.json()["id"]

    # Verify version number incremented
    versions = mock_convex_client.data["sceneVersions"]
    version2 = next(v for v in versions if v["_id"] == version2_id)
    assert version2["versionNumber"] == 2

    # Compile new version
    compile_response = client.post(f"/api/compile/env-spec/{version2_id}")
    assert compile_response.status_code == 200
    compile_data = compile_response.json()

    assert compile_data["success"] is True
    spec = compile_data["spec"]
    # Should have one more entity than original (2 original + 1 new = 3 total)
    assert len(spec["entities"]) == 3
