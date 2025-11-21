"""
Convex HTTP client for backend services
Allows Python backend to call Convex queries and mutations
"""
import os
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class ConvexClient:
    """HTTP client for calling Convex functions from Python backend"""

    def __init__(self, convex_url: Optional[str] = None):
        """
        Initialize Convex client with proper dev vs prod handling
        
        Args:
            convex_url: Convex deployment URL (e.g., https://xxx.convex.cloud)
                       If None, automatically detects dev vs prod
        """
        # Check if we're in development mode
        # In development, ALWAYS use local Convex dev server (ignore production CONVEX_URL)
        # In production, use CONVEX_URL from environment
        
        # Detect production environment (Cloud Run, etc.)
        is_production = (
            os.getenv("K_SERVICE") is not None or  # Google Cloud Run
            os.getenv("GAE_SERVICE") is not None or  # Google App Engine
            os.getenv("AWS_EXECUTION_ENV") is not None or  # AWS Lambda
            os.getenv("VERCEL") is not None or  # Vercel
            os.getenv("ENVIRONMENT", "").lower() == "production"
        )
        
        # Development mode: not in production AND (DEBUG=true OR no explicit production indicators)
        is_dev = not is_production and (
            os.getenv("DEBUG", "false").lower() == "true" or
            os.getenv("ENVIRONMENT", "").lower() == "development" or
            os.getenv("FLASK_ENV", "").lower() == "development" or
            True  # Default to dev if not explicitly in production
        )
        
        if convex_url:
            # Use provided URL (explicit override)
            self.convex_url = convex_url.replace("/api", "").rstrip("/")
            logger.info(f"🔧 Using provided Convex URL: {self.convex_url}")
        else:
            # Use same Convex URL for both dev and prod (production deployment)
            # Priority: CONVEX_URL > VITE_CONVEX_URL > error
            convex_url_env = os.getenv("CONVEX_URL") or os.getenv("VITE_CONVEX_URL")
            if not convex_url_env:
                raise ValueError(
                    "CONVEX_URL or VITE_CONVEX_URL environment variable must be set. "
                    "Set it to your Convex deployment URL (e.g., https://xxx.convex.cloud)"
                )
            self.convex_url = convex_url_env.replace("/api", "").rstrip("/")
            env_label = "🚀 Production" if not is_dev else "🔧 Development"
            logger.info(f"{env_label}: Using Convex URL: {self.convex_url}")
        
        # Ensure URL has protocol
        if not self.convex_url.startswith("http"):
            self.convex_url = f"https://{self.convex_url}"

    def query(self, path: str, args: Dict[str, Any] = None) -> Any:
        """
        Call a Convex query via HTTP action wrapper
        
        Args:
            path: Function path (e.g., "assets/list" for HTTP route or "assets:list" for direct)
            args: Query arguments
            
        Returns:
            Query result
        """
        try:
            # Try HTTP route first (if path contains /, it's already a route path)
            if '/' in path:
                route_path = path
            else:
                # Convert "assets:list" to "assets/list" for HTTP route
                route_path = path.replace(':', '/')
            
            response = requests.post(
                f"{self.convex_url}/api/{route_path}",
                json=args or {},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            result = response.json()
            # Handle Convex HTTP action response format
            if isinstance(result, dict) and "value" in result:
                return result["value"]
            return result
        except requests.exceptions.HTTPError as e:
            if e.response and e.response.status_code == 404:
                # HTTP route not found - this means HTTP routes aren't working
                # This is expected if HTTP routes aren't deployed properly
                logger.error(f"Convex HTTP route not found: /api/{route_path}. HTTP routes may not be deployed.")
                raise
            logger.error(f"Convex query failed: {path} - {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"Convex query failed: {path} - {e}")
            raise

    def mutation(self, path: str, args: Dict[str, Any] = None) -> Any:
        """
        Call a Convex mutation via HTTP action wrapper
        
        Args:
            path: Function path (e.g., "scenes:create")
            args: Mutation arguments
            
        Returns:
            Mutation result
        """
        try:
            # Use HTTP route endpoint
            response = requests.post(
                f"{self.convex_url}/api/{path}",
                json=args or {},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            result = response.json()
            # Handle Convex HTTP action response format
            if isinstance(result, dict) and "value" in result:
                return result["value"]
            return result
        except requests.exceptions.RequestException as e:
            logger.error(f"Convex mutation failed: {path} - {e}")
            raise

    def action(self, path: str, args: Dict[str, Any] = None) -> Any:
        """
        Call a Convex action
        
        Args:
            path: Function path (e.g., "import:fromPaper")
            args: Action arguments
            
        Returns:
            Action result
        """
        try:
            response = requests.post(
                f"{self.convex_url}/api/action",
                json={"path": path, "args": args or {}},
                headers={"Content-Type": "application/json"},
                timeout=30,  # Actions can take longer
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Convex action failed: {path} - {e}")
            raise


# Global client instance (lazy initialization)
_client: Optional[ConvexClient] = None


def get_client() -> Optional[ConvexClient]:
    """
    Get or create global Convex client
    Returns None if Convex URL is not configured (allows graceful degradation)
    """
    global _client
    if _client is None:
        try:
            _client = ConvexClient()
        except ValueError as e:
            logger.warning(f"⚠️ Convex client not initialized: {e}. Some features may not work.")
            return None
    return _client

