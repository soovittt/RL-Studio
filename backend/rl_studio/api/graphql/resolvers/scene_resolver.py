"""
Scene/Environment GraphQL resolvers
"""

import json
from typing import List, Optional

import strawberry

from ....api.convex_client import get_client
from ..types.scene import (
    CreateSceneInput,
    CreateSceneVersionInput,
    Scene,
    SceneFilter,
    SceneVersion,
    UpdateSceneInput,
)


@strawberry.type
class SceneResolver:
    """Scene queries and mutations"""

    @strawberry.field
    async def scenes(self, filter: Optional[SceneFilter] = None) -> List[Scene]:
        """Get list of scenes - uses same logic as REST API"""
        try:
            # Use same Convex client logic as REST API
            client = get_client()
            if not client:
                return []

            # Call Convex directly (same as REST API does)
            result = client.query("scenes/list", {})

            if not result or not isinstance(result, list):
                return []

            # Convert to GraphQL types
            scenes = []
            for item in result:
                scenes.append(
                    Scene(
                        id=item.get("_id", ""),
                        name=item.get("name", ""),
                        env_spec=item.get(
                            "envSpec", {}
                        ),  # JSON scalar, no need to dumps
                        created_at=item.get("_creationTime"),
                        updated_at=item.get("_creationTime"),
                        created_by=item.get("createdBy"),
                        project_id=item.get("projectId"),
                    )
                )

            # Apply filters
            if filter:
                if filter.created_by:
                    scenes = [s for s in scenes if s.created_by == filter.created_by]
                if filter.search:
                    search_lower = filter.search.lower()
                    scenes = [s for s in scenes if search_lower in s.name.lower()]

            return scenes
        except Exception as e:
            import logging

            logging.error(f"Error fetching scenes: {e}")
            return []

    @strawberry.field
    async def scene(self, id: str) -> Optional[Scene]:
        """Get a single scene by ID - uses same logic as REST API"""
        try:
            # Use same Convex client logic as REST API
            client = get_client()
            if not client:
                return None

            # Call Convex directly (same as REST API does)
            result = client.query("scenes/get", {"id": id})

            if not result:
                return None

            return Scene(
                id=result.get("_id", ""),
                name=result.get("name", ""),
                env_spec=result.get("envSpec", {}),  # JSON scalar, no need to dumps
                created_at=result.get("_creationTime"),
                updated_at=result.get("_creationTime"),
                created_by=result.get("createdBy"),
                project_id=result.get("projectId"),
            )
        except Exception as e:
            import logging

            logging.error(f"Error fetching scene {id}: {e}")
            return None

    @strawberry.mutation
    async def create_scene(self, input: CreateSceneInput) -> Scene:
        """Create a new scene"""
        try:
            # Import REST API function
            from ....api.models import CreateSceneRequest
            from ....api.scenes import create_scene as rest_create_scene

            # environment_settings is already a dict (JSON scalar)
            environment_settings = (
                input.environment_settings if input.environment_settings else {}
            )

            # Create request object
            request = CreateSceneRequest(
                projectId=input.project_id,
                name=input.name,
                description=input.description,
                mode=input.mode,
                environmentSettings=environment_settings,
                createdBy=input.created_by,
            )

            # Call REST API function
            result = await rest_create_scene(request)
            scene_id = result.get("id")
            
            # Validate scene_id is a string
            if not scene_id or not isinstance(scene_id, str):
                import logging
                error_msg = f"Invalid scene ID returned: {scene_id}"
                logging.error(error_msg)
                raise Exception(error_msg)

            # Fetch the created scene directly (don't use self.scene to avoid context issues)
            try:
                from ....api.scenes import get_scene
                scene_response = await get_scene(scene_id)
                
                if not scene_response or "scene" not in scene_response:
                    raise Exception("Failed to fetch created scene")
                
                scene_data = scene_response["scene"]
                
                # Convert to GraphQL Scene type
                return Scene(
                    id=scene_data.get("_id", scene_id),
                    name=scene_data.get("name", request.name),
                    env_spec=scene_data.get("envSpec", {}),
                    created_at=scene_data.get("_creationTime"),
                    updated_at=scene_data.get("_creationTime"),
                    created_by=scene_data.get("createdBy", request.createdBy),
                    project_id=scene_data.get("projectId", request.projectId),
                )
            except Exception as fetch_error:
                # If we can't fetch, at least return basic info
                import logging
                logging.warning(f"Could not fetch created scene, returning basic info: {fetch_error}")
                return Scene(
                    id=scene_id,
                    name=request.name,
                    env_spec={},
                    created_at=None,
                    updated_at=None,
                    created_by=request.createdBy,
                    project_id=request.projectId,
                )
        except Exception as e:
            import logging

            logging.error(f"Error creating scene: {e}", exc_info=True)
            raise

    @strawberry.mutation
    async def update_scene(self, id: str, input: UpdateSceneInput) -> Scene:
        """Update a scene"""
        try:
            # Import REST API function
            from ....api.models import UpdateSceneRequest
            from ....api.scenes import update_scene as rest_update_scene

            # environment_settings is already a dict (JSON scalar)
            environment_settings = (
                input.environment_settings if input.environment_settings else None
            )

            # Create request object
            request = UpdateSceneRequest(
                name=input.name,
                description=input.description,
                mode=input.mode,
                environmentSettings=environment_settings,
                projectId=input.project_id,
            )

            # Call REST API function
            await rest_update_scene(id, request)

            # Fetch the updated scene directly (don't use self.scene to avoid context issues)
            try:
                from ....api.scenes import get_scene
                scene_response = await get_scene(id)
                
                if not scene_response or "scene" not in scene_response:
                    raise Exception("Failed to fetch updated scene")
                
                scene_data = scene_response["scene"]
                
                # Convert to GraphQL Scene type
                return Scene(
                    id=scene_data.get("_id", id),
                    name=scene_data.get("name", input.name or ""),
                    env_spec=scene_data.get("envSpec", {}),
                    created_at=scene_data.get("_creationTime"),
                    updated_at=scene_data.get("_creationTime"),
                    created_by=scene_data.get("createdBy"),
                    project_id=scene_data.get("projectId", input.project_id),
                )
            except Exception as fetch_error:
                # If we can't fetch, at least return basic info
                import logging
                logging.warning(f"Could not fetch updated scene, returning basic info: {fetch_error}")
                return Scene(
                    id=id,
                    name=input.name or "",
                    env_spec={},
                    created_at=None,
                    updated_at=None,
                    created_by=None,
                    project_id=input.project_id,
                )
        except Exception as e:
            import logging

            logging.error(f"Error updating scene: {e}", exc_info=True)
            raise

    @strawberry.mutation
    async def create_scene_version(
        self, scene_id: str, input: CreateSceneVersionInput
    ) -> SceneVersion:
        """Create a new scene version"""
        try:
            # Import REST API function
            from ....api.models import CreateSceneVersionRequest, RLConfig, SceneGraph
            from ....api.scenes import create_scene_version as rest_create_scene_version
            from ....api.scenes import get_scene_version as rest_get_scene_version

            # scene_graph and rl_config are already dicts (JSON scalars)
            scene_graph_dict = (
                input.scene_graph
                if isinstance(input.scene_graph, dict)
                else json.loads(input.scene_graph)
            )
            rl_config_dict = (
                input.rl_config
                if isinstance(input.rl_config, dict)
                else json.loads(input.rl_config)
            )

            # Create Pydantic models
            scene_graph = SceneGraph(**scene_graph_dict)
            rl_config = RLConfig(**rl_config_dict)

            # Create request object
            request = CreateSceneVersionRequest(
                sceneGraph=scene_graph,
                rlConfig=rl_config,
                createdBy=input.created_by,
            )

            # Call REST API function
            result = await rest_create_scene_version(scene_id, request)

            # Fetch the created version to get full details
            # The result should have version info, but we need to query Convex for full version
            client = get_client()
            if client:
                # Get the latest version number for this scene
                versions = client.query("scenes/listVersions", {"sceneId": scene_id})
                if versions:
                    latest_version = max(
                        versions, key=lambda v: v.get("versionNumber", 0)
                    )
                    version_number = latest_version.get("versionNumber", 1)

                    # Get full version details
                    version_data = await rest_get_scene_version(
                        scene_id, version_number
                    )
                    if version_data:
                        return SceneVersion(
                            id=latest_version.get("_id", result.get("id", "")),
                            scene_id=scene_id,
                            version_number=version_number,
                            scene_graph=version_data.get("sceneGraph", {}),
                            rl_config=version_data.get("rlConfig", {}),
                            created_by=input.created_by,
                            created_at=latest_version.get("_creationTime"),
                        )

            # Fallback if we can't fetch full details
            return SceneVersion(
                id=result.get("id", ""),
                scene_id=scene_id,
                version_number=1,  # Default, should be fetched from Convex
                scene_graph=scene_graph_dict,
                rl_config=rl_config_dict,
                created_by=input.created_by,
            )
        except Exception as e:
            import logging

            logging.error(f"Error creating scene version: {e}", exc_info=True)
            raise

    @strawberry.field
    async def scene_version(
        self, scene_id: str, version_number: int
    ) -> Optional[SceneVersion]:
        """Get a specific scene version"""
        try:
            # Import REST API function
            from ....api.scenes import get_scene_version as rest_get_scene_version

            # Call REST API function
            result = await rest_get_scene_version(scene_id, version_number)
            if not result:
                return None

            # Get version metadata from Convex
            client = get_client()
            if client:
                version_meta = client.query(
                    "scenes/getVersion",
                    {
                        "sceneId": scene_id,
                        "versionNumber": version_number,
                    },
                )
                if version_meta:
                    return SceneVersion(
                        id=version_meta.get("_id", ""),
                        scene_id=scene_id,
                        version_number=version_number,
                        scene_graph=result.get("sceneGraph", {}),
                        rl_config=result.get("rlConfig", {}),
                        created_by=version_meta.get("createdBy"),
                        created_at=version_meta.get("_creationTime"),
                    )

            # Fallback if metadata not available
            return SceneVersion(
                id="",
                scene_id=scene_id,
                version_number=version_number,
                scene_graph=result.get("sceneGraph", {}),
                rl_config=result.get("rlConfig", {}),
            )
        except Exception as e:
            import logging

            logging.error(f"Error getting scene version: {e}", exc_info=True)
            return None

    @strawberry.field
    async def scene_versions(self, scene_id: str) -> List[SceneVersion]:
        """List all versions for a scene"""
        try:
            # Import REST API function
            from ....api.scenes import get_scene_version as rest_get_scene_version
            from ....api.scenes import list_scene_versions as rest_list_scene_versions

            # Call REST API function
            result = await rest_list_scene_versions(scene_id)
            versions_data = result.get("versions", [])

            # Convert to GraphQL types
            scene_versions = []
            for version_meta in versions_data:
                # Get full version details
                version_details = await rest_get_scene_version(
                    scene_id, version_meta.get("versionNumber", 0)
                )
                if version_details:
                    scene_versions.append(
                        SceneVersion(
                            id=version_meta.get("_id", ""),
                            scene_id=scene_id,
                            version_number=version_meta.get("versionNumber", 0),
                            scene_graph=version_details.get("sceneGraph", {}),
                            rl_config=version_details.get("rlConfig", {}),
                            created_by=version_meta.get("createdBy"),
                            created_at=version_meta.get("_creationTime"),
                        )
                    )

            return scene_versions
        except Exception as e:
            import logging

            logging.error(f"Error listing scene versions: {e}", exc_info=True)
            return []
