"""
API endpoints for RL training features
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

# Lazy imports - don't load heavy ML libraries until actually needed
# This allows the server to start quickly

router = APIRouter(prefix="/api/training", tags=["training"])


class SuggestHyperparametersRequest(BaseModel):
    env_spec: Dict[str, Any]
    algorithm: str = "PPO"


class CreateCurriculumRequest(BaseModel):
    env_spec: Dict[str, Any]
    stages: Optional[List[Dict[str, Any]]] = None


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
                reduce_obstacles,
                mean_reward_threshold,
            )
            
            curriculum.add_stage(
                "Easy",
                make_easier_goals,
                mean_reward_threshold(5.0),
                "Easier goals, closer to start"
            )
            curriculum.add_stage(
                "Medium",
                reduce_obstacles,
                mean_reward_threshold(10.0),
                "Fewer obstacles"
            )
            curriculum.add_stage(
                "Hard",
                lambda spec: spec,  # No modification
                mean_reward_threshold(15.0),
                "Full difficulty"
            )
        else:
            # Add custom stages
            for stage in request.stages:
                # Parse stage definition (simplified)
                curriculum.add_stage(
                    stage.get("name", "Stage"),
                    lambda spec: spec,  # Placeholder
                    lambda rewards: len(rewards) >= 10 and sum(rewards) / len(rewards) >= stage.get("threshold", 0),
                    stage.get("description", "")
                )
        
        return {
            "success": True,
            "curriculum": {
                "num_stages": len(curriculum.stages),
                "current_stage": curriculum.get_stage_info(),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

