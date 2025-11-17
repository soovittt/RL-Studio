"""
Infrastructure setup and health check endpoints
"""
from fastapi import APIRouter
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/infrastructure/setup")
async def setup_infrastructure_endpoint():
    """
    Endpoint to set up infrastructure (SkyPilot + AWS).
    Can be called from frontend to ensure infrastructure is ready.
    """
    try:
        from ..training.aws_setup import setup_infrastructure
        
        result = setup_infrastructure()
        
        return {
            "success": result.get("skypilot_installed", False) and result.get("aws_configured", False),
            "skypilot_installed": result.get("skypilot_installed", False),
            "aws_configured": result.get("aws_configured", False),
            "aws_accessible": result.get("aws_accessible", False),
            "errors": result.get("errors", []),
            "warnings": result.get("warnings", []),
        }
    except Exception as e:
        logger.error(f"Infrastructure setup failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/api/infrastructure/status")
async def infrastructure_status():
    """
    Check infrastructure status without making changes.
    """
    try:
        from ..training.aws_setup import verify_aws_setup
        
        result = verify_aws_setup()
        
        return {
            "skypilot_installed": result.get("skypilot_installed", False),
            "aws_configured": result.get("aws_configured", False),
            "aws_accessible": result.get("aws_accessible", False),
            "errors": result.get("errors", []),
        }
    except Exception as e:
        logger.error(f"Infrastructure status check failed: {e}", exc_info=True)
        return {
            "skypilot_installed": False,
            "aws_configured": False,
            "aws_accessible": False,
            "error": str(e),
        }

