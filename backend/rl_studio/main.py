"""
RL Studio Backend API - Main Application
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.graphql import graphql_router
from .api.health import router as health_router
from .api.routes import router as api_router
from .utils.cors_config import get_cors_config

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="RL Studio Backend API",
    description="Unified backend for RL environment rollouts and training job orchestration",
    version="1.0.0",
)

# Configure CORS middleware
cors_config = get_cors_config()
app.add_middleware(CORSMiddleware, **cors_config)

# Include routers
app.include_router(health_router)
app.include_router(api_router)

# Include GraphQL router (alongside REST APIs)
# GraphQLRouter from Strawberry is a FastAPI router, add it directly
app.include_router(graphql_router)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500, content={"error": "Internal server error", "detail": str(exc)}
    )
