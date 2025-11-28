"""
Pytest configuration and fixtures for API tests
"""

import sys
from pathlib import Path
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, MagicMock, Mock

import pytest

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from rl_studio.api.convex_client import ConvexClient


class MockConvexClient:
    """Mock Convex client for testing"""

    def __init__(self):
        self.data: Dict[str, Any] = {
            "assetTypes": [],
            "assets": [],
            "scenes": [],
            "sceneVersions": [],
            "templates": [],
        }
        self._id_counter = 0

    def _generate_id(self, prefix: str) -> str:
        """Generate a mock Convex ID"""
        self._id_counter += 1
        return f"{prefix}{self._id_counter:06d}"

    def query(self, path: str, args: Dict[str, Any] = None) -> Any:
        """Mock query method"""
        args = args or {}
        path_parts = path.split("/")

        if path == "assetTypes/list":
            return self.data["assetTypes"]

        elif path == "assets/list":
            assets = self.data["assets"]
            # Apply filters
            if args.get("projectId"):
                assets = [a for a in assets if a.get("projectId") == args["projectId"]]
            if args.get("mode"):
                assets = [
                    a for a in assets if a.get("meta", {}).get("mode") == args["mode"]
                ]
            if args.get("tag"):
                tag = args["tag"]
                assets = [a for a in assets if tag in a.get("meta", {}).get("tags", [])]
            return assets

        elif path == "assetTypes/getByKey":
            key = args.get("key")
            return next(
                (at for at in self.data["assetTypes"] if at.get("key") == key), None
            )

        elif path == "assets/get":
            asset_id = args.get("id")
            return next(
                (a for a in self.data["assets"] if a.get("_id") == asset_id), None
            )

        elif path == "scenes/get":
            scene_id = args.get("id")
            scene = next(
                (s for s in self.data["scenes"] if s.get("_id") == scene_id), None
            )
            if scene and scene.get("activeVersionId"):
                version = next(
                    (
                        v
                        for v in self.data["sceneVersions"]
                        if v.get("_id") == scene["activeVersionId"]
                    ),
                    None,
                )
                if scene and version:
                    return {
                        "scene": scene,
                        "activeVersion": version,
                    }
            return scene

        elif path == "sceneVersions/getById":
            version_id = args.get("id")
            return next(
                (v for v in self.data["sceneVersions"] if v.get("_id") == version_id),
                None,
            )

        elif path == "templates/list":
            templates = self.data["templates"]
            if args.get("isPublic") is not None:
                templates = [
                    t for t in templates if t.get("isPublic") == args["isPublic"]
                ]
            return templates

        elif path == "templates/get":
            template_id = args.get("id")
            template = next(
                (t for t in self.data["templates"] if t.get("_id") == template_id), None
            )
            if template:
                version = next(
                    (
                        v
                        for v in self.data["sceneVersions"]
                        if v.get("_id") == template.get("sceneVersionId")
                    ),
                    None,
                )
                return {
                    "template": template,
                    "sceneVersion": version,
                }
            return None

        elif path == "scenes/list":
            scenes = self.data["scenes"]
            if args.get("projectId"):
                scenes = [s for s in scenes if s.get("projectId") == args["projectId"]]
            return scenes

        elif path == "sceneVersions/list":
            versions = self.data["sceneVersions"]
            if args.get("sceneId"):
                versions = [v for v in versions if v.get("sceneId") == args["sceneId"]]
            return versions

        elif path == "scenes/getVersion":
            scene_id = args.get("sceneId")
            version_number = args.get("versionNumber")
            version = next(
                (
                    v
                    for v in self.data["sceneVersions"]
                    if v.get("sceneId") == scene_id
                    and v.get("versionNumber") == version_number
                ),
                None,
            )
            return version

        return None

    def mutation(self, path: str, args: Dict[str, Any] = None) -> Any:
        """Mock mutation method"""
        args = args or {}
        path_parts = path.split("/")

        if path == "scenes/create":
            scene = {
                "_id": self._generate_id("scene"),
                "projectId": args.get("projectId"),
                "name": args.get("name"),
                "description": args.get("description"),
                "mode": args.get("mode", "grid"),
                "environmentSettings": args.get("environmentSettings", {}),
                "activeVersionId": None,
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
            }
            self.data["scenes"].append(scene)
            return scene["_id"]

        elif path == "scenes/update":
            scene_id = args.get("id")
            scene = next(
                (s for s in self.data["scenes"] if s.get("_id") == scene_id), None
            )
            if scene:
                scene.update({k: v for k, v in args.items() if k != "id"})
                scene["updatedAt"] = 1234567890
            return scene

        elif path == "scenes/createVersion":
            # Get next version number
            scene_id = args.get("sceneId")
            existing_versions = [
                v for v in self.data["sceneVersions"] if v.get("sceneId") == scene_id
            ]
            version_number = len(existing_versions) + 1

            version = {
                "_id": self._generate_id("version"),
                "sceneId": scene_id,
                "versionNumber": version_number,
                "sceneGraph": args.get("sceneGraph", {}),
                "rlConfig": args.get("rlConfig", {}),
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
            }
            self.data["sceneVersions"].append(version)
            # Update scene's active version
            scene = next(
                (s for s in self.data["scenes"] if s.get("_id") == scene_id), None
            )
            if scene:
                scene["activeVersionId"] = version["_id"]
            return version["_id"]

        elif path == "sceneVersions/create":
            version = {
                "_id": self._generate_id("version"),
                "sceneId": args.get("sceneId"),
                "versionNumber": args.get("versionNumber", 1),
                "sceneGraph": args.get("sceneGraph", {}),
                "rlConfig": args.get("rlConfig", {}),
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
            }
            self.data["sceneVersions"].append(version)
            # Update scene's active version
            scene = next(
                (s for s in self.data["scenes"] if s.get("_id") == version["sceneId"]),
                None,
            )
            if scene:
                scene["activeVersionId"] = version["_id"]
            return version["_id"]

        elif path == "assets/create":
            asset = {
                "_id": self._generate_id("asset"),
                "projectId": args.get("projectId"),
                "assetTypeId": args.get("assetTypeId"),
                "name": args.get("name"),
                "slug": args.get("slug"),
                "thumbnailUrl": args.get("thumbnailUrl"),
                "modelUrl": args.get("modelUrl"),
                "geometry": args.get("geometry"),
                "visualProfile": args.get("visualProfile", {}),
                "physicsProfile": args.get("physicsProfile", {}),
                "behaviorProfile": args.get("behaviorProfile", {}),
                "meta": args.get("meta", {}),
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
            }
            self.data["assets"].append(asset)
            return asset["_id"]

        elif path == "templates/instantiate":
            template_id = args.get("templateId")
            template = next(
                (t for t in self.data["templates"] if t.get("_id") == template_id), None
            )
            if not template:
                raise ValueError("Template not found")

            # Create new scene
            scene_id = self._generate_id("scene")
            scene = {
                "_id": scene_id,
                "projectId": args.get("projectId"),
                "name": args.get("name", template.get("name")),
                "description": template.get("description"),
                "mode": "grid",  # Default
                "environmentSettings": {},
                "activeVersionId": None,
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
            }
            self.data["scenes"].append(scene)

            # Create new version (copy from template)
            version_id = self._generate_id("version")
            original_version = next(
                (
                    v
                    for v in self.data["sceneVersions"]
                    if v.get("_id") == template.get("sceneVersionId")
                ),
                None,
            )
            if original_version:
                import json

                version = {
                    "_id": version_id,
                    "sceneId": scene_id,
                    "versionNumber": 1,
                    "sceneGraph": json.loads(
                        json.dumps(original_version.get("sceneGraph", {}))
                    ),  # Deep copy
                    "rlConfig": json.loads(
                        json.dumps(original_version.get("rlConfig", {}))
                    ),  # Deep copy
                    "createdBy": args.get("createdBy"),
                    "createdAt": 1234567890,
                }
                self.data["sceneVersions"].append(version)
                scene["activeVersionId"] = version_id

            return {
                "sceneId": scene_id,
                "versionId": version_id,
            }

        elif path == "assets/update":
            asset_id = args.get("id")
            asset = next(
                (a for a in self.data["assets"] if a.get("_id") == asset_id), None
            )
            if not asset:
                raise ValueError("Asset not found")
            # Update only provided fields
            for key, value in args.items():
                if key != "id":
                    if value is None:
                        # Explicitly set to None to remove field
                        asset[key] = None
                    elif key in [
                        "visualProfile",
                        "physicsProfile",
                        "behaviorProfile",
                        "meta",
                        "geometry",
                    ]:
                        # For nested dicts, merge if dict, otherwise replace
                        if isinstance(value, dict) and isinstance(asset.get(key), dict):
                            asset[key] = {**asset.get(key, {}), **value}
                        else:
                            asset[key] = value
                    else:
                        asset[key] = value
            asset["updatedAt"] = 1234567890
            return asset

        elif path == "assets/remove":
            asset_id = args.get("id")
            asset = next(
                (a for a in self.data["assets"] if a.get("_id") == asset_id), None
            )
            if not asset:
                raise ValueError("Asset not found")
            self.data["assets"] = [
                a for a in self.data["assets"] if a.get("_id") != asset_id
            ]
            return {"success": True}

        elif path == "assets/clone":
            asset_id = args.get("assetId")
            asset = next(
                (a for a in self.data["assets"] if a.get("_id") == asset_id), None
            )
            if not asset:
                raise ValueError("Asset not found")

            cloned_asset = {
                "_id": self._generate_id("asset"),
                "projectId": args.get("projectId"),
                "assetTypeId": asset["assetTypeId"],
                "name": f"{asset['name']} (Copy)",
                "slug": asset.get("slug"),
                "thumbnailUrl": asset.get("thumbnailUrl"),
                "modelUrl": asset.get("modelUrl"),
                "geometry": asset.get("geometry"),
                "visualProfile": asset.get("visualProfile", {}),
                "physicsProfile": asset.get("physicsProfile", {}),
                "behaviorProfile": asset.get("behaviorProfile", {}),
                "meta": asset.get("meta", {}),
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
                "updatedAt": 1234567890,
            }
            self.data["assets"].append(cloned_asset)
            return cloned_asset["_id"]

        elif path == "assets/checkReferences":
            # This is a query, but we'll handle it here for convenience
            asset_id = args.get("id")
            references = []
            for version in self.data["sceneVersions"]:
                entities = version.get("sceneGraph", {}).get("entities", [])
                for entity in entities:
                    if entity.get("assetId") == asset_id:
                        references.append(
                            {
                                "sceneId": version["sceneId"],
                                "versionId": version["_id"],
                                "entityId": entity["id"],
                            }
                        )
            return references

        elif path == "assets/remove":
            asset_id = args.get("id")
            asset = next(
                (a for a in self.data["assets"] if a.get("_id") == asset_id), None
            )
            if not asset:
                raise ValueError("Asset not found")
            self.data["assets"] = [
                a for a in self.data["assets"] if a.get("_id") != asset_id
            ]
            return {"success": True}

        elif path == "templates/create":
            template = {
                "_id": self._generate_id("template"),
                "name": args.get("name"),
                "description": args.get("description"),
                "sceneVersionId": args.get("sceneVersionId"),
                "category": args.get("category"),
                "tags": args.get("tags", []),
                "meta": args.get("meta", {}),
                "isPublic": args.get("isPublic", True),
                "createdBy": args.get("createdBy"),
                "createdAt": 1234567890,
            }
            self.data["templates"].append(template)
            return template["_id"]

        elif path == "scenes/update":
            scene_id = args.get("id")
            scene = next(
                (s for s in self.data["scenes"] if s.get("_id") == scene_id), None
            )
            if scene:
                scene.update({k: v for k, v in args.items() if k != "id"})
                scene["updatedAt"] = 1234567890
            return scene

        return None


