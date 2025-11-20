"""
Entry point for RL Studio Backend
"""
import os
import uvicorn
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"✅ Loaded .env from {env_path}")
else:
    # Try loading from current directory as fallback
    load_dotenv()
    logging.info("⚠️ No .env file found in backend directory, using environment variables")

from rl_studio.main import app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    # Log environment info
    env_mode = "development" if debug else "production"
    logger.info(f"Starting RL Studio Backend API in {env_mode} mode on {host}:{port}")
    
    # Warn about missing optional but recommended variables
    if not os.getenv("CONVEX_URL"):
        logger.warning("⚠️ CONVEX_URL not set. Some features may not work.")
    
    uvicorn.run(
        "rl_studio.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )

