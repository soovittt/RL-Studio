"""
Convex HTTP client for backend services
Allows Python backend to call Convex queries and mutations
"""

import logging
import os
from typing import Any, Dict, Optional

import requests

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
            os.getenv("K_SERVICE") is not None
            or os.getenv("GAE_SERVICE") is not None  # Google Cloud Run
            or os.getenv("AWS_EXECUTION_ENV") is not None  # Google App Engine
            or os.getenv("VERCEL") is not None  # AWS Lambda
            or os.getenv("ENVIRONMENT", "").lower() == "production"  # Vercel
        )

        # Development mode: not in production AND (DEBUG=true OR no explicit production indicators)
        is_dev = not is_production and (
            os.getenv("DEBUG", "false").lower() == "true"
            or os.getenv("ENVIRONMENT", "").lower() == "development"
            or os.getenv("FLASK_ENV", "").lower() == "development"
            or True  # Default to dev if not explicitly in production
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
        Call a Convex query via standard HTTP API endpoint

        Args:
            path: Function path in format "module:function" (e.g., "assets:list")
            args: Query arguments

        Returns:
            Query result, or empty list on error
        """
        try:
            # Ensure path is in "module:function" format
            if "/" in path:
                # Convert "assets/list" to "assets:list"
                api_path = path.replace("/", ":")
            else:
                api_path = path

            # Log the request for debugging
            request_payload = {"path": api_path, "args": args or {}}
            logger.info(f"📤 Calling Convex query: {api_path} with args: {args or {}}")

            # Use Convex standard HTTP API endpoint
            response = requests.post(
                f"{self.convex_url}/api/query",
                json=request_payload,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            # Check response status before parsing
            if response.status_code != 200:
                logger.error(
                    f"❌ Convex query returned status {response.status_code} for {api_path}"
                )
                logger.error(f"Response text: {response.text[:500]}")
                return []

            result = response.json()
            logger.info(
                f"📥 Convex response status: {result.get('status', 'unknown')}, keys: {list(result.keys())}"
            )

            # Convex HTTP API wraps responses in {"status": "success", "value": <actual_result>}
            # or {"status": "error", "errorMessage": "..."}
            if isinstance(result, dict):
                if result.get("status") == "error":
                    error_msg = result.get(
                        "errorMessage", result.get("error", "Unknown error")
                    )
                    error_data = result.get("errorData", {})
                    logger.error(
                        f"❌ Convex query returned error for {api_path}: {error_msg}"
                    )
                    logger.error(f"Full error response: {result}")
                    if error_data:
                        logger.error(f"Error data: {error_data}")
                    return []
                elif result.get("status") == "success":
                    # Extract the actual value from the success response
                    actual_result = result.get("value")
                    logger.info(
                        f"✅ Convex query success for {api_path}, extracted {len(actual_result) if isinstance(actual_result, list) else 'non-list'} items"
                    )
                    return actual_result if actual_result is not None else []
                # If it's a dict but not a known status, might be the actual data (backward compatibility)
                # But for list queries, we expect arrays, so return empty list
                if api_path.endswith(":list") or api_path.endswith("/list"):
                    logger.warning(
                        f"Convex list query returned unexpected dict for {api_path}: {result}"
                    )
                    return []

            return result
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else None
            if status_code == 404:
                logger.debug(f"Convex query not found: {api_path}")
                return []
            logger.debug(f"Convex query HTTP error ({status_code}): {api_path}")
            return []
        except requests.exceptions.RequestException as e:
            logger.debug(f"Convex query network error: {api_path} - {e}")
            return []

    def mutation(self, path: str, args: Dict[str, Any] = None) -> Any:
        """
        Call a Convex mutation via standard HTTP API endpoint

        Args:
            path: Function path in format "module:function" (e.g., "scenes:create")
            args: Mutation arguments

        Returns:
            Mutation result
        """
        try:
            # Ensure path is in "module:function" format
            if "/" in path:
                api_path = path.replace("/", ":")
            else:
                api_path = path

            # Use Convex standard HTTP API endpoint
            response = requests.post(
                f"{self.convex_url}/api/mutation",
                json={"path": api_path, "args": args or {}},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            result = response.json()
            return result
        except requests.exceptions.RequestException as e:
            logger.error(f"Convex mutation failed: {api_path} - {e}")
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
            logger.warning(
                f"⚠️ Convex client not initialized: {e}. Some features may not work."
            )
            return None
    return _client