@pytest.fixture
def mock_convex_client(monkeypatch):
    """Fixture to provide a mock Convex client"""
    mock_client = MockConvexClient()

    # Monkey patch get_client to return mock
    def get_mock_client():
        return mock_client

    from rl_studio.api import assets
    from rl_studio.api import compile as compile_module
    from rl_studio.api import scenes, templates

    monkeypatch.setattr("rl_studio.api.scenes.get_client", get_mock_client)
    monkeypatch.setattr("rl_studio.api.assets.get_client", get_mock_client)
    monkeypatch.setattr("rl_studio.api.templates.get_client", get_mock_client)
    monkeypatch.setattr("rl_studio.api.compile.get_client", get_mock_client)

    return mock_client


@pytest.fixture
def sample_user_id():
    """Sample user ID for testing"""
    return "user_test_001"


@pytest.fixture
def sample_project_id():
    """Sample project ID for testing"""
    return "project_test_001"


@pytest.fixture
def sample_asset_type_id():
    """Sample asset type ID for testing"""
    return "assetType_test_001"


@pytest.fixture
def sample_scene_graph():
    """Sample scene graph for testing"""
    return {
        "entities": [
            {
                "id": "entity_agent_1",
                "assetId": None,
                "name": "Agent",
                "parentId": None,
                "transform": {
                    "position": [1, 0, 1],
                    "rotation": [0, 0, 0],
                    "scale": [1, 1, 1],
                },
                "components": {
                    "gridCell": {"row": 1, "col": 1},
                    "rlAgent": {"agentId": "player_agent", "role": "learning_agent"},
                },
            },
            {
                "id": "entity_goal_1",
                "assetId": None,
                "name": "Goal",
                "parentId": None,
                "transform": {
                    "position": [8, 0, 8],
                    "rotation": [0, 0, 0],
                    "scale": [1, 1, 1],
                },
                "components": {"gridCell": {"row": 8, "col": 8}},
            },
        ],
        "metadata": {
            "gridConfig": {"rows": 10, "cols": 10},
            "tags": ["grid", "navigation"],
        },
    }


