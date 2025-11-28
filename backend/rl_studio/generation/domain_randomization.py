"""
Domain Randomization
Randomizes environment parameters for robust training
"""

import random
from typing import Any, Dict, List, Optional

import numpy as np

from ..rollout.simulator import Vec2


class DomainRandomizer:
    """Applies domain randomization to environment specifications"""

    def __init__(self, base_env_spec: Dict[str, Any]):
        self.base_env_spec = base_env_spec
        self.randomization_config: Dict[str, Any] = {}

    def configure(
        self,
        randomize_wall_positions: bool = False,
        wall_position_delta: float = 1.0,
        randomize_object_positions: bool = False,
        randomize_agent_start: bool = False,
        randomize_goal_positions: bool = False,
        randomize_world_size: bool = False,
        world_size_variance: float = 0.1,
    ):
        """Configure randomization parameters"""
        self.randomization_config = {
            "randomize_wall_positions": randomize_wall_positions,
            "wall_position_delta": wall_position_delta,
            "randomize_object_positions": randomize_object_positions,
            "randomize_agent_start": randomize_agent_start,
            "randomize_goal_positions": randomize_goal_positions,
            "randomize_world_size": randomize_world_size,
            "world_size_variance": world_size_variance,
        }

    def randomize(self) -> Dict[str, Any]:
        """Generate a randomized version of the environment"""
        env_spec = self._deep_copy(self.base_env_spec)
        world = env_spec.get("world", {})

        # Randomize world size
        if self.randomization_config.get("randomize_world_size"):
            variance = self.randomization_config.get("world_size_variance", 0.1)
            width = world.get("width", 10)
            height = world.get("height", 10)
            world["width"] = max(
                5, int(width * (1 + random.uniform(-variance, variance)))
            )
            world["height"] = max(
                5, int(height * (1 + random.uniform(-variance, variance)))
            )

        # Randomize agent starting position
        if self.randomization_config.get("randomize_agent_start"):
            agents = env_spec.get("agents", [])
            for agent in agents:
                if world.get("coordinateSystem") == "grid":
                    agent["position"] = [
                        random.randint(0, world.get("width", 10) - 1),
                        random.randint(0, world.get("height", 10) - 1),
                    ]
                else:
                    agent["position"] = [
                        random.uniform(
                            -world.get("width", 10) / 2, world.get("width", 10) / 2
                        ),
                        random.uniform(
                            -world.get("height", 10) / 2, world.get("height", 10) / 2
                        ),
                    ]

        # Randomize object positions
        objects = env_spec.get("objects", [])
        for obj in objects:
            obj_type = obj.get("type")

            # Randomize wall positions
            if obj_type in ["wall", "obstacle"] and self.randomization_config.get(
                "randomize_wall_positions"
            ):
                delta = self.randomization_config.get("wall_position_delta", 1.0)
                pos = Vec2.from_list(obj.get("position", [0, 0]))
                pos.x += random.uniform(-delta, delta)
                pos.y += random.uniform(-delta, delta)

                # Clamp to bounds
                if world.get("coordinateSystem") == "grid":
                    pos.x = max(0, min(world.get("width", 10) - 1, pos.x))
                    pos.y = max(0, min(world.get("height", 10) - 1, pos.y))
                    pos.x = round(pos.x)
                    pos.y = round(pos.y)
                else:
                    pos.x = max(
                        -world.get("width", 10) / 2,
                        min(world.get("width", 10) / 2, pos.x),
                    )
                    pos.y = max(
                        -world.get("height", 10) / 2,
                        min(world.get("height", 10) / 2, pos.y),
                    )

                obj["position"] = pos.to_list()

            # Randomize goal positions
            elif obj_type == "goal" and self.randomization_config.get(
                "randomize_goal_positions"
            ):
                if world.get("coordinateSystem") == "grid":
                    obj["position"] = [
                        random.randint(0, world.get("width", 10) - 1),
                        random.randint(0, world.get("height", 10) - 1),
                    ]
                else:
                    obj["position"] = [
                        random.uniform(
                            -world.get("width", 10) / 2, world.get("width", 10) / 2
                        ),
                        random.uniform(
                            -world.get("height", 10) / 2, world.get("height", 10) / 2
                        ),
                    ]

            # Randomize other object positions
            elif self.randomization_config.get("randomize_object_positions"):
                if world.get("coordinateSystem") == "grid":
                    obj["position"] = [
                        random.randint(0, world.get("width", 10) - 1),
                        random.randint(0, world.get("height", 10) - 1),
                    ]
                else:
                    obj["position"] = [
                        random.uniform(
                            -world.get("width", 10) / 2, world.get("width", 10) / 2
                        ),
                        random.uniform(
                            -world.get("height", 10) / 2, world.get("height", 10) / 2
                        ),
                    ]

        return env_spec

    def _deep_copy(self, obj: Any) -> Any:
        """Deep copy a dictionary"""
        if isinstance(obj, dict):
            return {k: self._deep_copy(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._deep_copy(item) for item in obj]
        else:
            return obj
