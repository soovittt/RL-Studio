"""
Template Service - List templates and instantiate them into scenes
"""

import copy
import logging
from typing import List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from .cache import get_cache_key, template_cache
from .convex_client import get_client
from .models import CreateTemplateRequest, InstantiateTemplateRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", include_in_schema=True)
async def list_templates(
    mode: Optional[str] = Query(None, description="Filter by mode"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_public: bool = Query(True, description="Include public templates"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
    offset: Optional[int] = Query(0, description="Offset for pagination"),
):
    """
    List available templates with optional filters and pagination
    """
    try:
        # Check cache
        cache_key = get_cache_key(
            "templates:list",
            mode=mode,
            category=category,
            is_public=is_public,
            limit=limit,
            offset=offset,
        )
        cached = template_cache.get(cache_key)
        if cached is not None:
            return cached

        client = get_client()
        if not client:
            # Convex not configured - return empty list (graceful degradation)
            logger.warning("Convex client not available, returning empty template list")
            return []

        try:
            templates = (
                client.query(
                    "templates/list",
                    {
                        "mode": mode,
                        "category": category,
                        "isPublic": is_public,
                    },
                )
                or []
            )
        except requests.exceptions.HTTPError as e:
            # Handle 404 (route not found) - HTTP routes may not be deployed
            # Return empty list silently (graceful degradation)
            if e.response and e.response.status_code == 404:
                logger.debug(f"Convex HTTP route not available (404): templates/list")
            else:
                logger.warning(f"Convex HTTP error querying templates: {e}")
            return []  # Return empty list on error (graceful degradation)
        except Exception as e:
            logger.debug(f"Failed to query templates from Convex: {e}")
            return []  # Return empty list on error (graceful degradation)

        # Apply pagination
        if limit is not None:
            templates = templates[offset : offset + limit]

        # Cache result
        template_cache.set(cache_key, templates)
        return templates
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing templates: {e}", exc_info=True)
        # Return empty list instead of 500 error for better UX
        return []


@router.get("/{template_id}")
async def get_template(template_id: str):
    """
    Get template details including scene version
    """
    try:
        # Check cache
        cache_key = f"templates:get:{template_id}"
        cached = template_cache.get(cache_key)
        if cached is not None:
            return cached

        client = get_client()
        result = client.query("templates/get", {"id": template_id})
        if not result:
            raise HTTPException(status_code=404, detail="Template not found")

        # Cache result
        template_cache.set(cache_key, result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_template(request: CreateTemplateRequest):
    """
    Create a new template from a scene version
    """
    try:
        client = get_client()

        # Verify scene version exists
        scene_version = client.query(
            "sceneVersions/getById", {"id": request.sceneVersionId}
        )
        if not scene_version:
            raise HTTPException(status_code=404, detail="Scene version not found")

        # Create template
        template_id = client.mutation(
            "templates/create",
            {
                "name": request.name,
                "description": request.description,
                "sceneVersionId": request.sceneVersionId,
                "category": request.category,
                "tags": request.tags or [],
                "meta": request.meta or {},
                "isPublic": request.isPublic if request.isPublic is not None else True,
                "createdBy": request.createdBy
                or request.sceneVersionId,  # TODO: Get from auth
            },
        )

        # Invalidate cache - new template affects all list queries
        template_cache.invalidate_pattern("templates:list")

        return {"id": template_id, "name": request.name}
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{template_id}/instantiate")
async def instantiate_template(template_id: str, request: InstantiateTemplateRequest):
    """
    Instantiate a template into a new scene
    Creates a new scene with a new version containing copied scene_graph and rl_config
    """
    try:
        client = get_client()
        result = client.mutation(
            "templates/instantiate",
            {
                "templateId": template_id,
                "projectId": request.projectId,
                "name": request.name or None,  # Use template name if not provided
                "createdBy": request.projectId,  # TODO: Get from auth
            },
        )

        # Note: We don't invalidate template cache here because instantiating
        # a template doesn't change the template itself, only creates a new scene
        # Scene cache invalidation would be handled in scenes.py if needed

        return result
    except ValueError as e:
        # Template not found
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error instantiating template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
