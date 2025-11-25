"""
Scene/Environment GraphQL types
"""

import strawberry
from typing import Optional, Dict, Any, List
import strawberry.scalars


@strawberry.type
class Scene:
    """Scene/Environment type"""
    id: str
    name: str
    env_spec: strawberry.scalars.JSON  # Changed to JSON scalar
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    project_id: Optional[str] = None


@strawberry.type
class SceneVersion:
    """Scene Version type"""
    id: str
    scene_id: str
    version_number: int
    scene_graph: strawberry.scalars.JSON
    rl_config: strawberry.scalars.JSON
    created_by: Optional[str] = None
    created_at: Optional[str] = None


@strawberry.input
class CreateSceneInput:
    """Input for creating scenes"""
    project_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    mode: str
    environment_settings: Optional[strawberry.scalars.JSON] = None  # Changed to JSON scalar
    created_by: Optional[str] = None


@strawberry.input
class UpdateSceneInput:
    """Input for updating scenes"""
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    environment_settings: Optional[strawberry.scalars.JSON] = None  # Changed to JSON scalar
    project_id: Optional[str] = None


@strawberry.input
class CreateSceneVersionInput:
    """Input for creating scene versions"""
    scene_graph: strawberry.scalars.JSON  # Changed to JSON scalar
    rl_config: strawberry.scalars.JSON  # Changed to JSON scalar
    created_by: Optional[str] = None


@strawberry.input
class SceneFilter:
    """Filter for querying scenes"""
    search: Optional[str] = None
    created_by: Optional[str] = None
    project_id: Optional[str] = None

