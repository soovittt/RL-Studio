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
        Initialize Convex client
        
        Args:
            convex_url: Convex deployment URL (e.g., https://xxx.convex.cloud)
                       If None, reads from CONVEX_URL env var
        """
        self.convex_url = convex_url or os.getenv("CONVEX_URL", "").replace("/api", "")
        if not self.convex_url:
            raise ValueError("CONVEX_URL environment variable not set")
        if not self.convex_url.startswith("http"):
            self.convex_url = f"https://{self.convex_url}"

    def query(self, path: str, args: Dict[str, Any] = None) -> Any:
        """
        Call a Convex query via HTTP action wrapper
        
        Args:
            path: Function path (e.g., "scenes:get")
            args: Query arguments
            
        Returns:
            Query result
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


def get_client() -> ConvexClient:
    """Get or create global Convex client"""
    global _client
    if _client is None:
        _client = ConvexClient()
    return _client

