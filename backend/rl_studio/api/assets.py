"""
Asset/Library Service - CRUD operations for assets
"""
import logging
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from .cache import asset_cache, get_cache_key
from .convex_client import get_client
from .models import CreateAssetRequest, UpdateAssetRequest

logger = logging.getLogger(__name__)

# Create router for tests (no endpoints - use GraphQL instead)
router = APIRouter()

# NOTE: REST HTTP endpoints have been REMOVED - use GraphQL instead
# GraphQL endpoint: POST /graphql with query/mutation
# These functions are kept for internal use by GraphQL resolvers

# Removed: @router.get("", ...) - use GraphQL query { assets(...) }
async def list_assets(
    project_id: Optional[str] = None,
    asset_type: Optional[str] = None,
    mode: Optional[str] = None,
    tag: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
):
    """
    List assets with optional filters and pagination
    Returns list of asset metadata (not full profiles)
    """
    try:
        # Check cache
        cache_key = get_cache_key(
            "assets:list",
            project_id=project_id,
            asset_type=asset_type,
            mode=mode,
            tag=tag,
            limit=limit,
            offset=offset,
        )
        cached = asset_cache.get(cache_key)
        if cached is not None:
            return cached

        client = get_client()
        if not client:
            # Convex not configured - return empty list (graceful degradation)
            logger.warning("Convex client not available, returning empty asset list")
            return []

        # First, get asset type ID if asset_type provided
        asset_type_id = None
        if asset_type:
            try:
                asset_type_obj = client.query(
                    "assetTypes/getByKey", {"key": asset_type}
                )
                if asset_type_obj:
                    asset_type_id = asset_type_obj["_id"]
            except Exception as e:
                logger.warning(f"Failed to get asset type: {e}")

        try:
            # Build args dict, only including non-None values
            # Convex v.optional() doesn't accept null, only undefined (omitted)
            query_args = {}
            if project_id is not None:
                query_args["projectId"] = project_id
            if asset_type_id is not None:
                query_args["assetTypeId"] = asset_type_id
            if mode is not None:
                query_args["mode"] = mode
            if tag is not None:
                query_args["tag"] = tag

            logger.info(f"Querying Convex for assets with args: {query_args}")
            result = client.query("assets/list", query_args)

            logger.info(
                f"Convex query result type: {type(result)}, length: {len(result) if isinstance(result, list) else 'N/A'}"
            )

            # Ensure result is always a list
            if not isinstance(result, list):
                logger.warning(
                    f"Convex query returned non-list for assets/list: {result}"
                )
                # If it's an error object, return empty list
                if isinstance(result, dict) and result.get("status") == "error":
                    logger.warning(
                        f"Convex returned error: {result.get('errorMessage', 'Unknown')}"
                    )
                return []

            logger.info(f"Returning {len(result)} assets from Convex")
            return result or []
        except requests.exceptions.HTTPError as e:
            # Handle 404 (route not found) - HTTP routes may not be deployed
            # Return empty list silently (graceful degradation)
            if e.response and e.response.status_code == 404:
                logger.debug(f"Convex HTTP route not available (404): assets/list")
            else:
                logger.warning(f"Convex HTTP error querying assets: {e}")
            return []  # Return empty list on error (graceful degradation)
        except Exception as e:
            logger.debug(f"Failed to query assets from Convex: {e}")
            # Return empty list on error (graceful degradation)
            return []

        # Apply pagination
        if limit is not None:
            result = result[offset : offset + limit]

        # Cache result
        asset_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.error(f"Error listing assets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/{asset_id}", ...) - use GraphQL query { asset(id: "...") }
async def get_asset(asset_id: str):
    """
    Get full asset details including all profiles
    """
    try:
        # Check cache
        cache_key = f"assets:get:{asset_id}"
        cached = asset_cache.get(cache_key)
        if cached is not None:
            return cached

        client = get_client()
        asset = client.query("assets/get", {"id": asset_id})
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Cache result
        asset_cache.set(cache_key, asset)
        return asset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting asset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/", ...) - use GraphQL mutation { createAsset(...) }
