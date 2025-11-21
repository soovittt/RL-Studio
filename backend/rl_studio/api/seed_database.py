"""
Script to seed the database with initial assets and templates
Can be run as a standalone script or called from the API
"""
import os
import sys
import json
import subprocess
import logging
from typing import Optional, Dict, Any
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from rl_studio.api.convex_client import get_client

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _run_convex_cli(function_path: str, args: Dict[str, Any] = None) -> Any:
    """
    Fallback: Run Convex function via CLI when HTTP routes fail
    
    Args:
        function_path: Function path (e.g., "seed:seedAssetTypes")
        args: Function arguments
        
    Returns:
        Function result
    """
    try:
        # Get CONVEX_DEPLOY_KEY from environment
        deploy_key = os.getenv("CONVEX_DEPLOY_KEY")
        if not deploy_key:
            # Try to load from .env.local
            env_local = Path(__file__).parent.parent.parent.parent / ".env.local"
            if env_local.exists():
                with open(env_local) as f:
                    for line in f:
                        if line.startswith("CONVEX_DEPLOY_KEY="):
                            deploy_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
        
        env = os.environ.copy()
        if deploy_key:
            env["CONVEX_DEPLOY_KEY"] = deploy_key
        
        # Build command
        cmd = ["npx", "convex", "run", function_path]
        if args:
            cmd.append(json.dumps(args))
        
        logger.info(f"Running Convex CLI: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
            cwd=Path(__file__).parent.parent.parent.parent,  # Project root
            timeout=60,
        )
        
        if result.returncode != 0:
            raise Exception(f"Convex CLI failed: {result.stderr}")
        
        # Parse JSON output
        output = result.stdout.strip()
        if output:
            return json.loads(output)
        return {}
    except Exception as e:
        logger.error(f"Convex CLI fallback failed: {e}")
        raise


def seed_assets(created_by: Optional[str] = None) -> dict:
    """
    Seed asset types and assets
    
    Args:
        created_by: User ID to attribute assets to
        
    Returns:
        Results from seeding
    """
    try:
        client = get_client()
        
        # Try HTTP routes first
        try:
            # Seed asset types first
            logger.info("Seeding asset types...")
            asset_type_results = client.mutation("seed/seedAssetTypes", {})
            logger.info(f"Asset types: {asset_type_results}")
            
            # Then seed assets
            logger.info("Seeding assets...")
            asset_args = {}
            if created_by:
                asset_args["createdBy"] = created_by
            asset_results = client.mutation("seed/seedAssets", asset_args)
            logger.info(f"Assets: {asset_results}")
            
            return {
                "assetTypes": asset_type_results,
                "assets": asset_results,
            }
        except Exception as http_error:
            # Fallback to CLI if HTTP routes fail
            logger.warning(f"HTTP routes failed ({http_error}), falling back to Convex CLI...")
            
            # Seed asset types
            logger.info("Seeding asset types via CLI...")
            asset_type_results = _run_convex_cli("seed:seedAssetTypes", {})
            logger.info(f"Asset types: {asset_type_results}")
            
            # Seed assets
            logger.info("Seeding assets via CLI...")
            asset_args = {}
            if created_by:
                asset_args["createdBy"] = created_by
            asset_results = _run_convex_cli("seed:seedAssets", asset_args)
            logger.info(f"Assets: {asset_results}")
            
            return {
                "assetTypes": asset_type_results,
                "assets": asset_results,
            }
    except Exception as e:
        logger.error(f"Error seeding assets: {e}", exc_info=True)
        raise


def seed_templates(project_id: Optional[str] = None, created_by: Optional[str] = None) -> dict:
    """
    Seed Phase 1 templates
    
    Args:
        project_id: Optional project ID. If None, templates are created as global (like assets)
        created_by: User ID to attribute templates to (uses system user if not provided)
        
    Returns:
        Results from seeding
    """
    try:
        client = get_client()
        
        # Try HTTP routes first
        try:
            logger.info("Seeding templates...")
            template_args: Dict[str, Any] = {}
            if project_id:
                template_args["projectId"] = project_id
            # If project_id is None, templates will be global (projectId=undefined)
            if created_by:
                template_args["createdBy"] = created_by
            template_results = client.mutation("seed/seedTemplates", template_args)
            logger.info(f"Templates: {template_results}")
            
            return template_results
        except Exception as http_error:
            # Fallback to CLI if HTTP routes fail
            logger.warning(f"HTTP routes failed ({http_error}), falling back to Convex CLI...")
            
            logger.info("Seeding templates via CLI...")
            template_args: Dict[str, Any] = {}
            if project_id:
                template_args["projectId"] = project_id
            if created_by:
                template_args["createdBy"] = created_by
            template_results = _run_convex_cli("seedTemplates:seedTemplates", template_args)
            logger.info(f"Templates: {template_results}")
            
            return template_results
    except Exception as e:
        logger.error(f"Error seeding templates: {e}", exc_info=True)
        raise


def seed_all(created_by: Optional[str] = None, project_id: Optional[str] = None) -> dict:
    """
    Seed everything (assets and templates)
    
    Args:
        created_by: User ID to attribute everything to
        project_id: Optional project ID for templates. If not provided,
                   templates will need to be seeded separately.
        
    Returns:
        Combined results
    """
    results = {
        "assets": None,
        "templates": None,
    }
    
    # Seed assets
    try:
        results["assets"] = seed_assets(created_by)
    except Exception as e:
        logger.error(f"Failed to seed assets: {e}")
        results["assets"] = {"error": str(e)}
    
    # Seed templates (project_id is optional - templates can be global)
    try:
        results["templates"] = seed_templates(project_id, created_by)
    except Exception as e:
        logger.error(f"Failed to seed templates: {e}")
        results["templates"] = {"error": str(e)}
    
    return results


if __name__ == "__main__":
    """
    Example usage:
    python -m rl_studio.api.seed_database
    
    Requires environment variables:
    - CONVEX_URL: Convex deployment URL
    - CONVEX_DEPLOY_KEY: Optional deploy key for mutations
    
    Or pass as arguments:
    python seed_database.py <created_by_user_id> [project_id]
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed RL Studio database")
    parser.add_argument(
        "created_by",
        nargs="?",
        help="User ID to attribute created resources to (optional, uses system user if not provided)",
    )
    parser.add_argument(
        "project_id",
        nargs="?",
        help="Project ID for templates (optional)",
    )
    parser.add_argument(
        "--assets-only",
        action="store_true",
        help="Only seed assets, not templates",
    )
    parser.add_argument(
        "--templates-only",
        action="store_true",
        help="Only seed templates, not assets",
    )
    
    args = parser.parse_args()
    
    if args.templates_only:
        if not args.project_id:
            logger.error("project_id required for template seeding")
            sys.exit(1)
        results = seed_templates(args.project_id, args.created_by)
    elif args.assets_only:
        results = seed_assets(args.created_by)
    else:
        results = seed_all(args.created_by, args.project_id)
    
    if not args.created_by:
        logger.info("Note: No user_id provided - used system user. Assets/templates are available to ALL users.")
    
    if not args.created_by:
        logger.info("Note: No user_id provided - used system user. Assets/templates are available to ALL users.")
    
    print("\n" + "=" * 60)
    print("SEEDING RESULTS")
    print("=" * 60)
    import json
    print(json.dumps(results, indent=2))
    print("=" * 60)

