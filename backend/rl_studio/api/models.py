"""
Pydantic models for API requests/responses
"""

from typing import Any, Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field, validator


class RolloutRequest(BaseModel):
    envSpec: Dict[str, Any] = Field(..., description="Environment specification")
    policy: Literal["random", "greedy", "trained_model"] = Field(
        default="random", description="Policy to use"
    )
    maxSteps: int = Field(default=100, ge=1, le=10000, description="Maximum steps")
    stream: bool = Field(default=False, description="Stream results in real-time")
    runId: Optional[str] = Field(
        default=None, description="Run ID for trained_model policy"
    )
    modelUrl: Optional[str] = Field(
        default=None, description="Model URL (alternative to runId)"
    )
    batchSize: Optional[int] = Field(
        default=1,
        ge=1,
        le=100,
        description="Number of parallel rollouts (for performance)",
    )
    useParallel: Optional[bool] = Field(
        default=False, description="Use parallel execution for batch"
    )


class RolloutResponse(BaseModel):
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    executionTime: float


class LaunchJobRequest(BaseModel):
    runId: str = Field(..., description="Training run ID")
    config: Dict[str, Any] = Field(..., description="Job configuration")


class LaunchJobResponse(BaseModel):
    success: bool
    jobId: Optional[str] = None
    error: Optional[str] = None


class JobStatusResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    jobId: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    services: Dict[str, str]


# ============================================================================
# Scene Builder Models (Figma-style)
# ============================================================================


class Transform(BaseModel):
    """3D transform for entities"""

    position: Tuple[float, float, float] = Field(default=(0.0, 0.0, 0.0))
    rotation: Tuple[float, float, float] = Field(default=(0.0, 0.0, 0.0))
    scale: Tuple[float, float, float] = Field(default=(1.0, 1.0, 1.0))


class Entity(BaseModel):
    """An entity in the scene graph"""

    id: str = Field(..., description="Unique entity ID")
    assetId: Optional[str] = Field(None, description="Reference to asset")
    name: Optional[str] = Field(None, description="Human-readable name")
    parentId: Optional[str] = Field(None, description="Parent entity ID for hierarchy")
    transform: Transform = Field(default_factory=Transform)
    components: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="Component data"
    )


class SceneGraph(BaseModel):
    """The scene graph containing all entities"""

    entities: List[Entity] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Scene metadata (gridConfig, tags, etc.)"
    )


class ActionSpace(BaseModel):
    """Action space definition"""

    type: Literal[
        "discrete", "continuous", "multi_discrete", "multi_binary", "dict"
    ] = Field(..., description="Action space type")
    actions: Optional[List[str]] = Field(
        None, description="For discrete: list of action names"
    )
    shape: Optional[Tuple[int, ...]] = Field(
        None, description="For continuous: shape of action vector"
    )
    low: Optional[Tuple[float, ...]] = Field(
        None, description="For continuous: lower bounds"
    )
    high: Optional[Tuple[float, ...]] = Field(
        None, description="For continuous: upper bounds"
    )
    spaces: Optional[Dict[str, Any]] = Field(
        None, description="For dict: nested spaces"
    )


class ObservationSpace(BaseModel):
    """Observation space definition"""

    type: Literal["box", "discrete", "multi_discrete", "multi_binary", "dict"] = Field(
        ..., description="Observation space type"
    )
    shape: Optional[Tuple[int, ...]] = Field(None, description="Shape of observation")
    low: Optional[Tuple[float, ...]] = Field(None, description="Lower bounds")
    high: Optional[Tuple[float, ...]] = Field(None, description="Upper bounds")
    n: Optional[int] = Field(
        None, description="For discrete: number of discrete values"
    )
    spaces: Optional[Dict[str, Any]] = Field(
        None, description="For dict: nested spaces"
    )


class RLAgent(BaseModel):
    """RL agent configuration"""

    agentId: str = Field(..., description="Unique agent ID")
    entityId: str = Field(..., description="Entity ID this agent controls")
    role: Literal["learning_agent", "scripted", "human"] = Field(
        default="learning_agent"
    )
    actionSpace: ActionSpace
    observationSpace: ObservationSpace


class RewardTrigger(BaseModel):
    """Reward trigger condition"""

    type: Literal[
        "enter_region", "exit_region", "collision", "event", "step", "custom"
    ] = Field(..., description="Trigger type")
    entityId: Optional[str] = Field(
        None, description="Entity ID for entity-specific triggers"
    )
    regionId: Optional[str] = Field(
        None, description="Region/entity ID for region triggers"
    )
    eventName: Optional[str] = Field(None, description="Event name for event triggers")
    condition: Optional[Dict[str, Any]] = Field(
        None, description="Custom condition data"
    )


