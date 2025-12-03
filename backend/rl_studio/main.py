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
from .middleware.error_middleware import ErrorHandlingMiddleware
from .utils.cors_config import get_cors_config
from .utils.error_handler import handle_error
from .exceptions import RLStudioError

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

# Add error handling middleware (after CORS, before routes)
app.add_middleware(ErrorHandlingMiddleware)

# Include routers
app.include_router(health_router)
app.include_router(api_router)

# Include GraphQL router (alongside REST APIs)
# GraphQLRouter from Strawberry is a FastAPI router, add it directly
app.include_router(graphql_router)


# Global exception handler (fallback for errors not caught by middleware)
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    # Convert to RLStudioError and handle properly
    rl_error = handle_error(
        exc,
        default_message="An unexpected error occurred",
        context={"path": str(request.url), "method": request.method},
    )
    
    # Get request ID if available
    request_id = getattr(request.state, "request_id", None)
    
    return JSONResponse(
        status_code=getattr(rl_error, "status_code", 500),
        content={
            "success": False,
            "error": rl_error.to_dict(),
            "request_id": request_id,
        },
        headers={"X-Request-ID": request_id} if request_id else {},
    )
