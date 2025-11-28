"""
Research GraphQL types - Hyperparameter sweeps, statistical analysis, model versioning
"""

from typing import List, Optional

import strawberry


@strawberry.type
class HyperparameterTrial:
    """Single hyperparameter trial"""

    trial_number: int
    hyperparameters: str  # JSON string
    expected_reward: Optional[float] = None


@strawberry.type
class HyperparameterSweepResult:
    """Result of hyperparameter sweep generation"""

    success: bool
    n_trials: int
    trials: List[HyperparameterTrial]
    error: Optional[str] = None


@strawberry.input
class HyperparameterSweepInput:
    """Input for generating hyperparameter sweep"""

    algorithm: str
    env_spec: str  # JSON string
    base_config: str  # JSON string
    search_space: str  # JSON string
    search_type: str = "grid"  # "grid", "random", "bayesian"
    n_trials: int = 10
    seed: Optional[int] = None


@strawberry.type
class StatisticalComparison:
    """Statistical comparison result"""

    metric: str
    n_runs: int
    run_names: List[str]
    means: str  # JSON string
    overall_mean: float
    overall_std: float
    best_run: str
    worst_run: str
    statistical_test: str  # JSON string


@strawberry.type
class CompareRunsResult:
    """Result of comparing runs"""

    success: bool
    comparison: StatisticalComparison
    error: Optional[str] = None


@strawberry.input
class CompareRunsInput:
    """Input for comparing runs"""

    run_results: str  # JSON string
    metric: str = "mean_reward"
    alpha: float = 0.05


@strawberry.type
class ConfidenceInterval:
    """Confidence interval result"""

    mean: float
    std: float
    n: int
    confidence: float
    lower: float
    upper: float
    margin: float


@strawberry.type
class ConfidenceIntervalResult:
    """Result of confidence interval calculation"""

    success: bool
    confidence_interval: ConfidenceInterval
    error: Optional[str] = None


@strawberry.input
class ConfidenceIntervalInput:
    """Input for confidence interval calculation"""

    values: List[float]
    confidence: float = 0.95


@strawberry.type
class EffectSize:
    """Effect size result"""

    cohens_d: float
    interpretation: str
    mean_diff: float


@strawberry.type
class EffectSizeResult:
    """Result of effect size calculation"""

    success: bool
    effect_size: EffectSize
    error: Optional[str] = None


@strawberry.input
class EffectSizeInput:
    """Input for effect size calculation"""

    group1: List[float]
    group2: List[float]


@strawberry.type
class Checkpoint:
    """Model checkpoint"""

    checkpoint_name: str
    path: str
    run_id: str
    created_at: str
    model_path: Optional[str] = None
    metadata: Optional[str] = None  # JSON string


@strawberry.type
class ModelVersion:
    """Model version"""

    version_name: str
    run_id: str
    checkpoint_name: str
    created_at: str
    tags: List[str]
    description: Optional[str] = None
    model_path: str


@strawberry.input
class CreateVersionInput:
    """Input for creating a model version"""

    run_id: str
    checkpoint_name: str
    version_name: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None


@strawberry.type
class CreateVersionResult:
    """Result of creating a model version"""

    success: bool
    version: ModelVersion
    error: Optional[str] = None


@strawberry.type
class WandbRun:
    """W&B run information"""

    id: str
    name: str
    state: str
    config: str  # JSON string
    summary: str  # JSON string
    url: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@strawberry.type
class WandbRunDetails:
    """W&B run details with metrics"""

    run_id: str
    run_name: str
    metrics: str  # JSON string
    config: str  # JSON string
    summary: str  # JSON string
    url: str
    project_name: Optional[str] = None


@strawberry.input
class TestWandbConnectionInput:
    """Input for testing W&B connection"""

    api_key: str


@strawberry.type
class TestWandbConnectionResult:
    """Result of testing W&B connection"""

    success: bool
    message: str
    wandb_authenticated: Optional[bool] = None


@strawberry.input
class TestMlflowConnectionInput:
    """Input for testing MLflow connection"""

    tracking_uri: Optional[str] = None


@strawberry.type
class TestMlflowConnectionResult:
    """Result of testing MLflow connection"""

    success: bool
    message: str
