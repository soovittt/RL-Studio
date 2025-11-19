"""
Entry point for RL Studio Backend
"""
import os
import sys
import uvicorn
import logging

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
    
    logger.info(f"Step 2: Configuring server on {host}:{port}")
    logger.info(f"📋 Environment: PORT={port}, HOST={host}")
    sys.stdout.flush()
    
    try:
        # Use uvicorn programmatically for Cloud Run
        # Cloud Run requires the server to bind to 0.0.0.0 and the PORT env var
        logger.info("Step 3: Creating uvicorn server...")
        sys.stdout.flush()
        
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            log_level="info",
            access_log=True,
            reload=False,  # Disable reload in production
        )
        
        logger.info("Step 4: Starting server...")
        sys.stdout.flush()
        
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

