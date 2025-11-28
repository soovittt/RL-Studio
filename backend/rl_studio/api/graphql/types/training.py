"""
Training GraphQL types
"""

from typing import List, Optional

import strawberry


@strawberry.type
class TrainingConfig:
    """Training configuration"""

    algorithm: str
    learning_rate: Optional[float] = None
    gamma: Optional[float] = None
    total_timesteps: Optional[int] = None
    batch_size: Optional[int] = None
    seed: Optional[int] = None
    hyperparameters: Optional[str] = None  # JSON string for additional params


@strawberry.type
class JobStatus:
    """Training job status"""

    status: str  # PENDING, RUNNING, SUCCEEDED, FAILED
    job_id: str
    progress: Optional[float] = None
    metadata: Optional[str] = None  # JSON string
    logs: Optional[str] = None
    error: Optional[str] = None


@strawberry.type
class TrainingRun:
    """Training run information"""

    id: str
    run_id: str
    env_spec: str  # JSON string
    config: Optional[TrainingConfig] = None
    status: JobStatus
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    metrics: Optional[str] = None  # JSON string


@strawberry.input
class TrainingRunInput:
    """Input for creating a training run"""

    run_id: str
    env_spec: str  # JSON string
    config: str  # JSON string
    use_managed_jobs: Optional[bool] = True
