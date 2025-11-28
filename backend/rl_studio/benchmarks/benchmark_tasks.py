"""
Built-in Benchmark Tasks
MiniGrid, Simple Control, Multi-agent Tag, etc.
"""

from typing import Any, Dict, List


class BenchmarkRegistry:
    """Registry of built-in benchmark tasks"""

    BENCHMARKS = {
        "minigrid_empty": {
            "name": "MiniGrid Empty",
            "description": "Simple navigation task in empty grid",
            "env_spec": {
                "id": "minigrid_empty",
                "name": "MiniGrid Empty",
                "envType": "grid",
                "world": {
                    "width": 8,
                    "height": 8,
                    "coordinateSystem": "grid",
                    "cellSize": 1.0,
                },
                "agents": [
                    {
                        "id": "agent_0",
                        "position": [1, 1],
                    }
                ],
                "objects": [
                    {
                        "id": "goal_0",
                        "type": "goal",
                        "position": [6, 6],
                        "size": {"type": "circle", "radius": 0.5},
                    }
                ],
                "actionSpace": {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"],
                },
                "rules": {
                    "rewards": [
                        {
                            "id": "goal_reward",
                            "condition": {"type": "goalReached"},
                            "reward": 10.0,
                        },
                        {
                            "id": "step_penalty",
                            "condition": {"type": "perStep"},
                            "reward": -0.1,
                        },
                    ],
                    "terminations": [
                        {
                            "id": "goal_termination",
                            "condition": {"type": "goalReached"},
                        },
                        {
                            "id": "timeout",
                            "condition": {"type": "timeout", "steps": 100},
                        },
                    ],
                },
            },
        },
        "minigrid_lava": {
            "name": "MiniGrid Lava",
            "description": "Navigation with lava obstacles",
            "env_spec": {
                "id": "minigrid_lava",
                "name": "MiniGrid Lava",
                "envType": "grid",
                "world": {
                    "width": 8,
                    "height": 8,
                    "coordinateSystem": "grid",
                    "cellSize": 1.0,
                },
                "agents": [
                    {
                        "id": "agent_0",
                        "position": [1, 1],
                    }
                ],
                "objects": [
                    {
                        "id": "goal_0",
                        "type": "goal",
                        "position": [6, 6],
                        "size": {"type": "circle", "radius": 0.5},
                    },
                    {
                        "id": "lava_0",
                        "type": "trap",
                        "position": [4, 4],
                        "size": {"type": "circle", "radius": 0.5},
                    },
                    {
                        "id": "lava_1",
                        "type": "trap",
                        "position": [3, 3],
                        "size": {"type": "circle", "radius": 0.5},
                    },
                ],
                "actionSpace": {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"],
                },
                "rules": {
                    "rewards": [
                        {
                            "id": "goal_reward",
                            "condition": {"type": "goalReached"},
                            "reward": 10.0,
                        },
                        {
                            "id": "trap_penalty",
                            "condition": {"type": "trapHit"},
                            "reward": -10.0,
                        },
                        {
                            "id": "step_penalty",
                            "condition": {"type": "perStep"},
                            "reward": -0.1,
                        },
                    ],
                    "terminations": [
                        {
                            "id": "goal_termination",
                            "condition": {"type": "goalReached"},
                        },
                        {
                            "id": "trap_termination",
                            "condition": {"type": "trapHit"},
                        },
                        {
                            "id": "timeout",
                            "condition": {"type": "timeout", "steps": 100},
                        },
                    ],
                },
            },
        },
        "simple_control": {
            "name": "Simple Control",
            "description": "2D continuous control task",
            "env_spec": {
                "id": "simple_control",
                "name": "Simple Control",
                "envType": "continuous2d",
                "world": {
                    "width": 10,
                    "height": 10,
                    "coordinateSystem": "cartesian",
                },
                "agents": [
                    {
                        "id": "agent_0",
                        "position": [0, 0],
                    }
                ],
                "objects": [
                    {
                        "id": "goal_0",
                        "type": "goal",
                        "position": [5, 5],
                        "size": {"type": "circle", "radius": 1.0},
                    }
                ],
                "actionSpace": {
                    "type": "continuous",
                    "dim": 2,
                },
                "rules": {
                    "rewards": [
                        {
                            "id": "goal_reward",
                            "condition": {"type": "goalReached"},
                            "reward": 10.0,
                        },
                        {
                            "id": "distance_reward",
                            "condition": {"type": "distanceToGoal"},
                            "reward": -0.1,
                            "shaping": True,
                        },
                    ],
                    "terminations": [
                        {
                            "id": "goal_termination",
                            "condition": {"type": "goalReached"},
                        },
                        {
                            "id": "timeout",
                            "condition": {"type": "timeout", "steps": 200},
                        },
                    ],
                },
            },
        },
        "multi_agent_tag": {
            "name": "Multi-Agent Tag",
            "description": "Multiple agents chasing goals",
            "env_spec": {
                "id": "multi_agent_tag",
                "name": "Multi-Agent Tag",
                "envType": "grid",
                "world": {
                    "width": 10,
                    "height": 10,
                    "coordinateSystem": "grid",
                    "cellSize": 1.0,
                },
                "agents": [
                    {
                        "id": "agent_0",
                        "position": [1, 1],
                    },
                    {
                        "id": "agent_1",
                        "position": [8, 8],
                    },
                ],
                "objects": [
                    {
                        "id": "goal_0",
                        "type": "goal",
                        "position": [5, 5],
                        "size": {"type": "circle", "radius": 0.5},
                    },
                ],
                "actionSpace": {
                    "type": "discrete",
                    "actions": ["up", "down", "left", "right"],
                },
                "rules": {
                    "rewards": [
                        {
                            "id": "goal_reward",
                            "condition": {"type": "goalReached"},
                            "reward": 10.0,
                        },
                        {
                            "id": "step_penalty",
                            "condition": {"type": "perStep"},
                            "reward": -0.1,
                        },
                    ],
                    "terminations": [
                        {
                            "id": "goal_termination",
                            "condition": {"type": "goalReached"},
                        },
                        {
                            "id": "timeout",
                            "condition": {"type": "timeout", "steps": 200},
                        },
                    ],
                },
            },
        },
    }

    @classmethod
    def get_benchmark(cls, benchmark_id: str) -> Dict[str, Any]:
        """Get a benchmark environment specification"""
        if benchmark_id not in cls.BENCHMARKS:
            raise ValueError(f"Unknown benchmark: {benchmark_id}")
        return cls.BENCHMARKS[benchmark_id]["env_spec"]

    @classmethod
    def list_benchmarks(cls) -> List[Dict[str, Any]]:
        """List all available benchmarks"""
        return [
            {
                "id": bid,
                "name": info["name"],
                "description": info["description"],
            }
            for bid, info in cls.BENCHMARKS.items()
        ]


def get_benchmark(benchmark_id: str) -> Dict[str, Any]:
    """Convenience function to get a benchmark"""
    return BenchmarkRegistry.get_benchmark(benchmark_id)