class Reward(BaseModel):
    """Reward definition"""

    id: str = Field(..., description="Unique reward ID")
    trigger: RewardTrigger
    amount: float = Field(..., description="Reward amount")
    shaping: Optional[Dict[str, Any]] = Field(None, description="Shaping parameters")


class TerminationCondition(BaseModel):
    """Episode termination condition"""

    type: Literal[
        "enter_region", "exit_region", "collision", "event", "max_steps", "custom"
    ] = Field(..., description="Termination type")
    entityId: Optional[str] = Field(None, description="Entity ID")
    regionId: Optional[str] = Field(None, description="Region ID")
    eventName: Optional[str] = Field(None, description="Event name")
    maxSteps: Optional[int] = Field(None, description="For max_steps type")
    condition: Optional[Dict[str, Any]] = Field(None, description="Custom condition")


class SpawnPoint(BaseModel):
    """Spawn point for episode reset"""

    entityId: str = Field(..., description="Entity to spawn")
    position: Tuple[float, float, float] = Field(..., description="Spawn position")
    rotation: Optional[Tuple[float, float, float]] = Field(
        None, description="Spawn rotation"
    )


class EpisodeConfig(BaseModel):
    """Episode configuration"""

    maxSteps: int = Field(..., description="Maximum steps per episode")
    terminationConditions: List[TerminationCondition] = Field(default_factory=list)
    reset: Dict[str, Any] = Field(
        ..., description="Reset configuration (type, spawns, etc.)"
    )


class RLConfig(BaseModel):
    """RL configuration for a scene"""

    agents: List[RLAgent] = Field(default_factory=list)
    rewards: List[Reward] = Field(default_factory=list)
    episode: EpisodeConfig = Field(..., description="Episode configuration")


# ============================================================================
# Request/Response Models
# ============================================================================


class CreateSceneRequest(BaseModel):
    """Request to create a new scene"""

    projectId: Optional[str] = Field(
        None, description="Project/environment ID (optional)"
    )
    name: str = Field(..., description="Scene name")
    description: Optional[str] = None
    mode: str = Field(..., description="Scene mode: 'grid', '2d', '3d', etc.")
    environmentSettings: Dict[str, Any] = Field(default_factory=dict)
    createdBy: Optional[str] = None  # TODO: Get from auth


class CreateSceneVersionRequest(BaseModel):
    """Request to create a new scene version"""

    sceneGraph: SceneGraph
    rlConfig: RLConfig = Field(default_factory=RLConfig)
    createdBy: Optional[str] = None  # TODO: Get from auth


class UpdateSceneRequest(BaseModel):
    """Request to update scene metadata"""

    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    environmentSettings: Optional[Dict[str, Any]] = None
    projectId: Optional[str] = None  # Allow updating projectId


class CreateAssetRequest(BaseModel):
    """Request to create a new asset"""

    projectId: Optional[str] = Field(None, description="Project ID (None for global)")
    assetTypeKey: str = Field(
        ...,
        description="Asset type key: 'character', 'vehicle', 'prop', 'tile', 'prefab'",
    )
    name: str = Field(..., description="Asset name")
    slug: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    modelUrl: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = Field(
        None,
        description="Procedural geometry: { primitive: 'rectangle'|'box'|'sphere'|'cylinder'|'curve', params: {...} }",
    )
    visualProfile: Dict[str, Any] = Field(default_factory=dict)
    physicsProfile: Dict[str, Any] = Field(default_factory=dict)
    behaviorProfile: Dict[str, Any] = Field(default_factory=dict)
    meta: Dict[str, Any] = Field(default_factory=dict)
    createdBy: Optional[str] = None  # TODO: Get from auth


class UpdateAssetRequest(BaseModel):
    """Request to update an asset"""

    name: Optional[str] = None
    slug: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    modelUrl: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None
    visualProfile: Optional[Dict[str, Any]] = None
    physicsProfile: Optional[Dict[str, Any]] = None
    behaviorProfile: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None


class CreateTemplateRequest(BaseModel):
    """Request to create a template"""

    name: str
    description: Optional[str] = None
    sceneVersionId: str
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    meta: Optional[Dict[str, Any]] = None
    isPublic: bool = True
    createdBy: Optional[str] = None  # TODO: Get from auth


class InstantiateTemplateRequest(BaseModel):
    """Request to instantiate a template into a scene"""

    templateId: str
    projectId: str
    name: Optional[str] = None  # If None, use template name


class CompileRequest(BaseModel):
    """Request to compile scene_graph + rl_config"""

    scene_graph: Dict[str, Any] = Field(..., description="Scene graph data")
    rl_config: Dict[str, Any] = Field(..., description="RL configuration")
    resolve_assets: bool = Field(
        True, description="Whether to resolve asset references"
    )
