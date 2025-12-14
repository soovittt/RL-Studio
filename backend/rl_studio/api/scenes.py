"""
Scene Service - CRUD operations for scenes and scene versions
"""

import logging
from typing import Any, Dict, Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from .convex_client import get_client
from .models import (
    CreateSceneRequest,
    CreateSceneVersionRequest,
    RLConfig,
    SceneGraph,
    UpdateSceneRequest,
)

logger = logging.getLogger(__name__)

# Create router for tests (no endpoints - use GraphQL instead)
router = APIRouter()

# NOTE: REST HTTP endpoints have been REMOVED - use GraphQL instead
# GraphQL endpoint: POST /graphql with query/mutation
# These functions are kept for internal use by GraphQL resolvers


# Removed: @router.get("/{scene_id}", ...) - use GraphQL query { scene(id: "...") }
async def get_scene(scene_id: str):
    """
    Get scene metadata and active version
    Returns: { scene, activeVersion: { sceneGraph, rlConfig } }
    """
    try:
        client = get_client()
        if not client:
            raise HTTPException(
                status_code=404, detail="Scene not found (Convex not configured)"
            )
        result = client.query("scenes/get", {"id": scene_id})
        if not result:
            raise HTTPException(status_code=404, detail="Scene not found")
        return result
    except HTTPException:
        raise
    except requests.exceptions.HTTPError as e:
        if e.response and e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Scene not found")
        logger.error(f"Convex HTTP error getting scene: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get scene from Convex")
    except Exception as e:
        logger.error(f"Error getting scene: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/", ...) - use GraphQL mutation { createScene(...) }
async def create_scene(request: CreateSceneRequest):
    """
    Create a new scene
    """
    try:
        # TODO: Get createdBy from auth context
        # For now, require it in request
        client = get_client()
        if not client:
            raise HTTPException(
                status_code=500, detail="Convex client not configured"
            )
        
        # createdBy is required and must be a valid user ID
        created_by = getattr(request, "createdBy", None)
        if not created_by:
            raise HTTPException(
                status_code=400, detail="createdBy is required and must be a valid user ID"
            )
        
        # projectId should be None/undefined if empty string, not ""
        # Convex expects v.optional(v.id('environments')) which means None/undefined, not ""
        project_id = request.projectId if (request.projectId and request.projectId.strip()) else None
        
        # Build mutation args, omitting None/empty values (Convex handles optional better this way)
        mutation_args = {
            "name": request.name,
            "mode": request.mode,
            "environmentSettings": request.environmentSettings or {},
            "createdBy": created_by,
        }
        
        # Only include optional fields if they have values
        if project_id:
            mutation_args["projectId"] = project_id
        
        # description is optional - only include if it's not None/empty
        if request.description and request.description.strip():
            mutation_args["description"] = request.description
        
        mutation_result = client.mutation("scenes/create", mutation_args)
        
        # Handle wrapped response format (like queries)
        if isinstance(mutation_result, dict):
            if mutation_result.get("status") == "error":
                error_msg = mutation_result.get("errorMessage", "Unknown error")
                logger.error(f"Convex mutation error: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Failed to create scene: {error_msg}")
            elif mutation_result.get("status") == "success":
                scene_id = mutation_result.get("value")
            else:
                # Assume it's the direct result (backward compatibility)
                scene_id = mutation_result
        else:
            # Direct result (string ID)
            scene_id = mutation_result
        
        # Validate scene_id is a string
        if not isinstance(scene_id, str):
            logger.error(f"Invalid scene_id type: {type(scene_id)}, value: {scene_id}")
            raise HTTPException(status_code=500, detail="Failed to create scene: invalid response format")
        
        return {"id": scene_id, "name": request.name}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating scene: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.patch("/{scene_id}", ...) - use GraphQL mutation { updateScene(...) }
async def update_scene(scene_id: str, request: UpdateSceneRequest):
    """
    Update scene metadata
    """
    try:
        client = get_client()
        if not client:
            raise HTTPException(
                status_code=500, detail="Convex client not configured"
            )
        
        # Build update data - only include fields that Convex update mutation accepts
        # Note: projectId is NOT in the Convex update mutation args, so we omit it
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None and request.description.strip():
            update_data["description"] = request.description
        if request.mode is not None:
            update_data["mode"] = request.mode
        if request.environmentSettings is not None:
            update_data["environmentSettings"] = request.environmentSettings
        # projectId is NOT supported by Convex scenes:update mutation
        # If we need to update projectId, we'd need to add it to the Convex mutation

        mutation_result = client.mutation("scenes/update", {"id": scene_id, **update_data})
        
        # Handle wrapped response format
        if isinstance(mutation_result, dict):
            if mutation_result.get("status") == "error":
                error_msg = mutation_result.get("errorMessage", "Unknown error")
                logger.error(f"Convex mutation error: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Failed to update scene: {error_msg}")
            elif mutation_result.get("status") == "success":
                # Update mutation returns void, so success means it worked
                pass
        
        # Return success (mutation doesn't return the scene)
        return {"success": True}
        if not scene:
            raise HTTPException(status_code=404, detail="Scene not found")
        return scene
    except Exception as e:
        logger.error(f"Error updating scene: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/{scene_id}/versions", ...) - use GraphQL mutation { createSceneVersion(...) }
async def create_scene_version(scene_id: str, request: CreateSceneVersionRequest):
    """
    Create a new scene version
    Validates sceneGraph and rlConfig, increments version_number
    """
    try:
        # Validate sceneGraph and rlConfig using Pydantic
        scene_graph = request.sceneGraph
        rl_config = request.rlConfig

        # Additional validation for grid mode
        # TODO: Check if scene.mode == 'grid' and validate gridConfig

        client = get_client()
        # Use createdBy from request if provided, otherwise use sceneId as fallback
        created_by = getattr(request, "createdBy", None) or scene_id
        version_id = client.mutation(
            "scenes/createVersion",
            {
                "sceneId": scene_id,
                "sceneGraph": scene_graph.dict(),
                "rlConfig": rl_config.dict(),
                "createdBy": created_by,
            },
        )
        return {"id": version_id, "sceneId": scene_id}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error creating scene version: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/{scene_id}/versions/{version_number}", ...) - use GraphQL query { sceneVersion(...) }
async def get_scene_version(scene_id: str, version_number: int):
    """
    Get a specific scene version
    Returns: { sceneGraph, rlConfig }
    """
    try:
        client = get_client()
        version = client.query(
            "scenes/getVersion",
            {
                "sceneId": scene_id,
                "versionNumber": version_number,
            },
        )
        if not version:
            raise HTTPException(status_code=404, detail="Scene version not found")
        return {
            "sceneGraph": version.get("sceneGraph"),
            "rlConfig": version.get("rlConfig"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scene version: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/{scene_id}/versions", ...) - use GraphQL query { listSceneVersions(...) }
async def list_scene_versions(scene_id: str):
    """
    List all versions for a scene
    """
    try:
        client = get_client()
        versions = client.query("scenes/listVersions", {"sceneId": scene_id})
        return {"versions": versions or []}
    except Exception as e:
        logger.error(f"Error listing scene versions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
