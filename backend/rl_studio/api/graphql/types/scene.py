"""
Scene/Environment GraphQL types
"""

import strawberry
from typing import Optional, Dict, Any, List


@strawberry.type
class Scene:
    """Scene/Environment type"""
    id: str
    name: str
    env_spec: str  # JSON string
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None


@strawberry.input
class CreateSceneInput:
    """Input for creating scenes"""
    project_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    mode: str
    environment_settings: Optional[str] = None  # JSON string
    created_by: Optional[str] = None


@strawberry.input
class UpdateSceneInput:
    """Input for updating scenes"""
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    environment_settings: Optional[str] = None  # JSON string
    project_id: Optional[str] = None


@strawberry.input
class CreateSceneVersionInput:
    """Input for creating scene versions"""
    scene_graph: str  # JSON string
    rl_config: str  # JSON string
    created_by: Optional[str] = None


@strawberry.input
class SceneFilter:
    """Filter for querying scenes"""
    search: Optional[str] = None
    created_by: Optional[str] = None

