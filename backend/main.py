"""
Entry point for RL Studio Backend
"""
import os
import sys
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

# Set up logging IMMEDIATELY - this must happen first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
    force=True  # Force reconfiguration
)
logger = logging.getLogger(__name__)

# Flush stdout immediately
sys.stdout.flush()
sys.stderr.flush()

logger.info("=" * 50)
logger.info("RL Studio Backend Starting...")
logger.info("=" * 50)
sys.stdout.flush()

# Import app - this may take time due to heavy dependencies
try:
    logger.info("Step 1: Importing RL Studio app...")
    sys.stdout.flush()
    from rl_studio.main import app
    logger.info("✅ Step 1: App imported successfully")
    sys.stdout.flush()
except Exception as e:
    logger.error(f"❌ Step 1 FAILED: Failed to import app: {e}", exc_info=True)
    sys.stdout.flush()
    sys.stderr.flush()
    sys.exit(1)

if __name__ == "__main__":
    # Cloud Run sets PORT automatically (usually 8080)
    # For local dev, default to 8000
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    # Log environment info
    env_mode = "development" if debug else "production"
    logger.info(f"Starting RL Studio Backend API in {env_mode} mode on {host}:{port}")
    
    # Warn about missing optional but recommended variables
    if not os.getenv("CONVEX_URL"):
        logger.warning("⚠️ CONVEX_URL not set. Some features may not work.")
    
    try:
        # Use uvicorn programmatically for Cloud Run compatibility
        # Cloud Run requires the server to bind to 0.0.0.0 and the PORT env var
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="info",
            access_log=True,
            reload=debug,  # Enable reload in development
        )
        
        server = uvicorn.Server(config)
        logger.info(f"✅ Server starting on {host}:{port}")
        logger.info("=" * 50)
        sys.stdout.flush()
        
        # Start the server (this blocks)
        server.run()
        
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"❌ FAILED to start server: {e}", exc_info=True)
        sys.stdout.flush()
        sys.stderr.flush()
        sys.exit(1)

