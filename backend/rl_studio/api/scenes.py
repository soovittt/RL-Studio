"""
Scene Service - CRUD operations for scenes and scene versions
"""

import logging
from typing import Any, Dict, Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from .convex_client import get_client
from .models import (CreateSceneRequest, CreateSceneVersionRequest, RLConfig,
                     SceneGraph, UpdateSceneRequest)

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
        # For now, require it in request or use a default
        client = get_client()
        # Use createdBy from request if provided, otherwise use projectId as fallback
        created_by = (
            getattr(request, "createdBy", None) or request.projectId or "system"
        )
        scene_id = client.mutation(
            "scenes/create",
            {
                "projectId": request.projectId,
                "name": request.name,
                "description": request.description,
                "mode": request.mode,
                "environmentSettings": request.environmentSettings or {},
                "createdBy": created_by,
            },
        )
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
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.mode is not None:
            update_data["mode"] = request.mode
        if request.environmentSettings is not None:
            update_data["environmentSettings"] = request.environmentSettings
        if request.projectId is not None:
            update_data["projectId"] = request.projectId

        scene = client.mutation("scenes/update", {"id": scene_id, **update_data})
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
