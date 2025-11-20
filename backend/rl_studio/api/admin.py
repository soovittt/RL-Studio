"""
Admin endpoints for database seeding and maintenance
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .seed_database import seed_assets, seed_templates, seed_all
from .convex_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class SeedRequest(BaseModel):
    created_by: Optional[str] = Field(None, description="User ID to attribute resources to (optional, uses system user if not provided)")
    project_id: Optional[str] = Field(None, description="Project ID for templates (optional)")


@router.post("/seed/assets")
async def admin_seed_assets(request: SeedRequest):
    """
    Admin endpoint to seed assets
    Assets are created as GLOBAL (available to all users)
    If created_by is not provided, uses system user
    """
    try:
        results = seed_assets(request.created_by)
        return {
            "success": True,
            "results": results,
            "message": "Assets seeded successfully. They are now available to all users.",
        }
    except Exception as e:
        logger.error(f"Error seeding assets: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed/templates")
async def admin_seed_templates(request: SeedRequest):
    """
    Admin endpoint to seed templates
    Templates are created as PUBLIC and GLOBAL (available to all users)
    If project_id is not provided, templates are created as global (like assets)
    If created_by is not provided, uses system user
    """
    
    try:
        results = seed_templates(request.project_id, request.created_by)
        return {
            "success": True,
            "results": results,
            "message": "Templates seeded successfully. They are now available to all users.",
        }
    except Exception as e:
        logger.error(f"Error seeding templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed/all")
async def admin_seed_all(request: SeedRequest):
    """
    Admin endpoint to seed everything (assets and templates)
    All resources are created as GLOBAL/PUBLIC (available to all users)
    If created_by is not provided, uses system user automatically
    """
    try:
        results = seed_all(request.created_by, request.project_id)
        return {
            "success": True,
            "results": results,
            "message": "Database seeded successfully. All assets and templates are now available to all users.",
        }
    except Exception as e:
        logger.error(f"Error seeding database: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def admin_health():
    """Health check for admin endpoints"""
    try:
        client = get_client()
        # Try a simple query to verify connection
        return {
            "status": "healthy",
            "convex_connected": True,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "convex_connected": False,
            "error": str(e),
        }

