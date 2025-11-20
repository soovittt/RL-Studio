"""
Script to seed initial asset types and grid assets
Run this to populate the asset library with basic grid tiles
"""
import json
from typing import Dict, Any

# Asset types to create
ASSET_TYPES = [
    {"key": "tile", "displayName": "Tile"},
    {"key": "character", "displayName": "Character"},
    {"key": "vehicle", "displayName": "Vehicle"},
    {"key": "prop", "displayName": "Prop"},
    {"key": "prefab", "displayName": "Prefab"},
]

# Initial grid assets
GRID_ASSETS = [
    {
        "name": "Wall",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#1b263b",
            "labelColor": "#ffffff",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "static": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["wall", "obstacle", "grid"],
            "mode": "grid",
            "paletteColor": "#1b263b",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Agent",
        "assetTypeKey": "character",
        "visualProfile": {
            "color": "#4a90e2",
            "labelColor": "#ffffff",
            "size": [0.8, 0.8, 0.8],
        },
        "physicsProfile": {
            "collider": "box",
            "dynamic": True,
        },
        "behaviorProfile": {
            "speed": 1.0,
        },
        "meta": {
            "tags": ["agent", "player", "grid"],
            "mode": "grid",
            "paletteColor": "#4a90e2",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Goal",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#50c878",
            "labelColor": "#ffffff",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "trigger": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["goal", "reward", "grid"],
            "mode": "grid",
            "paletteColor": "#50c878",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Key",
        "assetTypeKey": "prop",
        "visualProfile": {
            "color": "#ffd700",
            "labelColor": "#000000",
            "size": [0.6, 0.6, 0.6],
        },
        "physicsProfile": {
            "collider": "box",
            "trigger": True,
        },
        "behaviorProfile": {
            "collectible": True,
        },
        "meta": {
            "tags": ["key", "collectible", "grid"],
            "mode": "grid",
            "paletteColor": "#ffd700",
            "labelColor": "#000000",
            "palette": "primary",
        },
    },
    {
        "name": "Door",
        "assetTypeKey": "prop",
        "visualProfile": {
            "color": "#8b4513",
            "labelColor": "#ffffff",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "static": True,
        },
        "behaviorProfile": {
            "locked": True,
            "requiresKey": True,
        },
        "meta": {
            "tags": ["door", "obstacle", "grid"],
            "mode": "grid",
            "paletteColor": "#8b4513",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Trap",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#dc143c",
            "labelColor": "#ffffff",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "trigger": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["trap", "hazard", "grid"],
            "mode": "grid",
            "paletteColor": "#dc143c",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Checkpoint",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#9370db",
            "labelColor": "#ffffff",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "trigger": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["checkpoint", "waypoint", "grid"],
            "mode": "grid",
            "paletteColor": "#9370db",
            "labelColor": "#ffffff",
            "palette": "primary",
        },
    },
    {
        "name": "Moving Obstacle",
        "assetTypeKey": "character",
        "visualProfile": {
            "color": "#ff6347",
            "labelColor": "#ffffff",
            "size": [0.8, 0.8, 0.8],
        },
        "physicsProfile": {
            "collider": "box",
            "dynamic": True,
        },
        "behaviorProfile": {
            "speed": 0.5,
            "patrol": True,
        },
        "meta": {
            "tags": ["obstacle", "moving", "grid"],
            "mode": "grid",
            "paletteColor": "#ff6347",
            "labelColor": "#ffffff",
            "palette": "secondary",
        },
    },
    {
        "name": "Floor",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#f5f5f5",
            "labelColor": "#000000",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "static": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["floor", "ground", "grid"],
            "mode": "grid",
            "paletteColor": "#f5f5f5",
            "labelColor": "#000000",
            "palette": "secondary",
        },
    },
    {
        "name": "Spawn Point",
        "assetTypeKey": "tile",
        "visualProfile": {
            "color": "#87ceeb",
            "labelColor": "#000000",
            "size": [1, 1, 1],
        },
        "physicsProfile": {
            "collider": "box",
            "trigger": True,
        },
        "behaviorProfile": {},
        "meta": {
            "tags": ["spawn", "reset", "grid"],
            "mode": "grid",
            "paletteColor": "#87ceeb",
            "labelColor": "#000000",
            "palette": "secondary",
        },
    },
]


def get_seed_data() -> Dict[str, Any]:
    """Return seed data for assets and asset types"""
    return {
        "assetTypes": ASSET_TYPES,
        "assets": GRID_ASSETS,
    }


if __name__ == "__main__":
    # Print seed data as JSON for manual import or script usage
    print(json.dumps(get_seed_data(), indent=2))

