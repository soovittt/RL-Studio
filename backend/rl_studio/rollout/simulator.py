"""
RL Rollout Simulator
Python implementation matching the TypeScript universalSimulator
Supports grid and continuous 2D environments
"""

import math
import random
from typing import Any, Callable, Dict, List, Literal, Optional


# Vec2 helper class
class Vec2:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def to_list(self) -> List[float]:
        return [self.x, self.y]

    @classmethod
    def from_list(cls, lst: List[float]) -> "Vec2":
        return cls(x=lst[0], y=lst[1])

    def distance(self, other: "Vec2") -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)


def evaluate_condition(
    condition: Dict[str, Any], state: Dict[str, Any], env_spec: Dict[str, Any]
) -> bool:
    """Evaluate if a condition is satisfied"""
    cond_type = condition.get("type")

    if cond_type == "agent_at_position":
        agent_id = condition.get("agentId")
        agent = next((a for a in state["agents"] if a.get("id") == agent_id), None)
        if not agent or not condition.get("position"):
            return False
        agent_pos_list = agent.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)
        target_pos_list = condition.get("position", [0, 0])
        if not isinstance(target_pos_list, list) or len(target_pos_list) < 2:
            return False
        target_pos = Vec2.from_list(target_pos_list)
        tolerance = condition.get("tolerance", 0.5)
        return agent_pos.distance(target_pos) <= tolerance

    elif cond_type == "agent_at_object":
        agent_id = condition.get("agentId")
        object_id = condition.get("objectId")
        agent = next((a for a in state["agents"] if a.get("id") == agent_id), None)
        obj = next((o for o in state["objects"] if o.get("id") == object_id), None)
        if not agent or not obj:
            return False
        agent_pos_list = agent.get("position", [0, 0])
        obj_pos_list = obj.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        if not isinstance(obj_pos_list, list) or len(obj_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)
        obj_pos = Vec2.from_list(obj_pos_list)
        tolerance = 0.5
        return agent_pos.distance(obj_pos) <= tolerance

    elif cond_type == "timeout":
        return True

    elif cond_type == "step":
        # Per-step reward - always true (triggers every step)
        return True

    elif cond_type == "reach_goal":
        # Check if agent is at any goal object
        if not state.get("agents") or len(state["agents"]) == 0:
            return False
        agent = state["agents"][0]
        agent_pos_list = agent.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)

        # Find goals from env_spec (source of truth)
        goals = [obj for obj in env_spec.get("objects", []) if obj.get("type") == "goal"]
        for goal in goals:
            goal_pos_list = goal.get("position", [0, 0])
            if isinstance(goal_pos_list, list) and len(goal_pos_list) >= 2:
                goal_pos = Vec2.from_list(goal_pos_list)
                distance = agent_pos.distance(goal_pos)
                if distance <= 0.5:
                    return True
        return False

    elif cond_type == "hit_trap":
        # Check if agent is at any trap object
        if not state.get("agents") or len(state["agents"]) == 0:
            return False
        agent = state["agents"][0]
        agent_pos_list = agent.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)

        traps = [obj for obj in env_spec.get("objects", []) if obj.get("type") == "trap"]
        for trap in traps:
            trap_pos_list = trap.get("position", [0, 0])
            if isinstance(trap_pos_list, list) and len(trap_pos_list) >= 2:
                trap_pos = Vec2.from_list(trap_pos_list)
                distance = agent_pos.distance(trap_pos)
                if distance <= 0.5:
                    return True
        return False

    elif cond_type == "collect_key":
        # Check if agent is at any key object
        if not state.get("agents") or len(state["agents"]) == 0:
            return False
        agent = state["agents"][0]
        agent_pos_list = agent.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)

        keys = [obj for obj in env_spec.get("objects", []) if obj.get("type") == "key"]
        for key in keys:
            key_pos_list = key.get("position", [0, 0])
            if isinstance(key_pos_list, list) and len(key_pos_list) >= 2:
                key_pos = Vec2.from_list(key_pos_list)
                distance = agent_pos.distance(key_pos)
                if distance <= 0.5:
                    return True
        return False

    elif cond_type == "collision":
        agent_id = condition.get("agentId")
        agent = next((a for a in state["agents"] if a.get("id") == agent_id), None)
        if not agent:
            return False
        agent_pos_list = agent.get("position", [0, 0])
        if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
            return False
        agent_pos = Vec2.from_list(agent_pos_list)
        for obj in state["objects"]:
            if obj.get("type") in ["wall", "obstacle"]:
                obj_pos_list = obj.get("position", [0, 0])
                if isinstance(obj_pos_list, list) and len(obj_pos_list) >= 2:
                    obj_pos = Vec2.from_list(obj_pos_list)
                    if agent_pos.distance(obj_pos) < 1.0:
                        return True
        return False

    return False


