"""
Migration script to convert existing environments to scenes
Reads from old Convex 'environments' table and creates scenes in new Scene Service
"""
import os
import sys
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from rl_studio.api.convex_client import get_client
from rl_studio.api.scenes import create_scene, create_scene_version
from rl_studio.api.models import CreateSceneRequest, CreateSceneVersionRequest
from rl_studio.api.envSpecToSceneGraph import envSpecToSceneGraph, envSpecToRLConfig

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


def load_env_spec_from_legacy(env: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert legacy environment format to EnvSpec format
    This is a simplified version - in production, you'd use SceneGraphManager.migrateFromLegacy
    """
    # If already in EnvSpec format, return as-is
    if env.get('envSpec'):
        return env['envSpec']
    
    # Convert from legacy format
    env_type = env.get('envType') or env.get('type') or 'grid'
    
    # Build basic EnvSpec structure
    env_spec = {
        'id': env.get('_id', ''),
        'name': env.get('name', 'Untitled Environment'),
        'type': env_type,
        'world': {
            'type': env_type,
            'width': 10,
            'height': 10,
            'coordinateSystem': env_type,
        },
        'objects': [],
        'agents': env.get('agents', []),
        'rules': {
            'rewards': [],
            'terminations': [],
        },
        'episode': env.get('episode', {'maxSteps': 100}),
        'metadata': env.get('metadata', {'tags': []}),
    }
    
    # Convert reward rules
    if env.get('reward'):
        reward = env['reward']
        if isinstance(reward, dict) and reward.get('rules'):
            env_spec['rules']['rewards'] = reward['rules']
        elif isinstance(reward, dict):
            # Single reward rule
            env_spec['rules']['rewards'] = [reward]
    
    # Convert action space
    if env.get('actionSpace'):
        env_spec['actionSpace'] = env['actionSpace']
    
    return env_spec


def migrate_environment(env: Dict[str, Any], client) -> Dict[str, Any]:
    """
    Migrate a single environment to scene format
    """
    try:
        env_id = env.get('_id')
        owner_id = env.get('ownerId')
        name = env.get('name', 'Untitled Environment')
        
        if not env_id or not owner_id:
            return {
                'action': 'skipped',
                'reason': 'Missing _id or ownerId',
                'env_id': env_id,
            }
        
        # Check if scene already exists
        try:
            existing_scene = client.query("scenes/get", {"id": env_id})
            if existing_scene:
                return {
                    'action': 'skipped',
                    'reason': 'Scene already exists',
                    'env_id': env_id,
                    'scene_id': env_id,
                }
        except Exception:
            # Scene doesn't exist, continue migration
            pass
        
        # Load EnvSpec (convert from legacy if needed)
        env_spec = load_env_spec_from_legacy(env)
        
        # Convert to sceneGraph + rlConfig
        try:
            scene_graph = envSpecToSceneGraph(env_spec)
            rl_config = envSpecToRLConfig(env_spec)
        except Exception as e:
            logger.warning(f"Failed to convert env {env_id} to sceneGraph: {e}")
            return {
                'action': 'error',
                'reason': f'Conversion failed: {str(e)}',
                'env_id': env_id,
            }
        
        # Determine mode
        mode = env_spec.get('type') or env.get('envType') or 'grid'
        if mode not in ['grid', '2d', '3d']:
            mode = 'grid'  # Default to grid
        
        # Create scene
        scene = client.mutation("scenes/create", {
            "projectId": env_id,  # Use environment ID as project ID
            "name": name,
            "description": env.get('description'),
            "mode": mode,
            "environmentSettings": {},
            "createdBy": owner_id,
        })
        
        # Create initial version
        version_id = client.mutation("scenes/createVersion", {
            "sceneId": scene,
            "sceneGraph": scene_graph,
            "rlConfig": rl_config,
            "createdBy": owner_id,
        })
        
        return {
            'action': 'migrated',
            'env_id': env_id,
            'scene_id': scene,
            'version_id': version_id,
            'name': name,
        }
        
    except Exception as e:
        logger.error(f"Error migrating environment {env.get('_id')}: {e}", exc_info=True)
        return {
            'action': 'error',
            'reason': str(e),
            'env_id': env.get('_id'),
        }


def migrate_all_environments(
    limit: Optional[int] = None,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Migrate all environments from old system to new Scene Service
    
    Args:
        limit: Maximum number of environments to migrate (None for all)
        dry_run: If True, don't actually create scenes, just report what would be done
    
    Returns:
        Migration results summary
    """
    try:
        client = get_client()
        
        # Query all environments from old system
        # Note: This requires a Convex query - we'll need to add an HTTP route for this
        # For now, we'll use a workaround: query via Convex HTTP action
        
        logger.info("Fetching environments from old system...")
        
        # Try to get environments via HTTP action
        # Since we don't have direct DB access, we'll need to create a migration endpoint
        # For now, return a message that this needs to be done via Convex action
        
        return {
            'status': 'requires_convex_action',
            'message': 'Migration requires a Convex action to query environments. See migrate_environments_convex.ts',
        }
        
    except Exception as e:
        logger.error(f"Error in migration: {e}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e),
        }


if __name__ == "__main__":
    """
    Example usage:
    python -m rl_studio.api.migrate_environments [--limit N] [--dry-run]
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate environments to scenes")
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of environments to migrate",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't actually create scenes, just report what would be done",
    )
    
    args = parser.parse_args()
    
    results = migrate_all_environments(limit=args.limit, dry_run=args.dry_run)
    
    print("\n" + "=" * 60)
    print("MIGRATION RESULTS")
    print("=" * 60)
    import json
    print(json.dumps(results, indent=2))
    print("=" * 60)

