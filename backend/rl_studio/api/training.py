"""
API endpoints for RL training features
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Lazy imports - don't load heavy ML libraries until actually needed
# This allows the server to start quickly

router = APIRouter(prefix="/api/training", tags=["training"])

# NOTE: Research-related REST endpoints are DEPRECATED in favor of GraphQL
# GraphQL endpoint: POST /graphql with mutations/queries
# These endpoints are kept for backward compatibility but will be removed in a future version


class SuggestHyperparametersRequest(BaseModel):
    env_spec: Dict[str, Any]
    algorithm: str = "PPO"


class CreateCurriculumRequest(BaseModel):
    env_spec: Dict[str, Any]
    stages: Optional[List[Dict[str, Any]]] = None


class HyperparameterSweepRequest(BaseModel):
    algorithm: str
    env_spec: Dict[str, Any]
    base_config: Dict[str, Any]
    search_space: Dict[str, List[Any]]
    search_type: str = "grid"  # "grid", "random", "bayesian"
    n_trials: int = 10
    seed: Optional[int] = None


class CompareRunsRequest(BaseModel):
    run_results: List[Dict[str, Any]]
    metric: str = "mean_reward"
    alpha: float = 0.05


@router.get("/algorithms")
async def get_algorithms(action_space_type: str = "discrete"):
    """Get available algorithms for action space type"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..training.algorithms import AlgorithmRegistry

        algorithms = AlgorithmRegistry.get_available_algorithms(action_space_type)
        return {"success": True, "algorithms": algorithms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/hyperparameters/suggest")
async def suggest_hyperparameters(request: SuggestHyperparametersRequest):
    """Get hyperparameter suggestions"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..training.hyperparameter_suggestions import HyperparameterSuggester

        suggester = HyperparameterSuggester()
        suggestions = suggester.suggest(request.env_spec, request.algorithm)
        return {"success": True, "suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/curriculum/create")
async def create_curriculum(request: CreateCurriculumRequest):
    """Create a curriculum learning setup"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..training.curriculum import CurriculumLearningEngine

        curriculum = CurriculumLearningEngine(request.env_spec)

        # Add default stages if none provided
        if not request.stages:
            from ..training.curriculum import (
                make_easier_goals,
                mean_reward_threshold,
                reduce_obstacles,
            )

            curriculum.add_stage(
                "Easy",
                make_easier_goals,
                mean_reward_threshold(5.0),
                "Easier goals, closer to start",
            )
            curriculum.add_stage(
                "Medium",
                reduce_obstacles,
                mean_reward_threshold(10.0),
                "Fewer obstacles",
            )
            curriculum.add_stage(
                "Hard",
                lambda spec: spec,  # No modification
                mean_reward_threshold(15.0),
                "Full difficulty",
            )
        else:
            # Add custom stages
            for stage in request.stages:
                # Parse stage definition (simplified)
                curriculum.add_stage(
                    stage.get("name", "Stage"),
                    lambda spec: spec,  # Placeholder
                    lambda rewards: len(rewards) >= 10
                    and sum(rewards) / len(rewards) >= stage.get("threshold", 0),
                    stage.get("description", ""),
                )

        return {
            "success": True,
            "curriculum": {
                "num_stages": len(curriculum.stages),
                "current_stage": curriculum.get_stage_info(),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/sweep/generate", ...) - use GraphQL mutation { generateHyperparameterSweep(...) }
async def generate_hyperparameter_sweep(request: HyperparameterSweepRequest):
    """Generate hyperparameter sweep trials"""
    try:
        from ..training.hyperparameter_sweep import HyperparameterSweep

        sweep = HyperparameterSweep(
            search_type=request.search_type,
            n_trials=request.n_trials,
            seed=request.seed,
        )

        trials = sweep.generate_trials(request.search_space)

        return {
            "success": True,
            "n_trials": len(trials),
            "trials": trials,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/compare", ...) - use GraphQL mutation { compareRuns(...) }
async def compare_runs(request: CompareRunsRequest):
    """Compare multiple training runs with statistical analysis"""
    try:
        from ..training.research_analysis import StatisticalAnalysis

        comparison = StatisticalAnalysis.compare_runs(
            run_results=request.run_results,
            metric=request.metric,
            alpha=request.alpha,
        )

        return {
            "success": True,
            "comparison": comparison,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/analyze/confidence-interval", ...) - use GraphQL mutation { calculateConfidenceInterval(...) }
async def calculate_confidence_interval(values: List[float], confidence: float = 0.95):
    """Calculate confidence interval for a set of values"""
    try:
        from ..training.research_analysis import StatisticalAnalysis

        ci = StatisticalAnalysis.confidence_interval(values, confidence)

        return {
            "success": True,
            "confidence_interval": ci,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/analyze/effect-size", ...) - use GraphQL mutation { calculateEffectSize(...) }
async def calculate_effect_size(group1: List[float], group2: List[float]):
    """Calculate effect size (Cohen's d) between two groups"""
    try:
        from ..training.research_analysis import StatisticalAnalysis

        effect = StatisticalAnalysis.effect_size(group1, group2)

        return {
            "success": True,
            "effect_size": effect,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/save-checkpoint")
async def save_model_checkpoint(
    run_id: str,
    checkpoint_name: str,
    model_path: str,
    metadata: Optional[Dict[str, Any]] = None,
):
    """Save a model checkpoint with versioning"""
    try:
        from ..training.model_versioning import ModelVersionManager

        manager = ModelVersionManager()
        checkpoint_path = manager.save_checkpoint(
            model_path=model_path,
            run_id=run_id,
            checkpoint_name=checkpoint_name,
            metadata=metadata,
        )

        return {
            "success": True,
            "checkpoint_path": checkpoint_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/models/{run_id}/checkpoints", ...) - use GraphQL query { listCheckpoints(...) }
async def list_model_checkpoints(run_id: str):
    """List all checkpoints for a run"""
    try:
        from ..training.model_versioning import ModelVersionManager

        manager = ModelVersionManager()
        checkpoints = manager.list_checkpoints(run_id)

        return {
            "success": True,
            "checkpoints": checkpoints,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/models/{run_id}/versions", ...) - use GraphQL query { listModelVersions(...) }
async def list_model_versions(run_id: str):
    """List all versions for a run"""
    try:
        from ..training.model_versioning import ModelVersionManager

        manager = ModelVersionManager()
        versions = manager.list_versions(run_id)

        return {
            "success": True,
            "versions": versions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/models/{run_id}/create-version", ...) - use GraphQL mutation { createModelVersion(...) }
async def create_model_version(
    run_id: str,
    checkpoint_name: str,
    version_name: Optional[str] = None,
    tags: Optional[List[str]] = None,
    description: Optional[str] = None,
):
    """Create a versioned model from a checkpoint"""
    try:
        from ..training.model_versioning import ModelVersionManager

        manager = ModelVersionManager()
        version = manager.create_version(
            run_id=run_id,
            checkpoint_name=checkpoint_name,
            version_name=version_name,
            tags=tags,
            description=description,
        )

        return {
            "success": True,
            "version": version,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TestWandbConnectionRequest(BaseModel):
    api_key: str


class TestMlflowConnectionRequest(BaseModel):
    tracking_uri: Optional[str] = None


# Removed: @router.post("/tracking/test-wandb", ...) - use GraphQL mutation { testWandbConnection(...) }
async def test_wandb_connection(request: TestWandbConnectionRequest):
    """Test Weights & Biases connection with provided API key"""
    try:
        # Validate API key format first
        api_key = request.api_key.strip()

        if not api_key:
            return {
                "success": False,
                "message": "API key cannot be empty. Please enter your W&B API key.",
            }

        # W&B API keys are typically 40+ characters
        # They can be:
        # 1. Raw hex string (40 characters): "349f94638ba41ca817e5bca31e9c7983ed442c79"
        # 2. Prefixed format: "wandb-..." or "local-..."
        if len(api_key) < 40:
            return {
                "success": False,
                "message": f"API key is too short ({len(api_key)} characters). W&B API keys must be at least 40 characters. Please check your key at https://wandb.ai/settings",
            }

        # Both formats are valid - just validate length and proceed

        import os

        # Temporarily set the API key
        original_key = os.environ.get("WANDB_API_KEY")
        os.environ["WANDB_API_KEY"] = api_key

        try:
            import wandb

            # Try to login/verify the API key
            wandb.login(key=api_key, relogin=True)

            # Test by initializing a test run
            test_run = wandb.init(
                project="rl-studio-test",
                name="connection-test",
                mode="disabled",  # Don't actually log anything
            )
            test_run.finish()

            return {
                "success": True,
                "message": "Successfully connected to Weights & Biases",
            }
        except ValueError as e:
            error_msg = str(e)
            if "at least 40 characters" in error_msg:
                return {
                    "success": False,
                    "message": f"Invalid API key format: {error_msg}. Please check your key at https://wandb.ai/settings",
                }
            return {
                "success": False,
                "message": f"Invalid API key: {error_msg}. Please verify your key at https://wandb.ai/settings",
            }
        except Exception as e:
            error_msg = str(e)
            # Provide helpful error messages
            if (
                "authentication" in error_msg.lower()
                or "unauthorized" in error_msg.lower()
            ):
                return {
                    "success": False,
                    "message": "Authentication failed. Please check your API key at https://wandb.ai/settings and make sure it's correct.",
                }
            elif "network" in error_msg.lower() or "connection" in error_msg.lower():
                return {
                    "success": False,
                    "message": f"Connection error: {error_msg}. Please check your internet connection.",
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to connect: {error_msg}. Please verify your API key at https://wandb.ai/settings",
                }
        finally:
            # Restore original key
            if original_key:
                os.environ["WANDB_API_KEY"] = original_key
            elif "WANDB_API_KEY" in os.environ:
                del os.environ["WANDB_API_KEY"]
    except ImportError:
        return {
            "success": False,
            "message": "wandb package not installed. Install with: pip install wandb",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.post("/tracking/test-mlflow", ...) - use GraphQL mutation { testMlflowConnection(...) }
async def test_mlflow_connection(request: TestMlflowConnectionRequest):
    """Test MLflow connection"""
    try:
        import mlflow

        if request.tracking_uri:
            mlflow.set_tracking_uri(request.tracking_uri)

        # Try to create a test experiment
        try:
            mlflow.create_experiment("rl-studio-test", exist_ok=True)
            return {
                "success": True,
                "message": "Successfully connected to MLflow",
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to connect: {str(e)}",
            }
    except ImportError:
        return {
            "success": False,
            "message": "mlflow package not installed. Install with: pip install mlflow",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/tracking/wandb/runs", ...) - use GraphQL query { listWandbRuns(...) }
async def list_wandb_runs(
    project: Optional[str] = None,
    api_key: Optional[str] = None,
):
    """List W&B runs for a project"""
    try:
        import os

        import wandb
        from fastapi import Header

        # Get API key from header, query param, or env
        # Note: In production, prefer header for security
        if not api_key:
            api_key = os.environ.get("WANDB_API_KEY")

        if not api_key:
            raise HTTPException(status_code=401, detail="W&B API key required")

        # Set API key
        os.environ["WANDB_API_KEY"] = api_key
        wandb.login(key=api_key, relogin=True)

        # Initialize API
        api_instance = wandb.Api()
        project_name = project or "rl-studio"

        # List runs
        runs = api_instance.runs(project_name)

        runs_data = []
        for run in runs:
            runs_data.append(
                {
                    "id": run.id,
                    "name": run.name,
                    "state": run.state,
                    "config": run.config,
                    "summary": run.summary,
                    "url": run.url,
                    "createdAt": run.created_at.isoformat() if run.created_at else None,
                    "updatedAt": run.updated_at.isoformat() if run.updated_at else None,
                }
            )

        return {"success": True, "runs": runs_data}
    except ImportError:
        raise HTTPException(status_code=500, detail="wandb package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed: @router.get("/tracking/wandb/run/{run_id}", ...) - use GraphQL query { getWandbRun(...) }
async def get_wandb_run(
    run_id: str,
    project: Optional[str] = None,
    api_key: Optional[str] = None,
):
    """Get W&B run details and metrics"""
    try:
        import os

        import wandb
        from fastapi import Header

        # Get API key from header, query param, or env
        # Note: In production, prefer header for security
        if not api_key:
            api_key = os.environ.get("WANDB_API_KEY")

        if not api_key:
            raise HTTPException(status_code=401, detail="W&B API key required")

        # Set API key
        os.environ["WANDB_API_KEY"] = api_key
        wandb.login(key=api_key, relogin=True)

        # Initialize API
        api_instance = wandb.Api()
        project_name = project or "rl-studio"

        # Get run
        run = api_instance.run(f"{project_name}/{run_id}")

        # Get history (metrics over time)
        history = run.history()
        metrics = {}
        for metric_name in history.columns:
            if metric_name not in ["_step", "_timestamp"]:
                metrics[metric_name] = history[metric_name].tolist()

        return {
            "success": True,
            "run_id": run.id,
            "run_name": run.name,
            "metrics": metrics,
            "config": run.config,
            "summary": run.summary,
            "url": run.url,
        }
    except ImportError:
        raise HTTPException(status_code=500, detail="wandb package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
