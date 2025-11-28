"""
RL Environment Compile Service
Compiles scene_graph + rl_config to runtime specs for training/rollout
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError

from .convex_client import get_client
from .models import RLConfig, SceneGraph

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/compile", tags=["compile"])


class CompileFromDataRequest(BaseModel):
    scene_graph: Dict[str, Any] = Field(..., description="Scene graph data")
    rl_config: Dict[str, Any] = Field(..., description="RL configuration")
    resolve_assets: bool = Field(
        True, description="Whether to resolve asset references"
    )


# Register more specific route first to avoid path parameter matching
@router.post("/env-spec/from-data")
async def compile_from_data(request: CompileFromDataRequest):
    """
    Compile scene_graph + rl_config directly (without loading from DB)
    Useful for testing or when data is already in memory
    """
    try:
        # Only get client if we need asset resolution
        client = None
        if request.resolve_assets:
            try:
                client = get_client()
            except ValueError:
                # CONVEX_URL not set - skip asset resolution
                logger.warning("CONVEX_URL not set, skipping asset resolution")
                request.resolve_assets = False

        return await compile_from_data_internal(
            request.scene_graph,
            request.rl_config,
            resolve_assets=request.resolve_assets,
            client=client,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error compiling from data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/env-spec/{scene_version_id}")
async def compile_scene_version(scene_version_id: str):
    """
    Compile a scene version to runtime environment spec
    Loads scene_graph and rl_config, resolves assets, produces unified runtime spec
    """
    try:
        # Get scene version from Convex
        client = get_client()
        scene_version = client.query("sceneVersions/getById", {"id": scene_version_id})

        if not scene_version:
            raise HTTPException(status_code=404, detail="Scene version not found")

        # Extract scene_graph and rl_config
        scene_graph_data = scene_version.get("sceneGraph", {})
        rl_config_data = scene_version.get("rlConfig", {})

        # Validate and compile
        return await compile_from_data_internal(
            scene_graph_data, rl_config_data, resolve_assets=True, client=client
        )

    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=f"Validation error: {str(e)}")
    except Exception as e:
        logger.error(f"Error compiling scene version: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def compile_from_data_internal(
    scene_graph: Dict[str, Any],
    rl_config: Dict[str, Any],
    resolve_assets: bool = True,
    client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Internal compile function (shared by both endpoints)
    """
    # Validate inputs
    scene_graph_model = SceneGraph(**scene_graph)
    rl_config_model = RLConfig(**rl_config)

    # Get client if needed for asset resolution
    if client is None and resolve_assets:
        try:
            client = get_client()
        except ValueError:
            # CONVEX_URL not set in test environment - skip asset resolution
            logger.warning("CONVEX_URL not set, skipping asset resolution")
            resolve_assets = False
            client = None

    # Resolve assets if requested
    resolved_entities = []
    if resolve_assets:
        for entity in scene_graph_model.entities:
            resolved_entity = {
                "id": entity.id,
                "name": entity.name,
                "transform": entity.transform.dict(),
                "components": entity.components,
            }

            # Resolve asset if assetId is present
            if entity.assetId:
                try:
                    asset = client.query("assets/get", {"id": entity.assetId})
                    if asset:
                        # Merge asset profiles with entity overrides
                        resolved_entity["visual"] = {
                            **asset.get("visualProfile", {}),
                            **entity.components.get("render", {}),
                        }
                        resolved_entity["physics"] = {
                            **asset.get("physicsProfile", {}),
                            **entity.components.get("physics", {}),
                        }
                        resolved_entity["behavior"] = {
                            **asset.get("behaviorProfile", {}),
                            **entity.components.get("behavior", {}),
                        }
                        resolved_entity["assetName"] = asset.get("name")
                        resolved_entity["modelUrl"] = asset.get("modelUrl")
                except Exception as asset_error:
                    logger.warning(
                        f"Failed to resolve asset {entity.assetId}: {asset_error}"
                    )
                    # Continue without asset data

            resolved_entities.append(resolved_entity)
    else:
        # Just use entities as-is
        resolved_entities = [
            {
                "id": e.id,
                "name": e.name,
                "transform": e.transform.dict(),
                "components": e.components,
            }
            for e in scene_graph_model.entities
        ]

    # Build unified runtime spec
    runtime_spec = {
        "entities": resolved_entities,
        "metadata": scene_graph_model.metadata,
        "rlConfig": rl_config_model.dict(),
        "version": "1.0",
    }

    return {
        "success": True,
        "spec": runtime_spec,
        "format": "runtime_spec_v1",
    }


class CompileFromDataRequest(BaseModel):
    scene_graph: Dict[str, Any] = Field(..., description="Scene graph data")
    rl_config: Dict[str, Any] = Field(..., description="RL configuration")
    resolve_assets: bool = Field(
        True, description="Whether to resolve asset references"
    )
