"""
Asset/Library Service - CRUD operations for assets
"""
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from .models import CreateAssetRequest, UpdateAssetRequest
from .convex_client import get_client
from .cache import asset_cache, get_cache_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/")
async def list_assets(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type key"),
    mode: Optional[str] = Query(None, description="Filter by mode (grid, 2d, 3d, etc.)"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
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
        # First, get asset type ID if asset_type provided
        asset_type_id = None
        if asset_type:
            asset_type_obj = client.query("assetTypes/getByKey", {"key": asset_type})
            if asset_type_obj:
                asset_type_id = asset_type_obj["_id"]
        
        result = client.query("assets/list", {
            "projectId": project_id,
            "assetTypeId": asset_type_id,
            "mode": mode,
            "tag": tag,
        }) or []
        
        # Apply pagination
        if limit is not None:
            result = result[offset:offset + limit]
        
        # Cache result
        asset_cache.set(cache_key, result)
        return result
    except Exception as e:
        logger.error(f"Error listing assets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{asset_id}")
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


@router.post("/")
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
            asset_type = client.query("assetTypes/getByKey", {"key": request.assetTypeKey})
            if not asset_type:
                raise HTTPException(status_code=400, detail=f"Asset type '{request.assetTypeKey}' not found")
        except HTTPException:
            raise
        except Exception as e:
            # If query fails, it might be because asset type doesn't exist
            raise HTTPException(status_code=400, detail=f"Asset type '{request.assetTypeKey}' not found")
        
        asset_id = client.mutation("assets/create", {
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
        })
        
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


@router.patch("/{asset_id}")
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
        
        asset = client.mutation("assets/update", {
            "id": asset_id,
            **update_data,
        })
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


@router.delete("/{asset_id}")
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
                       f"Please remove the asset from all scenes before deleting."
            )
        
        # Delete the asset
        result = client.mutation("assets/remove", {"id": asset_id})
        if not result or not result.get("success"):
            raise HTTPException(status_code=404, detail="Asset not found or deletion failed")
        
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


@router.post("/{asset_id}/clone")
async def clone_asset(asset_id: str, project_id: Optional[str] = Query(None)):
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
        cloned_project_id = project_id if project_id is not None else original_asset.get("projectId")
        created_by = original_asset.get("createdBy") or cloned_project_id or "system"
        
        cloned_asset_id = client.mutation("assets/clone", {
            "assetId": asset_id,
            "projectId": cloned_project_id,
            "createdBy": created_by,
        })
        
        # Invalidate cache - new asset affects all list queries
        asset_cache.invalidate_pattern("assets:list")
        
        return {"id": cloned_asset_id, "name": f"{original_asset.get('name', 'Asset')} (Copy)"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cloning asset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

