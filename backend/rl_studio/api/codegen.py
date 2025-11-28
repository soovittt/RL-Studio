"""
API endpoints for code generation using GPT
Generates production-ready code based on actual environment configuration
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Lazy imports - CodeGenerator loads OpenAI client which can be slow
# Cache functions are lightweight, so import them directly
from ..codegen.cache import (clear_cache, get_cache_stats, get_cached_code,
                             set_cached_code)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/codegen", tags=["codegen"])


class GenerateCodeRequest(BaseModel):
    env_spec: Dict[str, Any]
    file_type: str  # "environment", "training", "config", "skypilot", "readme", "env_spec"
    training_config: Optional[Dict[str, Any]] = None
    algorithm: Optional[str] = "ppo"


class GenerateCodeResponse(BaseModel):
    success: bool
    code: Optional[str] = None
    error: Optional[str] = None
    file_name: Optional[str] = None


class SaveCodeRequest(BaseModel):
    env_spec: Dict[str, Any]
    file_type: str
    code: str
    file_name: str
    training_config: Optional[Dict[str, Any]] = None
    algorithm: Optional[str] = "ppo"


class SaveCodeResponse(BaseModel):
    success: bool
    error: Optional[str] = None


@router.post("/generate", response_model=GenerateCodeResponse)
async def generate_code(request: GenerateCodeRequest):
    """
    Generate code using GPT API based on actual environment configuration

    Uses caching: Only generates if env_spec/config changed (hash-based)
    Returns cached code instantly if available.

    Uses actual:
    - Reward rules and calculations
    - Action space and dynamics
    - Termination conditions
    - World structure and objects
    - Training configuration (hyperparameters, episodes, runs)
    """
    try:
        env_spec = request.env_spec
        file_type = request.file_type
        training_config = request.training_config or {}
        algorithm = request.algorithm or "ppo"

        # Check cache first - FAST PATH
        cached = get_cached_code(env_spec, file_type, training_config, algorithm)
        if cached:
            logger.info(f"✅ Cache HIT for {file_type} - returning instantly")
            return GenerateCodeResponse(
                success=True, code=cached["code"], file_name=cached["file_name"]
            )

        # Cache miss - generate code
        logger.info(f"🔄 Cache MISS for {file_type} - generating new code")
        # Lazy import to avoid loading OpenAI client at startup
        from ..codegen.code_generator import CodeGenerator

        generator = CodeGenerator()

        if file_type == "environment":
            code = generator.generate_environment_code(env_spec, training_config)
            file_name = (
                f"{env_spec.get('name', 'env').replace(' ', '_').lower()}_env.py"
            )

        elif file_type == "training":
            code = generator.generate_training_code(
                env_spec, training_config, algorithm
            )
            file_name = "train.py"

        elif file_type == "config":
            # Generate YAML config
            hyperparams = training_config.get("hyperparams", {})
            code = f"""hyperparameters:
  learning_rate: {hyperparams.get('learning_rate', 3e-4)}
  gamma: {hyperparams.get('gamma', 0.99)}
  total_timesteps: {hyperparams.get('steps', 1000000)}

environment:
  name: {env_spec.get('name', 'Untitled')}
  type: {env_spec.get('envType', 'grid')}
  description: {env_spec.get('metadata', {}).get('notes', '')}

rl_concepts:
  reward_shaping: {training_config.get('concepts', {}).get('rewardShaping', False)}
  curriculum: {training_config.get('concepts', {}).get('curriculum', False)}
  imitation: {training_config.get('concepts', {}).get('imitation', False)}
  exploration_bonus: {training_config.get('concepts', {}).get('explorationBonus', False)}
"""
            file_name = "config.yaml"

        elif file_type == "skypilot":
            env_name = env_spec.get("name", "untitled").replace(" ", "-").lower()
            algorithm = request.algorithm or "ppo"
            hyperparams = training_config.get("hyperparams", {})

            code = f"""name: {env_name}-training

resources:
  accelerators: A10:1  # Options: A10:1, A100:1, T4:1, V100:1, L4:1, etc.
  # Use spot instances for ~70% cost savings (auto-recovery on preemption)
  use_spot: true
  # Optional: specify cloud provider (auto-selects cheapest if not specified)
  # infra: aws  # or gcp, azure, k8s, etc.

# Workdir: Local directory to sync to cluster (~/sky_workdir/ on cluster)
# SkyPilot automatically syncs this directory before running
workdir: .

setup: |
  # Install RL dependencies
  # Setup runs under workdir, so files from workdir are available
  pip install -q stable-baselines3>=2.2.0 gymnasium>=0.29.0 torch>=2.0.0
  pip install -q numpy>=1.24.0 scipy>=1.10.0 requests>=2.31.0

run: |
  # Run commands execute under workdir
  # SkyPilot automatically syncs workdir before running
  python train.py

env:
  RUN_ID: {training_config.get('run_id', 'local')}
  CONVEX_URL: ${{CONVEX_URL}}
  ALGORITHM: {algorithm.upper()}
  LEARNING_RATE: {hyperparams.get('learning_rate', 3e-4)}
  GAMMA: {hyperparams.get('gamma', 0.99)}
  TOTAL_TIMESTEPS: {hyperparams.get('steps', 1000000)}
  ENV_NAME: {env_name}
  ENV_TYPE: {env_spec.get('envType', 'grid')}
  PYTHONUNBUFFERED: 1

