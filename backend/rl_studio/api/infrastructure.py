"""
Infrastructure Configuration API
Provides endpoints for checking and managing infrastructure configuration.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..utils.infrastructure_config import get_infrastructure_config

router = APIRouter(prefix="/api/infrastructure", tags=["infrastructure"])


class InfrastructureStatusResponse(BaseModel):
    storage: Dict[str, Any]
    compute: Dict[str, Any]
    summary: str


@router.get("/status")
async def get_infrastructure_status():
    """
    Get current infrastructure configuration status.
    Shows which providers are configured and what's missing.
    """
    try:
        config = get_infrastructure_config()
        summary = config.get_config_summary()

        # Build human-readable summary
        storage_valid = summary["storage"]["valid"]
        compute_valid = summary["compute"]["valid"]

        if storage_valid and compute_valid:
            summary_text = "✅ All infrastructure configured"
        elif storage_valid:
            summary_text = "⚠️ Storage configured, compute not configured"
        elif compute_valid:
            summary_text = "⚠️ Compute configured, storage not configured"
        else:
            summary_text = "⚠️ Using local storage and compute (no cloud configured)"

        return InfrastructureStatusResponse(
            storage=summary["storage"], compute=summary["compute"], summary=summary_text
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/validate")
async def validate_infrastructure():
    """
    Validate infrastructure configuration.
    Returns detailed validation results.
    """
    try:
        config = get_infrastructure_config()

        storage_valid, storage_error = config.validate_storage_config()
        compute_valid, compute_error = config.validate_compute_config()

        return {
            "storage": {
                "valid": storage_valid,
                "error": storage_error,
                "provider": config.storage_provider,
            },
            "compute": {
                "valid": compute_valid,
                "error": compute_error,
                "provider": config.compute_provider,
            },
            "all_valid": storage_valid and compute_valid,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_infrastructure_config_endpoint():
    """
    Get current infrastructure configuration (without sensitive data).
    """
    try:
        config = get_infrastructure_config()
        summary = config.get_config_summary()

        # Remove sensitive data
        safe_summary = {
            "storage": {
                "provider": summary["storage"]["provider"],
                "valid": summary["storage"]["valid"],
                "config": {
                    k: v
                    for k, v in summary["storage"]["config"].items()
                    if "key" not in k.lower()
                    and "secret" not in k.lower()
                    and "password" not in k.lower()
                },
            },
            "compute": {
                "provider": summary["compute"]["provider"],
                "valid": summary["compute"]["valid"],
                "config": {
                    k: v
                    for k, v in summary["compute"]["config"].items()
                    if "key" not in k.lower()
                    and "secret" not in k.lower()
                    and "password" not in k.lower()
                },
            },
        }

        return safe_summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
