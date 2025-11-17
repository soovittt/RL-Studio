"""
Entry point for RL Studio Backend
"""
import os
import uvicorn
import logging

from rl_studio.main import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting RL Studio Backend API on {host}:{port}")
    
    uvicorn.run(
        "rl_studio.main:app",
        host=host,
        port=port,
        reload=os.getenv("DEBUG", "false").lower() == "true",
        log_level="info"
    )

