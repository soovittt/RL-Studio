"""
Asset GraphQL types
"""

from typing import Any, Dict, List, Optional

import strawberry


@strawberry.type
class Asset:
    """Asset type"""

    id: str
    name: str
    asset_type: str
    geometry: Optional[str] = None  # JSON string
    visual_profile: Optional[str] = None  # JSON string
    physics_profile: Optional[str] = None  # JSON string
    behavior_profile: Optional[str] = None  # JSON string
    meta: Optional[str] = None  # JSON string
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@strawberry.input
class AssetInput:
    """Input for creating assets"""

    project_id: Optional[str] = None
    asset_type_key: str
    name: str
    slug: Optional[str] = None
    thumbnail_url: Optional[str] = None
    model_url: Optional[str] = None
    geometry: Optional[str] = None  # JSON string
    visual_profile: Optional[str] = None  # JSON string
    physics_profile: Optional[str] = None  # JSON string
    behavior_profile: Optional[str] = None  # JSON string
    meta: Optional[str] = None  # JSON string


@strawberry.input
class UpdateAssetInput:
    """Input for updating assets"""

    name: Optional[str] = None
    slug: Optional[str] = None
    thumbnail_url: Optional[str] = None
    model_url: Optional[str] = None
    geometry: Optional[str] = None  # JSON string
    visual_profile: Optional[str] = None  # JSON string
    physics_profile: Optional[str] = None  # JSON string
    behavior_profile: Optional[str] = None  # JSON string
    meta: Optional[str] = None  # JSON string


@strawberry.input
class AssetFilter:
    """Filter for querying assets"""

    project_id: Optional[str] = None
    asset_type: Optional[str] = None
    mode: Optional[str] = None
    tag: Optional[str] = None
    search: Optional[str] = None