@pytest.fixture
def sample_rl_config():
    """Sample RL config for testing"""
    return {
        "agents": [
            {
                "agentId": "player_agent",
                "entityId": "entity_agent_1",
                "role": "learning_agent",
                "actionSpace": {
                    "type": "discrete",
                    "actions": ["move_up", "move_down", "move_left", "move_right"],
                },
                "observationSpace": {
                    "type": "box",
                    "shape": [2],
                    "low": [0, 0],
                    "high": [9, 9],
                },
            }
        ],
        "rewards": [
            {
                "id": "reach_goal",
                "trigger": {
                    "type": "enter_region",
                    "entityId": "entity_agent_1",
                    "regionId": "entity_goal_1",
                },
                "amount": 10.0,
            },
            {"id": "step_penalty", "trigger": {"type": "step"}, "amount": -0.1},
        ],
        "episode": {
            "maxSteps": 200,
            "terminationConditions": [
                {
                    "type": "enter_region",
                    "entityId": "entity_agent_1",
                    "regionId": "entity_goal_1",
                },
                {"type": "max_steps", "maxSteps": 200},
            ],
            "reset": {
                "type": "fixed_spawns",
                "spawns": [{"entityId": "entity_agent_1", "position": [1, 0, 1]}],
            },
        },
    }