# Optional: Mount cloud bucket for checkpoints (persistent storage)
# file_mounts:
#   /checkpoint:
#     name: my-checkpoint-bucket  # Your S3/GS bucket name
#     mode: MOUNT  # or MOUNT_CACHED for read-heavy workloads

# Optional: Auto-stop cluster after idle time (cost management)
# resources:
#   autostop: 10m  # Stop after 10 minutes of idleness
"""
            file_name = "skypilot.yaml"

        elif file_type == "readme":
            rewards = env_spec.get("rules", {}).get("rewards", [])
            terminations = env_spec.get("rules", {}).get("terminations", [])
            objects = env_spec.get("objects", [])
            agents = env_spec.get("agents", [])
            world = env_spec.get("world", {})

            code = f"""# {env_spec.get('name', 'Untitled Environment')}

{env_spec.get('metadata', {}).get('notes', 'RL training project exported from RL Studio')}

## Environment

Type: {env_spec.get('envType', 'grid')}
Algorithm: {algorithm.upper()}
World: {world.get('width', 10)} × {world.get('height', 10)}
Objects: {len(objects)}
Agents: {len(agents)}

## Reward Rules

{chr(10).join([f"- {r.get('condition', {}).get('type', 'unknown')}: {r.get('reward', 0)}" for r in rewards]) if rewards else 'None'}

## Termination Conditions

{chr(10).join([f"- {t.get('condition', {}).get('type', 'unknown')}" for t in terminations]) if terminations else 'None (max steps only)'}

## Training

```bash
python train.py
```

## SkyPilot

```bash
sky launch skypilot.yaml
```
"""
            file_name = "README.md"

        elif file_type == "env_spec":
            import json

            code = json.dumps(env_spec, indent=2)
            file_name = "env_spec.json"

        else:
            raise HTTPException(
                status_code=400, detail=f"Unknown file type: {file_type}"
            )

        # Cache the generated code for future requests
        set_cached_code(
            env_spec, file_type, training_config, algorithm, code, file_name
        )
        logger.info(f"💾 Cached {file_type} for future requests")

        return GenerateCodeResponse(success=True, code=code, file_name=file_name)

    except Exception as e:
        logger.error(f"Code generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache/stats")
async def get_cache_statistics():
    """Get cache statistics (for debugging)"""
    return get_cache_stats()


@router.post("/cache/clear")
async def clear_code_cache():
    """Clear all cached code (for debugging/testing)"""
    count = clear_cache()
    return {"success": True, "cleared_entries": count}


@router.post("/save", response_model=SaveCodeResponse)
async def save_code(request: SaveCodeRequest):
    """
    Save edited code to backend storage
    Updates cache with user-edited code
    """
    try:
        env_spec = request.env_spec
        file_type = request.file_type
        code = request.code
        file_name = request.file_name
        training_config = request.training_config or {}
        algorithm = request.algorithm or "ppo"

        # Update cache with edited code
        set_cached_code(
            env_spec, file_type, training_config, algorithm, code, file_name
        )

        logger.info(f"💾 Saved edited {file_type} code ({len(code)} bytes)")

        return SaveCodeResponse(success=True)

    except Exception as e:
        logger.error(f"Code save failed: {e}", exc_info=True)
        return SaveCodeResponse(success=False, error=str(e))


@router.post("/generate-all", response_model=Dict[str, str])
async def generate_all_files(request: GenerateCodeRequest):
    """
    Generate all code files at once
    Returns a dictionary mapping file names to code content
    """
    try:
        # Lazy import to avoid loading OpenAI client at startup
        from ..codegen.code_generator import CodeGenerator

        generator = CodeGenerator()
        env_spec = request.env_spec
        training_config = request.training_config or {}
        algorithm = request.algorithm or "ppo"

        files = {}

        # Generate environment code
        files[
            f"{env_spec.get('name', 'env').replace(' ', '_').lower()}_env.py"
        ] = generator.generate_environment_code(env_spec, training_config)

        # Generate training code
        files["train.py"] = generator.generate_training_code(
            env_spec, training_config, algorithm
        )

        # Generate config
        hyperparams = training_config.get("hyperparams", {})
        files[
            "config.yaml"
        ] = f"""hyperparameters:
  learning_rate: {hyperparams.get('learning_rate', 3e-4)}
  gamma: {hyperparams.get('gamma', 0.99)}
  total_timesteps: {hyperparams.get('steps', 1000000)}

environment:
  name: {env_spec.get('name', 'Untitled')}
  type: {env_spec.get('envType', 'grid')}
  description: {env_spec.get('metadata', {}).get('notes', '')}
"""

        # Generate SkyPilot YAML
        env_name = env_spec.get("name", "untitled").replace(" ", "-").lower()
        files[
            "skypilot.yaml"
        ] = f"""name: {env_name}-training

resources:
  accelerators: A10:1

setup: |
  pip install stable-baselines3 gymnasium torch numpy scipy

run: |
  python train.py
"""

        # Generate README
        rewards = env_spec.get("rules", {}).get("rewards", [])
        terminations = env_spec.get("rules", {}).get("terminations", [])
        files[
            "README.md"
        ] = f"""# {env_spec.get('name', 'Untitled Environment')}

{env_spec.get('metadata', {}).get('notes', 'RL training project exported from RL Studio')}

## Environment

Type: {env_spec.get('envType', 'grid')}
Algorithm: {algorithm.upper()}

## Training

```bash
python train.py
```
"""

        # Generate env_spec JSON
        import json

        files["env_spec.json"] = json.dumps(env_spec, indent=2)

        return files

    except Exception as e:
        logger.error(f"Code generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
