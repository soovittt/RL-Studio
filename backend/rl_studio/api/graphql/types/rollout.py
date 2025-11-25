"""
Rollout GraphQL types
"""

import strawberry
from typing import Optional, List, Dict, Any


@strawberry.type
class Step:
    """Single step in a rollout"""
    step_number: int
    state: str  # JSON string
    action: Optional[str] = None
    reward: float
    done: bool
    info: Optional[str] = None  # JSON string


@strawberry.type
class RolloutResult:
    """Rollout execution result"""
    success: bool
    total_reward: float
    episode_length: int
    termination_reason: Optional[str] = None
    steps: List[Step]
    execution_time: Optional[float] = None
    error: Optional[str] = None


@strawberry.input
class RolloutInput:
    """Input for running a rollout"""
    env_spec: str  # JSON string
    policy: str = "random"  # random, greedy, trained_model
    max_steps: int = 100
    run_id: Optional[str] = None
    model_url: Optional[str] = None
    batch_size: Optional[int] = 1
    use_parallel: Optional[bool] = False

