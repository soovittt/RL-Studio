"""
Asset GraphQL resolvers
"""

import strawberry
import json
from typing import List, Optional
from ..types.asset import Asset, AssetInput, UpdateAssetInput, AssetFilter
from ..types.common import Pagination, PaginationInput
from ....api.convex_client import get_client


@strawberry.type
class AssetResolver:
    """Asset queries and mutations"""
    
    @strawberry.field
    async def assets(
        self,
        filter: Optional[AssetFilter] = None,
        pagination: Optional[PaginationInput] = None
    ) -> List[Asset]:
        """Get list of assets with optional filtering - uses same logic as REST API"""
        try:
            # Import REST API function to ensure identical behavior (caching, error handling, etc.)
            from ....api.assets import list_assets
            
            # Convert GraphQL filter to REST API parameters
            project_id = filter.project_id if filter else None
            asset_type = filter.asset_type if filter else None
            mode = filter.mode if filter else None
            tag = filter.tag if filter else None
            limit = pagination.limit if pagination else None
            offset = pagination.offset if pagination else 0
            
            # Call the EXACT same REST API function (ensures identical behavior, caching, etc.)
            result = await list_assets(
                project_id=project_id,
                asset_type=asset_type,
                mode=mode,
                tag=tag,
                limit=limit,
                offset=offset
            )
            
            if not result or not isinstance(result, list):
                return []
            
            # Convert REST API response to GraphQL types
            assets = []
            for item in result:
                assets.append(Asset(
                    id=item.get("_id", ""),
                    name=item.get("name", ""),
                    asset_type=item.get("assetTypeKey", ""),
                    geometry=json.dumps(item.get("geometry", {})) if item.get("geometry") else None,
                    visual_profile=json.dumps(item.get("visualProfile", {})) if item.get("visualProfile") else None,
                    physics_profile=json.dumps(item.get("physicsProfile", {})) if item.get("physicsProfile") else None,
                    behavior_profile=json.dumps(item.get("behaviorProfile", {})) if item.get("behaviorProfile") else None,
                    meta=json.dumps(item.get("meta", {})) if item.get("meta") else None,
                    created_at=item.get("_creationTime"),
                    updated_at=item.get("_creationTime"),
                ))
            
            # Apply search filter if provided (client-side filtering)
            if filter and filter.search:
                search_lower = filter.search.lower()
                assets = [
                    a for a in assets
                    if search_lower in a.name.lower() or search_lower in a.asset_type.lower()
                ]
            
            return assets
        except Exception as e:
            # Log error but return empty list (same as REST API graceful degradation)
            import logging
            logging.error(f"Error fetching assets: {e}")
            return []
    
    @strawberry.field
    async def asset(self, id: str) -> Optional[Asset]:
        """Get a single asset by ID - uses same logic as REST API"""
        try:
            # Import REST API function to ensure identical behavior (caching, error handling, etc.)
            from ....api.assets import get_asset
            
            # Call the EXACT same REST API function (ensures identical behavior, caching, etc.)
            result = await get_asset(id)
            
            if not result:
                return None
            
            return Asset(
                id=result.get("_id", ""),
                name=result.get("name", ""),
                asset_type=result.get("assetTypeKey", ""),
                geometry=json.dumps(result.get("geometry", {})) if result.get("geometry") else None,
                visual_profile=json.dumps(result.get("visualProfile", {})) if result.get("visualProfile") else None,
                physics_profile=json.dumps(result.get("physicsProfile", {})) if result.get("physicsProfile") else None,
                behavior_profile=json.dumps(result.get("behaviorProfile", {})) if result.get("behaviorProfile") else None,
                meta=json.dumps(result.get("meta", {})) if result.get("meta") else None,
                created_at=result.get("_creationTime"),
                updated_at=result.get("_creationTime"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error fetching asset {id}: {e}")
            return None
    
    @strawberry.mutation
    async def create_asset(self, input: AssetInput) -> Asset:
        """Create a new asset"""
        try:
            # Import REST API function to ensure identical behavior
            from ....api.assets import create_asset as rest_create_asset
            from ....api.models import CreateAssetRequest
            
            # Parse JSON strings
            geometry = json.loads(input.geometry) if input.geometry else None
            visual_profile = json.loads(input.visual_profile) if input.visual_profile else {}
            physics_profile = json.loads(input.physics_profile) if input.physics_profile else {}
            behavior_profile = json.loads(input.behavior_profile) if input.behavior_profile else {}
            meta = json.loads(input.meta) if input.meta else {}
            
            # Create request object
            request = CreateAssetRequest(
                projectId=input.project_id,
                assetTypeKey=input.asset_type_key,
                name=input.name,
                slug=input.slug,
                thumbnailUrl=input.thumbnail_url,
                modelUrl=input.model_url,
                geometry=geometry,
                visualProfile=visual_profile,
                physicsProfile=physics_profile,
                behaviorProfile=behavior_profile,
                meta=meta,
            )
            
            # Call REST API function
            result = await rest_create_asset(request)
            
            # Fetch the created asset
            created_asset = await self.asset(result["id"])
            if not created_asset:
                raise Exception("Failed to fetch created asset")
            
            return created_asset
        except Exception as e:
            import logging
            logging.error(f"Error creating asset: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def update_asset(self, id: str, input: UpdateAssetInput) -> Asset:
        """Update an asset"""
        try:
            # Import REST API function
            from ....api.assets import update_asset as rest_update_asset
            from ....api.models import UpdateAssetRequest
            
            # Parse JSON strings
            geometry = json.loads(input.geometry) if input.geometry else None
            visual_profile = json.loads(input.visual_profile) if input.visual_profile else None
            physics_profile = json.loads(input.physics_profile) if input.physics_profile else None
            behavior_profile = json.loads(input.behavior_profile) if input.behavior_profile else None
            meta = json.loads(input.meta) if input.meta else None
            
            # Create request object
            request = UpdateAssetRequest(
                name=input.name,
                slug=input.slug,
                thumbnailUrl=input.thumbnail_url,
                modelUrl=input.model_url,
                geometry=geometry,
                visualProfile=visual_profile,
                physicsProfile=physics_profile,
                behaviorProfile=behavior_profile,
                meta=meta,
            )
            
            # Call REST API function
            await rest_update_asset(id, request)
            
            # Fetch the updated asset
            updated_asset = await self.asset(id)
            if not updated_asset:
                raise Exception("Failed to fetch updated asset")
            
            return updated_asset
        except Exception as e:
            import logging
            logging.error(f"Error updating asset: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def delete_asset(self, id: str) -> bool:
        """Delete an asset"""
        try:
            # Import REST API function
            from ....api.assets import delete_asset as rest_delete_asset
            
            # Call REST API function
            await rest_delete_asset(id)
            return True
        except Exception as e:
            import logging
            logging.error(f"Error deleting asset: {e}", exc_info=True)
            raise

