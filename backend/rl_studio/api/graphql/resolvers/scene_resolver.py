"""
Scene/Environment GraphQL resolvers
"""

import strawberry
import json
from typing import List, Optional
from ..types.scene import Scene, CreateSceneInput, UpdateSceneInput, CreateSceneVersionInput, SceneFilter
from ....api.convex_client import get_client


@strawberry.type
class SceneResolver:
    """Scene queries and mutations"""
    
    @strawberry.field
    async def scenes(
        self,
        filter: Optional[SceneFilter] = None
    ) -> List[Scene]:
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
                scenes.append(Scene(
                    id=item.get("_id", ""),
                    name=item.get("name", ""),
                    env_spec=json.dumps(item.get("envSpec", {})),
                    created_at=item.get("_creationTime"),
                    updated_at=item.get("_creationTime"),
                    created_by=item.get("createdBy"),
                ))
            
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
                env_spec=json.dumps(result.get("envSpec", {})),
                created_at=result.get("_creationTime"),
                updated_at=result.get("_creationTime"),
                created_by=result.get("createdBy"),
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
            from ....api.scenes import create_scene as rest_create_scene
            from ....api.models import CreateSceneRequest
            
            # Parse environment_settings if provided
            environment_settings = json.loads(input.environment_settings) if input.environment_settings else {}
            
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
            
            # Fetch the created scene
            created_scene = await self.scene(result["id"])
            if not created_scene:
                raise Exception("Failed to fetch created scene")
            
            return created_scene
        except Exception as e:
            import logging
            logging.error(f"Error creating scene: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def update_scene(self, id: str, input: UpdateSceneInput) -> Scene:
        """Update a scene"""
        try:
            # Import REST API function
            from ....api.scenes import update_scene as rest_update_scene
            from ....api.models import UpdateSceneRequest
            
            # Parse environment_settings if provided
            environment_settings = json.loads(input.environment_settings) if input.environment_settings else None
            
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
            
            # Fetch the updated scene
            updated_scene = await self.scene(id)
            if not updated_scene:
                raise Exception("Failed to fetch updated scene")
            
            return updated_scene
        except Exception as e:
            import logging
            logging.error(f"Error updating scene: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def create_scene_version(self, scene_id: str, input: CreateSceneVersionInput) -> dict:
        """Create a new scene version"""
        try:
            # Import REST API function
            from ....api.scenes import create_scene_version as rest_create_scene_version
            from ....api.models import CreateSceneVersionRequest, SceneGraph, RLConfig
            
            # Parse JSON strings
            scene_graph_dict = json.loads(input.scene_graph)
            rl_config_dict = json.loads(input.rl_config)
            
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
            return result
        except Exception as e:
            import logging
            logging.error(f"Error creating scene version: {e}", exc_info=True)
            raise
    
    @strawberry.field
    async def scene_version(self, scene_id: str, version_number: int) -> Optional[dict]:
        """Get a specific scene version"""
        try:
            # Import REST API function
            from ....api.scenes import get_scene_version as rest_get_scene_version
            
            # Call REST API function
            result = await rest_get_scene_version(scene_id, version_number)
            return result
        except Exception as e:
            import logging
            logging.error(f"Error getting scene version: {e}", exc_info=True)
            return None
    
    @strawberry.field
    async def scene_versions(self, scene_id: str) -> List[dict]:
        """List all versions for a scene"""
        try:
            # Import REST API function
            from ....api.scenes import list_scene_versions as rest_list_scene_versions
            
            # Call REST API function
            result = await rest_list_scene_versions(scene_id)
            return result.get("versions", [])
        except Exception as e:
            import logging
            logging.error(f"Error listing scene versions: {e}", exc_info=True)
            return []