def calculate_reward(
    state: Dict[str, Any], env_spec: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Calculate reward for current state - only uses explicit reward rules"""
    rewards = []
    rules = env_spec.get("rules", {})

    # Only evaluate explicit reward rules - no hardcoded defaults
    for rule in rules.get("rewards", []):
        if evaluate_condition(rule["condition"], state, env_spec):
            rewards.append(
                {
                    "ruleId": rule.get("id", "unknown"),
                    "value": rule.get("reward", 0),
                    "reason": rule["condition"].get("type", "unknown"),
                }
            )

    return rewards


def check_termination(
    state: Dict[str, Any], env_spec: Dict[str, Any]
) -> Dict[str, Any]:
    """Check if episode should terminate"""
    # First check explicit termination rules
    rules = env_spec.get("rules", {})
    for rule in rules.get("terminations", []):
        cond_type = rule["condition"].get("type")
        if cond_type == "timeout":
            continue
        if evaluate_condition(rule["condition"], state, env_spec):
            return {"terminated": True, "reason": cond_type}

    # Auto-detect goal reaching: if agent is at any goal object, terminate
    if state.get("agents") and state.get("objects"):
        agent = state["agents"][0]
        agent_pos_list = agent.get("position", [0, 0])
        if isinstance(agent_pos_list, list) and len(agent_pos_list) >= 2:
            agent_pos = Vec2.from_list(agent_pos_list)

            # Check all goal objects from env_spec
            goals = [
                obj
                for obj in env_spec.get("objects", [])
                if obj and isinstance(obj, dict) and obj.get("type") == "goal"
            ]

            for goal in goals:
                goal_pos_list = goal.get("position", [0, 0])
                if isinstance(goal_pos_list, list) and len(goal_pos_list) >= 2:
                    goal_pos = Vec2.from_list(goal_pos_list)
                    if agent_pos.distance(goal_pos) <= 0.5:  # Within 0.5 units
                        return {"terminated": True, "reason": "goal_reached"}

    return {"terminated": False}


def apply_action(
    state: Dict[str, Any], action: Any, env_spec: Dict[str, Any]
) -> Dict[str, Any]:
    """Apply action to state - supports both single and multi-agent actions"""
    new_state = {
        "agents": [{**a} for a in state["agents"]],
        "objects": [{**o} for o in state["objects"]],
        "step": state["step"] + 1,
        "totalReward": state["totalReward"],
        "done": state["done"],
        "info": {"events": state["info"].get("events", [])[:], "rewards": []},
    }

    if not new_state["agents"]:
        return new_state

    world = env_spec["world"]

    # Handle multi-agent actions (dictionary mapping agent ID to action)
    if isinstance(action, dict) and not isinstance(action, list):
        for agent in new_state["agents"]:
            agent_action = action.get(agent.get("id"))
            if agent_action is None:
                continue
            apply_action_to_agent(agent, agent_action, new_state, env_spec, world)
        return new_state

    # Handle single-agent actions (backward compatibility)
    agent = new_state["agents"][0]
    agent_pos_list = agent.get("position", [0, 0])
    if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
        agent_pos_list = [0, 0]
        agent["position"] = [0, 0]
    agent_pos = Vec2.from_list(agent_pos_list)

    # Handle discrete actions
    if isinstance(action, str):
        new_pos = Vec2(agent_pos.x, agent_pos.y)

        if world["coordinateSystem"] == "grid":
            cell_size = world.get("cellSize", 1.0)
            if action == "up":
                new_pos.y -= cell_size
            elif action == "down":
                new_pos.y += cell_size
            elif action == "left":
                new_pos.x -= cell_size
            elif action == "right":
                new_pos.x += cell_size
        else:
            step_size = 0.1
            if action == "up":
                new_pos.y += step_size
            elif action == "down":
                new_pos.y -= step_size
            elif action == "left":
                new_pos.x -= step_size
            elif action == "right":
                new_pos.x += step_size

        # Check bounds and snap to grid cells
        if world["coordinateSystem"] == "grid":
            # Clamp to bounds
            new_pos.x = max(0, min(world["width"] - 1, new_pos.x))
            new_pos.y = max(0, min(world["height"] - 1, new_pos.y))
            # Snap to grid cell centers (important for visibility)
            new_pos.x = round(new_pos.x)
            new_pos.y = round(new_pos.y)
        else:
            if world["coordinateSystem"] == "cartesian":
                new_pos.x = max(-world["width"] / 2, min(world["width"] / 2, new_pos.x))
                new_pos.y = max(
                    -world["height"] / 2, min(world["height"] / 2, new_pos.y)
                )
            else:
                new_pos.x = max(0, min(world["width"], new_pos.x))
                new_pos.y = max(0, min(world["height"], new_pos.y))

        # Check collisions
        hit_obstacle = False
        for obj in new_state["objects"]:
            if obj.get("type") in ["wall", "obstacle"]:
                obj_pos_list = obj.get("position", [0, 0])
                if isinstance(obj_pos_list, list) and len(obj_pos_list) >= 2:
                    obj_pos = Vec2.from_list(obj_pos_list)
                    if new_pos.distance(obj_pos) < 1.0:
                        hit_obstacle = True
                        break

        if not hit_obstacle:
            agent["position"] = new_pos.to_list()
            new_state["info"]["events"].append(
                f"Moved {action} to ({new_pos.x:.1f}, {new_pos.y:.1f})"
            )
        else:
            new_state["info"]["events"].append(
                f"Hit obstacle, stayed at ({agent_pos.x:.1f}, {agent_pos.y:.1f})"
            )
    elif isinstance(action, list) and len(action) >= 2:
        # Handle continuous actions (single agent)
        dx, dy = float(action[0]), float(action[1])
        max_speed = 0.1
        new_x = agent_pos.x + dx * max_speed
        new_y = agent_pos.y + dy * max_speed

        # Check bounds
        if world["coordinateSystem"] == "cartesian":
            new_x = max(-world["width"] / 2, min(world["width"] / 2, new_x))
            new_y = max(-world["height"] / 2, min(world["height"] / 2, new_y))
        else:
            new_x = max(0, min(world["width"], new_x))
            new_y = max(0, min(world["height"], new_y))

        agent["position"] = [new_x, new_y]
        new_state["info"]["events"].append(f"Moved to ({new_x:.1f}, {new_y:.1f})")

    return new_state


def apply_action_to_agent(
    agent: Dict[str, Any],
    action: Any,
    state: Dict[str, Any],
    env_spec: Dict[str, Any],
    world: Dict[str, Any],
) -> None:
    """Helper: Apply action to a specific agent (for multi-agent support)"""
    agent_pos_list = agent.get("position", [0, 0])
    if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
        agent_pos_list = [0, 0]
        agent["position"] = [0, 0]
    agent_pos = Vec2.from_list(agent_pos_list)
    agent_id = agent.get("id", "unknown")

    # Handle discrete actions
    if isinstance(action, str):
        new_pos = Vec2(agent_pos.x, agent_pos.y)

        if world["coordinateSystem"] == "grid":
            cell_size = world.get("cellSize", 1.0)
            if action == "up":
                new_pos.y -= cell_size
            elif action == "down":
                new_pos.y += cell_size
            elif action == "left":
                new_pos.x -= cell_size
            elif action == "right":
                new_pos.x += cell_size
        else:
            step_size = 0.1
            if action == "up":
                new_pos.y += step_size
            elif action == "down":
                new_pos.y -= step_size
            elif action == "left":
                new_pos.x -= step_size
            elif action == "right":
                new_pos.x += step_size

        # Check bounds and snap to grid cells
        if world["coordinateSystem"] == "grid":
            new_pos.x = max(0, min(world["width"] - 1, new_pos.x))
            new_pos.y = max(0, min(world["height"] - 1, new_pos.y))
            new_pos.x = round(new_pos.x)
            new_pos.y = round(new_pos.y)
        else:
            if world["coordinateSystem"] == "cartesian":
                new_pos.x = max(-world["width"] / 2, min(world["width"] / 2, new_pos.x))
                new_pos.y = max(
                    -world["height"] / 2, min(world["height"] / 2, new_pos.y)
                )
            else:
                new_pos.x = max(0, min(world["width"], new_pos.x))
                new_pos.y = max(0, min(world["height"], new_pos.y))

        # Check collisions with obstacles and other agents
        hit_obstacle = False
        for obj in state["objects"]:
            if obj.get("type") in ["wall", "obstacle"]:
                obj_pos_list = obj.get("position", [0, 0])
                if isinstance(obj_pos_list, list) and len(obj_pos_list) >= 2:
                    obj_pos = Vec2.from_list(obj_pos_list)
                    if new_pos.distance(obj_pos) < 1.0:
                        hit_obstacle = True
                        break

        # Check collisions with other agents
        if not hit_obstacle:
            for other_agent in state["agents"]:
                if other_agent.get("id") == agent_id:
                    continue
                other_pos_list = other_agent.get("position", [0, 0])
                if isinstance(other_pos_list, list) and len(other_pos_list) >= 2:
                    other_pos = Vec2.from_list(other_pos_list)
                    if new_pos.distance(other_pos) < 0.5:
                        hit_obstacle = True
                        break

        if not hit_obstacle:
            agent["position"] = new_pos.to_list()
            state["info"]["events"].append(
                f"Agent {agent_id} moved {action} to ({new_pos.x:.1f}, {new_pos.y:.1f})"
            )
        else:
            state["info"]["events"].append(
                f"Agent {agent_id} hit obstacle, stayed at ({agent_pos.x:.1f}, {agent_pos.y:.1f})"
            )
    elif isinstance(action, list) and len(action) >= 2:
        # Handle continuous actions
        dx, dy = float(action[0]), float(action[1])
        max_speed = 0.1
        new_x = agent_pos.x + dx * max_speed
        new_y = agent_pos.y + dy * max_speed

        # Check bounds
        if world["coordinateSystem"] == "cartesian":
            new_x = max(-world["width"] / 2, min(world["width"] / 2, new_x))
            new_y = max(-world["height"] / 2, min(world["height"] / 2, new_y))
        else:
            new_x = max(0, min(world["width"], new_x))
            new_y = max(0, min(world["height"], new_y))

        agent["position"] = [new_x, new_y]
        state["info"]["events"].append(
            f"Agent {agent_id} moved to ({new_x:.1f}, {new_y:.1f})"
        )


def select_action(
    state: Dict[str, Any], env_spec: Dict[str, Any], policy: Literal["random", "greedy"]
) -> Any:
    """Select action based on policy - supports both single and multi-agent"""
    action_space = env_spec.get("actionSpace", {})

    if action_space.get("type") == "discrete":
        actions = action_space.get("actions", ["up", "down", "left", "right"])

        # Multi-agent support: return actions for all agents
        if len(state.get("agents", [])) > 1:
            agent_actions = {}
            for agent in state["agents"]:
                agent_id = agent.get("id", "unknown")
                if policy == "random":
                    agent_actions[agent_id] = random.choice(actions)
                else:
                    agent_actions[agent_id] = select_greedy_action_for_agent(
                        agent, state, env_spec, actions
                    )
            return agent_actions

        # Single agent (backward compatibility)
        if policy == "random":
            return random.choice(actions)
        else:  # greedy with obstacle avoidance
            if not state["agents"]:
                return actions[0]

            agent = state["agents"][0]
            agent_pos_list = agent.get("position", [0, 0])
            if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
                return random.choice(actions)
            agent_pos = Vec2.from_list(agent_pos_list)

            # Find goals from env_spec objects
            goals = [
                obj
                for obj in env_spec.get("objects", [])
                if obj
                and isinstance(obj, dict)
                and obj.get("type") == "goal"
                and isinstance(obj.get("position"), list)
                and len(obj.get("position", [])) >= 2
            ]
            if not goals:
                return random.choice(actions)

            # Find nearest goal
            def goal_distance(g):
                g_pos = g.get("position", [0, 0])
                if not isinstance(g_pos, list) or len(g_pos) < 2:
                    return float("inf")
                return agent_pos.distance(Vec2.from_list(g_pos))

            nearest_goal = min(goals, key=goal_distance)
            goal_pos = Vec2.from_list(nearest_goal.get("position", [0, 0]))

            dx = goal_pos.x - agent_pos.x
            world = env_spec["world"]
            if world["coordinateSystem"] == "grid":
                dy = agent_pos.y - goal_pos.y
            else:
                dy = goal_pos.y - agent_pos.y

            # Helper to check if a position would hit an obstacle
            def would_hit_obstacle(new_pos: Vec2) -> bool:
                # Check bounds first
                if world["coordinateSystem"] == "grid":
                    if (
                        new_pos.x < 0
                        or new_pos.x >= world["width"]
                        or new_pos.y < 0
                        or new_pos.y >= world["height"]
                    ):
                        return True
                # Check obstacles
                for obj in state.get("objects", []):
                    if obj.get("type") in ["wall", "obstacle"]:
                        obj_pos_list = obj.get("position", [0, 0])
                        if isinstance(obj_pos_list, list) and len(obj_pos_list) >= 2:
                            obj_pos = Vec2.from_list(obj_pos_list)
                            # For grid, check if same cell
                            if world["coordinateSystem"] == "grid":
                                if (
                                    abs(new_pos.x - obj_pos.x) < 0.5
                                    and abs(new_pos.y - obj_pos.y) < 0.5
                                ):
                                    return True
                            else:
                                if new_pos.distance(obj_pos) < 1.0:
                                    return True
                return False

            # Calculate preferred direction
            preferred_action = None
            if abs(dx) >= abs(dy):
                # Move horizontally first
                if abs(dx) < 0.1:
                    # Almost aligned horizontally, move vertically
                    if world["coordinateSystem"] == "grid":
                        preferred_action = "up" if dy > 0 else "down"
                    else:
                        preferred_action = "up" if dy > 0 else "down"
                else:
                    preferred_action = "right" if dx > 0 else "left"
            else:
                # Move vertically first
                if abs(dy) < 0.1:
                    # Almost aligned vertically, move horizontally
                    preferred_action = "right" if dx > 0 else "left"
                else:
                    if world["coordinateSystem"] == "grid":
                        preferred_action = "up" if dy > 0 else "down"
                    else:
                        preferred_action = "up" if dy > 0 else "down"

            # Check if preferred action would hit obstacle
            cell_size = (
                world.get("cellSize", 1.0)
                if world["coordinateSystem"] == "grid"
                else 0.1
            )
            test_pos = Vec2(agent_pos.x, agent_pos.y)

            if preferred_action == "up":
                test_pos.y -= cell_size if world["coordinateSystem"] == "grid" else 0.1
            elif preferred_action == "down":
                test_pos.y += cell_size if world["coordinateSystem"] == "grid" else 0.1
            elif preferred_action == "left":
                test_pos.x -= cell_size if world["coordinateSystem"] == "grid" else 0.1
            elif preferred_action == "right":
                test_pos.x += cell_size if world["coordinateSystem"] == "grid" else 0.1

            # Clamp to bounds
            if world["coordinateSystem"] == "grid":
                test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
                test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
                test_pos.x = round(test_pos.x)
                test_pos.y = round(test_pos.y)

            if not would_hit_obstacle(test_pos):
                return preferred_action

            # Preferred direction blocked, try alternatives
            # Try perpendicular directions first (better for pathfinding)
            alternatives = []
            if preferred_action in ["up", "down"]:
                # Was trying vertical, try horizontal
                alternatives = [
                    "right" if dx > 0 else "left",
                    "left" if dx > 0 else "right",
                ]
            else:
                # Was trying horizontal, try vertical
                if world["coordinateSystem"] == "grid":
                    alternatives = [
                        "up" if dy > 0 else "down",
                        "down" if dy > 0 else "up",
                    ]
                else:
                    alternatives = [
                        "up" if dy > 0 else "down",
                        "down" if dy > 0 else "up",
                    ]

            # Try alternatives
            for alt_action in alternatives:
                test_pos = Vec2(agent_pos.x, agent_pos.y)
                if alt_action == "up":
                    test_pos.y -= (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif alt_action == "down":
                    test_pos.y += (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif alt_action == "left":
                    test_pos.x -= (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif alt_action == "right":
                    test_pos.x += (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )

                # Clamp to bounds
                if world["coordinateSystem"] == "grid":
                    test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
                    test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
                    test_pos.x = round(test_pos.x)
                    test_pos.y = round(test_pos.y)

                if not would_hit_obstacle(test_pos):
                    return alt_action

            # All preferred directions blocked, try any valid direction
            for action in actions:
                test_pos = Vec2(agent_pos.x, agent_pos.y)
                if action == "up":
                    test_pos.y -= (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif action == "down":
                    test_pos.y += (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif action == "left":
                    test_pos.x -= (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )
                elif action == "right":
                    test_pos.x += (
                        cell_size if world["coordinateSystem"] == "grid" else 0.1
                    )

                # Clamp to bounds
                if world["coordinateSystem"] == "grid":
                    test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
                    test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
                    test_pos.x = round(test_pos.x)
                    test_pos.y = round(test_pos.y)

                if not would_hit_obstacle(test_pos):
                    return action

            # All directions blocked, return preferred anyway (will hit obstacle but at least tries)
            return preferred_action
    else:
        # Continuous action space
        # Multi-agent support
        if len(state.get("agents", [])) > 1:
            agent_actions = {}
            for agent in state["agents"]:
                agent_id = agent.get("id", "unknown")
                if policy == "random":
                    agent_actions[agent_id] = [
                        random.uniform(-1, 1),
                        random.uniform(-1, 1),
                    ]
                else:
                    agent_actions[agent_id] = select_greedy_continuous_action_for_agent(
                        agent, state, env_spec
                    )
            return agent_actions

        # Single agent (backward compatibility)
        if policy == "random":
            return [random.uniform(-1, 1), random.uniform(-1, 1)]
        else:
            # Greedy: move towards goal
            if not state["agents"]:
                return [0, 0]
            agent = state["agents"][0]
            agent_pos_list = agent.get("position", [0, 0])
            if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
                return [0, 0]
            agent_pos = Vec2.from_list(agent_pos_list)
            goals = [
                obj
                for obj in env_spec.get("objects", [])
                if obj
                and isinstance(obj, dict)
                and obj.get("type") == "goal"
                and isinstance(obj.get("position"), list)
                and len(obj.get("position", [])) >= 2
            ]
            if not goals:
                return [0, 0]
            goal_pos_list = goals[0].get("position", [0, 0])
            if not isinstance(goal_pos_list, list) or len(goal_pos_list) < 2:
                return [0, 0]
            goal_pos = Vec2.from_list(goal_pos_list)
            dx = goal_pos.x - agent_pos.x
            dy = goal_pos.y - agent_pos.y
            dist = math.sqrt(dx**2 + dy**2)
            if dist < 0.1:
                return [0, 0]
            return [dx / dist, dy / dist]


def select_greedy_action_for_agent(
    agent: Dict[str, Any],
    state: Dict[str, Any],
    env_spec: Dict[str, Any],
    actions: List[str],
) -> str:
    """Helper: Select greedy action for a specific agent (for multi-agent support)"""
    agent_pos_list = agent.get("position", [0, 0])
    if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
        return random.choice(actions)
    agent_pos = Vec2.from_list(agent_pos_list)

    # Find goals from env_spec objects
    goals = [
        obj
        for obj in env_spec.get("objects", [])
        if obj
        and isinstance(obj, dict)
        and obj.get("type") == "goal"
        and isinstance(obj.get("position"), list)
        and len(obj.get("position", [])) >= 2
    ]
    if not goals:
        return random.choice(actions)

    # Find nearest goal
    def goal_distance(g):
        g_pos = g.get("position", [0, 0])
        if not isinstance(g_pos, list) or len(g_pos) < 2:
            return float("inf")
        return agent_pos.distance(Vec2.from_list(g_pos))

    nearest_goal = min(goals, key=goal_distance)
    goal_pos = Vec2.from_list(nearest_goal.get("position", [0, 0]))

    dx = goal_pos.x - agent_pos.x
    world = env_spec["world"]
    if world["coordinateSystem"] == "grid":
        dy = agent_pos.y - goal_pos.y
    else:
        dy = goal_pos.y - agent_pos.y

    # Helper to check if a position would hit an obstacle
    def would_hit_obstacle(new_pos: Vec2) -> bool:
        # Check bounds first
        if world["coordinateSystem"] == "grid":
            if (
                new_pos.x < 0
                or new_pos.x >= world["width"]
                or new_pos.y < 0
                or new_pos.y >= world["height"]
            ):
                return True
        # Check obstacles
        for obj in state.get("objects", []):
            if obj.get("type") in ["wall", "obstacle"]:
                obj_pos_list = obj.get("position", [0, 0])
                if isinstance(obj_pos_list, list) and len(obj_pos_list) >= 2:
                    obj_pos = Vec2.from_list(obj_pos_list)
                    if world["coordinateSystem"] == "grid":
                        if (
                            abs(new_pos.x - obj_pos.x) < 0.5
                            and abs(new_pos.y - obj_pos.y) < 0.5
                        ):
                            return True
                    else:
                        if new_pos.distance(obj_pos) < 1.0:
                            return True
        # Check other agents
        for other_agent in state.get("agents", []):
            if other_agent.get("id") == agent.get("id"):
                continue
            other_pos_list = other_agent.get("position", [0, 0])
            if isinstance(other_pos_list, list) and len(other_pos_list) >= 2:
                other_pos = Vec2.from_list(other_pos_list)
                if new_pos.distance(other_pos) < 0.5:
                    return True
        return False

    # Calculate preferred direction
    preferred_action = None
    if abs(dx) >= abs(dy):
        preferred_action = (
            "right"
            if dx > 0
            else "left" if abs(dx) >= 0.1 else ("up" if dy > 0 else "down")
        )
    else:
        if world["coordinateSystem"] == "grid":
            preferred_action = "up" if dy > 0 else "down"
        else:
            preferred_action = "up" if dy > 0 else "down"

    # Check if preferred action would hit obstacle
    cell_size = (
        world.get("cellSize", 1.0) if world["coordinateSystem"] == "grid" else 0.1
    )
    test_pos = Vec2(agent_pos.x, agent_pos.y)

    if preferred_action == "up":
        test_pos.y -= cell_size if world["coordinateSystem"] == "grid" else 0.1
    elif preferred_action == "down":
        test_pos.y += cell_size if world["coordinateSystem"] == "grid" else 0.1
    elif preferred_action == "left":
        test_pos.x -= cell_size if world["coordinateSystem"] == "grid" else 0.1
    elif preferred_action == "right":
        test_pos.x += cell_size if world["coordinateSystem"] == "grid" else 0.1

    # Clamp to bounds
    if world["coordinateSystem"] == "grid":
        test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
        test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
        test_pos.x = round(test_pos.x)
        test_pos.y = round(test_pos.y)

    if not would_hit_obstacle(test_pos):
        return preferred_action

    # Try alternatives
    alternatives = []
    if preferred_action in ["up", "down"]:
        alternatives = ["right" if dx > 0 else "left", "left" if dx > 0 else "right"]
    else:
        if world["coordinateSystem"] == "grid":
            alternatives = ["up" if dy > 0 else "down", "down" if dy > 0 else "up"]
        else:
            alternatives = ["up" if dy > 0 else "down", "down" if dy > 0 else "up"]

    for alt_action in alternatives:
        test_pos = Vec2(agent_pos.x, agent_pos.y)
        if alt_action == "up":
            test_pos.y -= cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif alt_action == "down":
            test_pos.y += cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif alt_action == "left":
            test_pos.x -= cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif alt_action == "right":
            test_pos.x += cell_size if world["coordinateSystem"] == "grid" else 0.1

        if world["coordinateSystem"] == "grid":
            test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
            test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
            test_pos.x = round(test_pos.x)
            test_pos.y = round(test_pos.y)

        if not would_hit_obstacle(test_pos):
            return alt_action

    # Try any valid action
    for action in actions:
        test_pos = Vec2(agent_pos.x, agent_pos.y)
        if action == "up":
            test_pos.y -= cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif action == "down":
            test_pos.y += cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif action == "left":
            test_pos.x -= cell_size if world["coordinateSystem"] == "grid" else 0.1
        elif action == "right":
            test_pos.x += cell_size if world["coordinateSystem"] == "grid" else 0.1

        if world["coordinateSystem"] == "grid":
            test_pos.x = max(0, min(world["width"] - 1, test_pos.x))
            test_pos.y = max(0, min(world["height"] - 1, test_pos.y))
            test_pos.x = round(test_pos.x)
            test_pos.y = round(test_pos.y)

        if not would_hit_obstacle(test_pos):
            return action

    return preferred_action


def select_greedy_continuous_action_for_agent(
    agent: Dict[str, Any], state: Dict[str, Any], env_spec: Dict[str, Any]
) -> List[float]:
    """Helper: Select greedy continuous action for a specific agent"""
    agent_pos_list = agent.get("position", [0, 0])
    if not isinstance(agent_pos_list, list) or len(agent_pos_list) < 2:
        return [0, 0]
    agent_pos = Vec2.from_list(agent_pos_list)

    goals = [
        obj
        for obj in env_spec.get("objects", [])
        if obj
        and isinstance(obj, dict)
        and obj.get("type") == "goal"
        and isinstance(obj.get("position"), list)
        and len(obj.get("position", [])) >= 2
    ]
    if not goals:
        return [0, 0]

    goal_pos_list = goals[0].get("position", [0, 0])
    if not isinstance(goal_pos_list, list) or len(goal_pos_list) < 2:
        return [0, 0]
    goal_pos = Vec2.from_list(goal_pos_list)
    dx = goal_pos.x - agent_pos.x
    dy = goal_pos.y - agent_pos.y
    dist = math.sqrt(dx**2 + dy**2)
    if dist < 0.1:
        return [0, 0]
    return [dx / dist, dy / dist]


def create_initial_state(env_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Create initial state from EnvSpec"""
    return {
        "agents": [
            {
                "id": agent.get("id", ""),
                "position": (
                    agent.get("position", [0, 0])[:]
                    if isinstance(agent.get("position"), list)
                    and len(agent.get("position", [])) >= 2
                    else [0, 0]
                ),
                "rotation": agent.get("rotation", 0.0),
            }
            for agent in env_spec.get("agents", [])
            if agent and isinstance(agent, dict)
        ],
        "objects": [
            {
                "id": obj.get("id", ""),
                "position": (
                    obj.get("position", [0, 0])[:]
                    if isinstance(obj.get("position"), list)
                    and len(obj.get("position", [])) >= 2
                    else [0, 0]
                ),
                "rotation": obj.get("rotation", 0.0),
                "type": obj.get("type", "custom"),
            }
            for obj in env_spec.get("objects", [])
            if obj and isinstance(obj, dict)
        ],
        "step": 0,
        "totalReward": 0.0,
        "done": False,
        "info": {"events": ["Episode started"], "rewards": []},
    }


def step_simulator(
    state: Dict[str, Any], action: Any, env_spec: Dict[str, Any], max_steps: int
) -> Dict[str, Any]:
    """Step simulator - supports both single and multi-agent actions"""
    if state["done"]:
        return state

    # Apply action
    new_state = apply_action(state, action, env_spec)

    # Calculate rewards
    reward_details = calculate_reward(new_state, env_spec)
    step_reward = sum(r["value"] for r in reward_details)
    new_state["totalReward"] += step_reward
    new_state["info"]["rewards"] = reward_details

    # Check termination
    termination = check_termination(new_state, env_spec)
    if termination["terminated"]:
        new_state["done"] = True
        new_state["info"]["events"].append(
            f"Terminated: {termination.get('reason', 'unknown')}"
        )

    # Check max steps (use parameter, not timeout rule)
    if new_state["step"] >= max_steps:
        new_state["done"] = True
        new_state["info"]["events"].append(f"Max steps ({max_steps}) reached")

    return new_state


def validate_env_spec(env_spec: Dict[str, Any]) -> tuple[bool, str]:
    """Validate EnvSpec before running rollout"""
    # Check required fields
    if not isinstance(env_spec, dict):
        return False, "EnvSpec must be a dictionary"

    if "world" not in env_spec:
        return False, "EnvSpec missing 'world' field"

    world = env_spec.get("world", {})
    if not isinstance(world, dict):
        return False, "World spec must be a dictionary"

    if "width" not in world or "height" not in world:
        return False, "World spec must have 'width' and 'height'"

    if world.get("width", 0) <= 0 or world.get("height", 0) <= 0:
        return False, "World width and height must be positive"

    # Check agents
    agents = env_spec.get("agents", [])
    if not isinstance(agents, list):
        return False, "Agents must be a list"

    if len(agents) == 0:
        return False, "Environment must have at least one agent"

    # Validate each agent
    for i, agent in enumerate(agents):
        if not isinstance(agent, dict):
            return False, f"Agent {i} must be a dictionary"
        if "position" not in agent:
            return False, f"Agent {i} missing 'position' field"
        pos = agent.get("position", [])
        if not isinstance(pos, list) or len(pos) < 2:
            return False, f"Agent {i} position must be [x, y]"
        try:
            x, y = float(pos[0]), float(pos[1])
            if (
                x < 0
                or x >= world.get("width", 0)
                or y < 0
                or y >= world.get("height", 0)
            ):
                return False, f"Agent {i} position ({x}, {y}) is out of bounds"
        except (ValueError, TypeError):
            return False, f"Agent {i} position must be numeric"

    # Check action space
    action_space = env_spec.get("actionSpace", {})
    if not isinstance(action_space, dict):
        return False, "Action space must be a dictionary"

    if "type" not in action_space:
        return False, "Action space must have 'type' field"

    if action_space.get("type") == "discrete":
        actions = action_space.get("actions", [])
        if not isinstance(actions, list) or len(actions) == 0:
            return False, "Discrete action space must have non-empty 'actions' list"

    # Check objects (optional but validate if present)
    objects = env_spec.get("objects", [])
    if not isinstance(objects, list):
        return False, "Objects must be a list"

    for i, obj in enumerate(objects):
        if not isinstance(obj, dict):
            return False, f"Object {i} must be a dictionary"
        if "position" in obj:
            pos = obj.get("position", [])
            if isinstance(pos, list) and len(pos) >= 2:
                try:
                    x, y = float(pos[0]), float(pos[1])
                    # Objects can be slightly out of bounds (for continuous), but warn if way out
                    if (
                        x < -world.get("width", 0)
                        or x > world.get("width", 0) * 2
                        or y < -world.get("height", 0)
                        or y > world.get("height", 0) * 2
                    ):
                        return (
                            False,
                            f"Object {i} position ({x}, {y}) is way out of bounds",
                        )
                except (ValueError, TypeError):
                    pass  # Non-numeric positions are handled elsewhere

    # Validate reward rules - warn if missing but don't block
    rules = env_spec.get("rules", {})
    reward_rules = rules.get("rewards", [])
    if not isinstance(reward_rules, list) or len(reward_rules) == 0:
        return (
            False,
            "No reward rules defined. Please add reward rules in the Rules panel (right sidebar → Rewards tab)",
        )

    # Validate termination rules - warn if missing but don't block
    termination_rules = rules.get("terminations", [])
    if not isinstance(termination_rules, list) or len(termination_rules) == 0:
        return (
            False,
            "No termination rules defined. Please add termination rules in the Rules panel (right sidebar → Terminations tab)",
        )

    return True, "OK"


def run_rollout(
    env_spec: Dict[str, Any],
    policy: Literal["random", "greedy"] = "random",
    max_steps: int = 100,
    stream_callback: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Run a single rollout"""
    # Validate environment first
    is_valid, error_msg = validate_env_spec(env_spec)
    if not is_valid:
        return {
            "success": False,
            "error": f"Invalid environment: {error_msg}",
            "steps": [],
            "totalReward": 0.0,
            "episodeLength": 0,
            "terminationReason": f"Validation failed: {error_msg}",
        }

    state = create_initial_state(env_spec)
    steps = []

    # max_steps parameter takes precedence (user input from frontend)
    # Only use timeout rule as fallback if max_steps is not explicitly provided (default 100)
    # Since max_steps is passed as a parameter, we respect it directly
    # Note: The frontend already handles priority: user input > timeout rule > default

    while not state["done"] and state["step"] < max_steps:
        # Select action
        action = select_action(state, env_spec, policy)

        # Step environment (pass max_steps parameter)
        prev_reward = state["totalReward"]
        state = step_simulator(state, action, env_spec, max_steps)
        step_reward = state["totalReward"] - prev_reward

        # Create step
        step = {
            "state": {
                "agents": [{**a} for a in state["agents"]],
                "objects": [{**o} for o in state["objects"]],
                "step": state["step"],
                "totalReward": state["totalReward"],
                "done": state["done"],
                "info": {
                    "events": state["info"]["events"][:],
                    "rewards": state["info"]["rewards"][:],
                },
            },
            "action": action,
            "reward": step_reward,
            "done": state["done"],
        }

        steps.append(step)

        # Stream callback if provided
        if stream_callback:
            try:
                stream_callback(step)
            except Exception as e:
                # Don't fail rollout if streaming fails
                pass

    # Check success - agent reached goal position
    success = False
    if state["agents"]:
        agent = state["agents"][0]
        agent_pos_list = agent.get("position", [0, 0])
        if isinstance(agent_pos_list, list) and len(agent_pos_list) >= 2:
            agent_pos = Vec2.from_list(agent_pos_list)
            # Check if agent is at any goal
            goals = [
                obj
                for obj in env_spec.get("objects", [])
                if obj
                and isinstance(obj, dict)
                and obj.get("type") == "goal"
                and isinstance(obj.get("position"), list)
                and len(obj.get("position", [])) >= 2
            ]
            for goal in goals:
                goal_pos_list = goal.get("position", [0, 0])
                if isinstance(goal_pos_list, list) and len(goal_pos_list) >= 2:
                    goal_pos = Vec2.from_list(goal_pos_list)
                    distance = agent_pos.distance(goal_pos)
                    if distance < 0.5:  # Within 0.5 units of goal
                        success = True
                        break
    # Also check events for goal-related messages
    if not success:
        success = any(
            "goal" in event.lower()
            or "Goal" in event
            or "reached goal" in event.lower()
            for event in state["info"].get("events", [])
        )

    return {
        "steps": steps,
        "totalReward": state["totalReward"],
        "episodeLength": state["step"],
        "success": success,
        "terminationReason": (
            state["info"]["events"][-1] if state["info"]["events"] else None
        ),
    }