async def create_asset(request: CreateAssetRequest):
    """
    Create a new asset
    """
    try:
        client = get_client()
        # TODO: Get assetTypeId from assetTypeKey
        # For now, we'll need to query assetTypes first
        # This is a simplified version - in production, cache asset type IDs
        try:
            asset_type = client.query(
                "assetTypes/getByKey", {"key": request.assetTypeKey}
            )
            if not asset_type:
                raise HTTPException(
                    status_code=400,
                    detail=f"Asset type '{request.assetTypeKey}' not found",
                )
        except HTTPException:
            raise
        except Exception as e:
            # If query fails, it might be because asset type doesn't exist
            raise HTTPException(
                status_code=400, detail=f"Asset type '{request.assetTypeKey}' not found"
            )

        asset_id = client.mutation(
            "assets/create",
            {
                "projectId": request.projectId,
                "assetTypeId": asset_type["_id"],
                "name": request.name,
                "slug": request.slug,
                "thumbnailUrl": request.thumbnailUrl,
                "modelUrl": request.modelUrl,
                "geometry": request.geometry,
                "visualProfile": request.visualProfile,
                "physicsProfile": request.physicsProfile,
                "behaviorProfile": request.behaviorProfile,
                "meta": request.meta,
                "createdBy": request.projectId,  # TODO: Get from auth
            },
        )

        # Invalidate cache - new asset affects all list queries
        asset_cache.invalidate_pattern("assets:list")

        return {"id": asset_id, "name": request.name}
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating asset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.patch("/{asset_id}", ...) - use GraphQL mutation { updateAsset(...) }
async def update_asset(asset_id: str, request: UpdateAssetRequest):
    """
    Update an asset
    """
    try:
        client = get_client()
        # Check if asset exists first
        existing = client.query("assets/get", {"id": asset_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Build update dict from request
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.slug is not None:
            update_data["slug"] = request.slug
        if request.thumbnailUrl is not None:
            update_data["thumbnailUrl"] = request.thumbnailUrl
        if request.modelUrl is not None:
            update_data["modelUrl"] = request.modelUrl
        # Handle geometry - allow None to be explicitly set to remove geometry
        # Use request.dict() to check if geometry was explicitly provided
        request_dict = request.dict(exclude_unset=True)
        if "geometry" in request_dict:
            update_data["geometry"] = request.geometry
        if request.visualProfile is not None:
            update_data["visualProfile"] = request.visualProfile
        if request.physicsProfile is not None:
            update_data["physicsProfile"] = request.physicsProfile
        if request.behaviorProfile is not None:
            update_data["behaviorProfile"] = request.behaviorProfile
        if request.meta is not None:
            update_data["meta"] = request.meta

        asset = client.mutation(
            "assets/update",
            {
                "id": asset_id,
                **update_data,
            },
        )
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Invalidate cache - updated asset affects all list queries and this specific asset
        asset_cache.invalidate_pattern("assets:list")
        asset_cache.invalidate(f"assets:get:{asset_id}")

        return asset
    except HTTPException:
        raise
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Asset not found")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating asset {asset_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.delete("/{asset_id}", ...) - use GraphQL mutation { deleteAsset(...) }
async def delete_asset(asset_id: str):
    """
    Delete an asset (only if not referenced by any scenes)
    Checks if asset is used in any scene versions before deletion
    """
    try:
        client = get_client()

        # Check if asset exists first
        existing = client.query("assets/get", {"id": asset_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Check if asset is referenced in any scene versions
        references = client.query("assets/checkReferences", {"id": asset_id})
        if references and len(references) > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete asset: it is referenced in {len(references)} scene version(s). "
                f"Please remove the asset from all scenes before deleting.",
            )

        # Delete the asset
        result = client.mutation("assets/remove", {"id": asset_id})
        if not result or not result.get("success"):
            raise HTTPException(
                status_code=404, detail="Asset not found or deletion failed"
            )

        # Invalidate cache - deleted asset affects all list queries and this specific asset
        asset_cache.invalidate_pattern("assets:list")
        asset_cache.invalidate(f"assets:get:{asset_id}")

        return result
    except HTTPException:
        raise
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Asset not found")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting asset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/{asset_id}/clone", ...) - use GraphQL mutation { cloneAsset(...) }
async def clone_asset(asset_id: str, project_id: Optional[str] = None):
    """
    Clone a global asset to a project scope (or clone within same scope)
    Creates a copy of the asset with "(Copy)" appended to the name
    """
    try:
        client = get_client()

        # Get the original asset
        original_asset = client.query("assets/get", {"id": asset_id})
        if not original_asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Clone the asset
        # Use project_id from query param, or keep original projectId
        cloned_project_id = (
            project_id if project_id is not None else original_asset.get("projectId")
        )
        created_by = original_asset.get("createdBy") or cloned_project_id or "system"

        cloned_asset_id = client.mutation(
            "assets/clone",
            {
                "assetId": asset_id,
                "projectId": cloned_project_id,
                "createdBy": created_by,
            },
        )

        # Invalidate cache - new asset affects all list queries
        asset_cache.invalidate_pattern("assets:list")

        return {
            "id": cloned_asset_id,
            "name": f"{original_asset.get('name', 'Asset')} (Copy)",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning asset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
