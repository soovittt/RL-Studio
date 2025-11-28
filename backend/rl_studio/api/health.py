"""
Health check endpoint
"""

from datetime import datetime

from fastapi import APIRouter

from .models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        services={"rollout": "available", "job_orchestrator": "available"},
    )
