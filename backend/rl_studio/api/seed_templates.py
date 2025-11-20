"""
Script to generate Phase 1 template data
These templates will be created in Convex after assets are seeded
"""
import json
from typing import Dict, Any, List


def create_basic_gridworld_template() -> Dict[str, Any]:
    """Basic Gridworld: 1 agent, 1 goal, walls"""
    return {
        "name": "Basic Gridworld",
        "description": "Simple gridworld with one agent and one goal. Perfect for learning value iteration and Q-learning.",
        "category": "grid",
        "tags": ["grid", "navigation", "tabular"],
        "meta": {
            "difficulty": "beginner",
            "taskFamily": "grid_navigation",
            "primaryUseCases": ["value_based", "tabular", "education"],
            "supportedAlgos": ["q_learning", "sarsa", "dqn"],
            "supportsMultiAgent": False,
            "mode": "grid",
        },
        "sceneGraph": {
            "entities": [
                {
                    "id": "entity_agent_1",
                    "assetId": "asset_grid_agent_basic",
                    "name": "Agent",
                    "parentId": None,
                    "transform": {"position": [1, 0, 1], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {
                        "gridCell": {"row": 1, "col": 1},
                        "rlAgent": {"agentId": "player_agent", "role": "learning_agent"},
                    },
                },
                {
                    "id": "entity_goal_1",
                    "assetId": "asset_grid_goal_basic",
                    "name": "Goal",
                    "parentId": None,
                    "transform": {"position": [8, 0, 8], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {"gridCell": {"row": 8, "col": 8}},
                },
            ],
            "metadata": {
                "gridConfig": {"rows": 10, "cols": 10},
                "tags": ["grid", "navigation"],
            },
        },
        "rlConfig": {
            "agents": [
                {
                    "agentId": "player_agent",
                    "entityId": "entity_agent_1",
                    "role": "learning_agent",
                    "actionSpace": {
                        "type": "discrete",
                        "actions": ["move_up", "move_down", "move_left", "move_right", "stay"],
                    },
                    "observationSpace": {
                        "type": "box",
                        "shape": [2],
                        "low": [0, 0],
                        "high": [9, 9],
                    },
                }
            ],
            "rewards": [
                {
                    "id": "reach_goal",
                    "trigger": {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                    "amount": 10.0,
                },
                {"id": "step_penalty", "trigger": {"type": "step"}, "amount": -0.1},
            ],
            "episode": {
                "maxSteps": 200,
                "terminationConditions": [
                    {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                    {"type": "max_steps", "maxSteps": 200},
                ],
                "reset": {
                    "type": "fixed_spawns",
                    "spawns": [{"entityId": "entity_agent_1", "position": [1, 0, 1]}],
                },
            },
        },
    }


def create_cliff_walking_template() -> Dict[str, Any]:
    """Cliff Walking: Agent must navigate around a cliff"""
    return {
        "name": "Cliff Walking",
        "description": "Agent must reach goal while avoiding a cliff with large negative reward. Classic exploration vs exploitation task.",
        "category": "grid",
        "tags": ["grid", "navigation", "exploration"],
        "meta": {
            "difficulty": "beginner",
            "taskFamily": "grid_navigation",
            "primaryUseCases": ["exploration", "episodic"],
            "supportedAlgos": ["q_learning", "sarsa"],
            "supportsMultiAgent": False,
            "mode": "grid",
        },
        "sceneGraph": {
            "entities": [
                {
                    "id": "entity_agent_1",
                    "assetId": "asset_grid_agent_basic",
                    "name": "Agent",
                    "parentId": None,
                    "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {
                        "gridCell": {"row": 0, "col": 0},
                        "rlAgent": {"agentId": "player_agent", "role": "learning_agent"},
                    },
                },
                {
                    "id": "entity_goal_1",
                    "assetId": "asset_grid_goal_basic",
                    "name": "Goal",
                    "parentId": None,
                    "transform": {"position": [11, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {"gridCell": {"row": 0, "col": 11}},
                },
            ],
            "metadata": {
                "gridConfig": {"rows": 4, "cols": 12},
                "tags": ["grid", "cliff", "navigation"],
            },
        },
        "rlConfig": {
            "agents": [
                {
                    "agentId": "player_agent",
                    "entityId": "entity_agent_1",
                    "role": "learning_agent",
                    "actionSpace": {
                        "type": "discrete",
                        "actions": ["move_up", "move_down", "move_left", "move_right"],
                    },
                    "observationSpace": {
                        "type": "box",
                        "shape": [2],
                        "low": [0, 0],
                        "high": [3, 11],
                    },
                }
            ],
            "rewards": [
                {
                    "id": "reach_goal",
                    "trigger": {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                    "amount": 10.0,
                },
                {
                    "id": "fall_cliff",
                    "trigger": {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "cliff_region",
                    },
                    "amount": -100.0,
                },
                {"id": "step_penalty", "trigger": {"type": "step"}, "amount": -1.0},
            ],
            "episode": {
                "maxSteps": 100,
                "terminationConditions": [
                    {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                    {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "cliff_region",
                    },
                ],
                "reset": {
                    "type": "fixed_spawns",
                    "spawns": [{"entityId": "entity_agent_1", "position": [0, 0, 0]}],
                },
            },
        },
    }


def create_key_door_template() -> Dict[str, Any]:
    """Key & Door: Agent must collect key before reaching goal"""
    return {
        "name": "Key & Door Grid",
        "description": "Agent must pick up a key, then open a door, then reach the goal. Tests temporal credit assignment.",
        "category": "grid",
        "tags": ["grid", "navigation", "sparse_reward"],
        "meta": {
            "difficulty": "intermediate",
            "taskFamily": "grid_navigation",
            "primaryUseCases": ["sparse_reward", "temporal_credit"],
            "supportedAlgos": ["dqn", "ppo", "a2c"],
            "supportsMultiAgent": False,
            "mode": "grid",
        },
        "sceneGraph": {
            "entities": [
                {
                    "id": "entity_agent_1",
                    "assetId": "asset_grid_agent_basic",
                    "name": "Agent",
                    "parentId": None,
                    "transform": {"position": [1, 0, 1], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {
                        "gridCell": {"row": 1, "col": 1},
                        "rlAgent": {"agentId": "player_agent", "role": "learning_agent"},
                    },
                },
                {
                    "id": "entity_key_1",
                    "assetId": "asset_grid_key_basic",
                    "name": "Key",
                    "parentId": None,
                    "transform": {"position": [3, 0, 3], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {"gridCell": {"row": 3, "col": 3}},
                },
                {
                    "id": "entity_door_1",
                    "assetId": "asset_grid_door_basic",
                    "name": "Door",
                    "parentId": None,
                    "transform": {"position": [5, 0, 5], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {"gridCell": {"row": 5, "col": 5}},
                },
                {
                    "id": "entity_goal_1",
                    "assetId": "asset_grid_goal_basic",
                    "name": "Goal",
                    "parentId": None,
                    "transform": {"position": [8, 0, 8], "rotation": [0, 0, 0], "scale": [1, 1, 1]},
                    "components": {"gridCell": {"row": 8, "col": 8}},
                },
            ],
            "metadata": {
                "gridConfig": {"rows": 10, "cols": 10},
                "tags": ["grid", "key", "door"],
            },
        },
        "rlConfig": {
            "agents": [
                {
                    "agentId": "player_agent",
                    "entityId": "entity_agent_1",
                    "role": "learning_agent",
                    "actionSpace": {
                        "type": "discrete",
                        "actions": ["move_up", "move_down", "move_left", "move_right"],
                    },
                    "observationSpace": {
                        "type": "dict",
                        "spaces": {
                            "position": {"type": "box", "shape": [2], "low": [0, 0], "high": [9, 9]},
                            "hasKey": {"type": "discrete", "n": 2},
                        },
                    },
                }
            ],
            "rewards": [
                {
                    "id": "collect_key",
                    "trigger": {
                        "type": "collision",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_key_1",
                    },
                    "amount": 5.0,
                },
                {
                    "id": "open_door",
                    "trigger": {
                        "type": "event",
                        "eventName": "door_opened",
                        "entityId": "entity_agent_1",
                    },
                    "amount": 5.0,
                },
                {
                    "id": "reach_goal",
                    "trigger": {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                    "amount": 10.0,
                },
            ],
            "episode": {
                "maxSteps": 500,
                "terminationConditions": [
                    {
                        "type": "enter_region",
                        "entityId": "entity_agent_1",
                        "regionId": "entity_goal_1",
                    },
                ],
                "reset": {
                    "type": "fixed_spawns",
                    "spawns": [{"entityId": "entity_agent_1", "position": [1, 0, 1]}],
                },
            },
        },
    }


def get_all_templates() -> List[Dict[str, Any]]:
    """Return all Phase 1 templates"""
    return [
        create_basic_gridworld_template(),
        create_cliff_walking_template(),
        create_key_door_template(),
    ]


if __name__ == "__main__":
    # Print templates as JSON
    print(json.dumps(get_all_templates(), indent=2))

