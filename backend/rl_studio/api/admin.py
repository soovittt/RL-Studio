"""
Admin endpoints for maintenance
"""
import logging

from fastapi import APIRouter

from .convex_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


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
