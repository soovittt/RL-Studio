"""
Convex Local Development Helper
Fetches and seeds local Convex database for open-source development.

This allows users to work locally without needing access to production database.
"""

import os
import json
import requests
from typing import Dict, Any, Optional, List
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ConvexLocalDev:
    """Helper for local Convex development"""
    
    def __init__(self, convex_url: Optional[str] = None):
        self.convex_url = convex_url or os.getenv("CONVEX_URL") or os.getenv("VITE_CONVEX_URL")
        if not self.convex_url:
            raise ValueError("CONVEX_URL or VITE_CONVEX_URL must be set")
        
        # Remove /api suffix if present
        self.convex_http = self.convex_url.replace("/api", "").rstrip("/")
        if not self.convex_http.startswith("http"):
            self.convex_http = f"https://{self.convex_http}"
    
    def seed_local_data(self) -> bool:
        """
        Seed local Convex database with sample data.
        This is safe to run - it only creates sample data for development.
        """
        try:
            logger.info("🌱 Seeding local Convex database with sample data...")
            
            response = requests.post(
                f"{self.convex_http}/api/action",
                json={
                    "path": "seed_local_data:seedAll",
                    "args": {}
                },
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.ok:
                result = response.json()
                if result.get("success"):
                    logger.info("✅ Local data seeded successfully")
                    logger.info(f"   Environments: {result.get('results', {}).get('environments', {}).get('count', 0)}")
                    logger.info(f"   Runs: {result.get('results', {}).get('runs', {}).get('count', 0)}")
                    logger.info(f"   Evaluations: {result.get('results', {}).get('evaluations', {}).get('count', 0)}")
                    return True
                else:
                    logger.warning(f"Seeding returned success=false: {result}")
                    return False
            else:
                logger.warning(f"Seeding failed: HTTP {response.status_code}")
                logger.warning(f"Response: {response.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Failed to seed local data: {e}")
            return False
    
    def get_environments(self) -> List[Dict[str, Any]]:
        """Get all environments from Convex"""
        try:
            response = requests.post(
                f"{self.convex_http}/api/action",
                json={
                    "path": "environments:list",
                    "args": {}
                },
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.ok:
                return response.json() or []
            else:
                logger.warning(f"Failed to get environments: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error getting environments: {e}")
            return []
    
    def get_runs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent runs from Convex"""
        try:
            response = requests.post(
                f"{self.convex_http}/api/action",
                json={
                    "path": "runs:listRecent",
                    "args": {}
                },
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.ok:
                runs = response.json() or []
                return runs[:limit]
            else:
                logger.warning(f"Failed to get runs: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error getting runs: {e}")
            return []


def setup_local_convex_dev() -> bool:
    """
    Set up local Convex development environment.
    Seeds sample data if database is empty.
    """
    try:
        dev = ConvexLocalDev()
        
        # Check if we have any environments
        envs = dev.get_environments()
        if len(envs) == 0:
            logger.info("No environments found. Seeding local data...")
            return dev.seed_local_data()
        else:
            logger.info(f"Found {len(envs)} existing environments. Skipping seed.")
            return True
    except Exception as e:
        logger.error(f"Failed to setup local Convex dev: {e}")
        return False

