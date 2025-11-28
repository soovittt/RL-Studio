"""
API endpoints for environment generation
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..generation.domain_randomization import DomainRandomizer
from ..generation.procedural_generation import ProceduralGenerator

router = APIRouter(prefix="/api/generation", tags=["generation"])


class RandomizeRequest(BaseModel):
    env_spec: Dict[str, Any]
    config: Optional[Dict[str, Any]] = None


class GenerateRequest(BaseModel):
    env_type: str
    world_width: int = 10
    world_height: int = 10
    num_agents: int = 1
    num_goals: int = 1
    obstacle_density: float = 0.2

    class Config:
        extra = "allow"  # Allow extra fields


@router.post("/randomize")
async def randomize_environment(request: RandomizeRequest):
    """Apply domain randomization to an environment"""
    try:
        randomizer = DomainRandomizer(request.env_spec)

        if request.config:
            randomizer.configure(**request.config)
        else:
            # Default configuration
            randomizer.configure(
                randomize_wall_positions=True,
                randomize_object_positions=True,
                randomize_agent_start=True,
                randomize_goal_positions=False,  # Keep goals reachable
            )

        randomized_spec = randomizer.randomize()
        return {"success": True, "env_spec": randomized_spec}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/procedural")
async def generate_procedural(request: GenerateRequest):
    """Generate a procedural environment"""
    try:
        generator = ProceduralGenerator()
        # Extract extra kwargs from request
        extra_kwargs = {
            k: v
            for k, v in request.dict().items()
            if k
            not in [
                "env_type",
                "world_width",
                "world_height",
                "num_agents",
                "num_goals",
                "obstacle_density",
            ]
        }

        env_spec = generator.generate(
            env_type=request.env_type,
            world_width=request.world_width,
            world_height=request.world_height,
            num_agents=request.num_agents,
            num_goals=request.num_goals,
            obstacle_density=request.obstacle_density,
            **extra_kwargs
        )
        return {"success": True, "env_spec": env_spec}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_generation_types():
    """Get available procedural generation types"""
    return {
        "success": True,
        "types": [
            {
                "id": "maze",
                "name": "Maze",
                "description": "Generate a maze-like environment with walls",
            },
            {
                "id": "random_obstacles",
                "name": "Random Obstacles",
                "description": "Generate random obstacles with configurable density",
            },
            {
                "id": "sparse_goals",
                "name": "Sparse Goals",
                "description": "Generate environment with sparse rewards (hard exploration)",
            },
        ],
    }
