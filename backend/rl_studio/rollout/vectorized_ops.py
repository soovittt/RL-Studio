"""
Vectorized Operations for High-Performance Simulation
Uses NumPy for batch processing and vectorized calculations.

Target: 5-20x faster for batch operations
"""

import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from typing import Dict, Any, List, Tuple
import logging

logger = logging.getLogger(__name__)


def vectorized_reward_calculation(
    states: List[Dict[str, Any]],
    env_spec: Dict[str, Any],
    reward_rules: List[Dict[str, Any]]
) -> np.ndarray:
    """
    Calculate rewards for a batch of states using vectorized operations.
    
    Args:
        states: List of state dictionaries
        env_spec: Environment specification
        reward_rules: List of reward rules
    
    Returns:
        Array of total rewards per state
    """
    if not states or not reward_rules:
        return np.array([])
    
    num_states = len(states)
    num_rules = len(reward_rules)
    
    # Extract agent positions as NumPy array
    agent_positions = np.zeros((num_states, 2))
    for i, state in enumerate(states):
        agents = state.get("agents", [])
        if agents:
            pos = agents[0].get("position", [0, 0])
            if isinstance(pos, list) and len(pos) >= 2:
                agent_positions[i] = [float(pos[0]), float(pos[1])]
    
    # Extract object positions
    objects = env_spec.get("objects", [])
    goal_positions = []
    for obj in objects:
        if obj.get("type") == "goal":
            pos = obj.get("position", [0, 0])
            if isinstance(pos, list) and len(pos) >= 2:
                goal_positions.append([float(pos[0]), float(pos[1])])
    
    if not goal_positions:
        return np.zeros(num_states)
    
    goal_positions = np.array(goal_positions)
    
    # Vectorized distance calculation
    rewards = np.zeros(num_states)
    
    for rule in reward_rules:
        condition = rule.get("condition", {})
        cond_type = condition.get("type")
        reward_value = float(rule.get("reward", 0))
        
        if cond_type == "agent_at_position":
            target_pos = condition.get("position", [0, 0])
            if isinstance(target_pos, list) and len(target_pos) >= 2:
                target = np.array([float(target_pos[0]), float(target_pos[1])])
                tolerance = float(condition.get("tolerance", 0.5))
                
                # Vectorized distance calculation
                distances = np.linalg.norm(agent_positions - target, axis=1)
                mask = distances <= tolerance
                rewards[mask] += reward_value
        
        elif cond_type == "agent_at_object":
            # Find goal object
            for goal_pos in goal_positions:
                distances = np.linalg.norm(agent_positions - goal_pos, axis=1)
                tolerance = float(condition.get("tolerance", 0.5))
                mask = distances <= tolerance
                rewards[mask] += reward_value
        
        elif cond_type == "agent_near_object":
            object_id = condition.get("objectId")
            for obj in objects:
                if obj.get("id") == object_id:
                    obj_pos = obj.get("position", [0, 0])
                    if isinstance(obj_pos, list) and len(obj_pos) >= 2:
                        target = np.array([float(obj_pos[0]), float(obj_pos[1])])
                        distances = np.linalg.norm(agent_positions - target, axis=1)
                        tolerance = float(condition.get("tolerance", 1.0))
                        mask = distances <= tolerance
                        rewards[mask] += reward_value
    
    return rewards


def vectorized_collision_detection(
    agent_positions: np.ndarray,
    obstacle_positions: np.ndarray,
    collision_radius: float = 1.0
) -> np.ndarray:
    """
    Vectorized collision detection between agents and obstacles.
    
    Args:
        agent_positions: Array of shape (N, 2) for N agents
        obstacle_positions: Array of shape (M, 2) for M obstacles
        collision_radius: Collision detection radius
    
    Returns:
        Boolean array of shape (N,) indicating collisions
    """
    if len(obstacle_positions) == 0:
        return np.zeros(len(agent_positions), dtype=bool)
    
    # Compute pairwise distances: (N, M) matrix
    # agent_positions: (N, 2), obstacle_positions: (M, 2)
    # distances[i, j] = distance from agent i to obstacle j
    distances = np.sqrt(
        np.sum(
            (agent_positions[:, np.newaxis, :] - obstacle_positions[np.newaxis, :, :]) ** 2,
            axis=2
        )
    )
    
    # Check if any obstacle is within collision radius
    collisions = np.any(distances < collision_radius, axis=1)
    
    return collisions


def vectorized_position_update(
    positions: np.ndarray,
    actions: np.ndarray,
    world_bounds: Tuple[float, float, float, float],
    coordinate_system: str = "grid"
) -> np.ndarray:
    """
    Vectorized position update for batch of agents.
    
    Args:
        positions: Array of shape (N, 2) for N agents
        actions: Array of shape (N, 2) for action deltas
        world_bounds: (min_x, min_y, max_x, max_y)
        coordinate_system: "grid" or "cartesian"
    
    Returns:
        Updated positions array
    """
    new_positions = positions.copy()
    
    # Apply action deltas
    if coordinate_system == "grid":
        # Grid: discrete movements
        step_size = 1.0
        new_positions += actions * step_size
        # Snap to grid
        new_positions = np.round(new_positions)
    else:
        # Continuous: smooth movements
        step_size = 0.1
        new_positions += actions * step_size
    
    # Clamp to bounds
    min_x, min_y, max_x, max_y = world_bounds
    new_positions[:, 0] = np.clip(new_positions[:, 0], min_x, max_x)
    new_positions[:, 1] = np.clip(new_positions[:, 1], min_y, max_y)
    
    return new_positions


def batch_step_simulator(
    states: List[Dict[str, Any]],
    actions: List[Any],
    env_spec: Dict[str, Any],
    max_steps: int = 100
) -> List[Dict[str, Any]]:
    """
    Step multiple environments in parallel using vectorized operations.
    
    This is a high-performance version that processes multiple rollouts
    simultaneously using NumPy vectorization.
    
    Args:
        states: List of current states
        actions: List of actions (one per state)
        env_spec: Environment specification
        max_steps: Maximum steps
    
    Returns:
        List of new states
    """
    if not states:
        return []
    
    num_envs = len(states)
    world = env_spec.get("world", {})
    world_bounds = (
        0.0, 0.0,
        float(world.get("width", 10)),
        float(world.get("height", 10))
    )
    
    # Extract positions
    agent_positions = np.zeros((num_envs, 2))
    for i, state in enumerate(states):
        agents = state.get("agents", [])
        if agents:
            pos = agents[0].get("position", [0, 0])
            if isinstance(pos, list) and len(pos) >= 2:
                agent_positions[i] = [float(pos[0]), float(pos[1])]
    
    # Extract obstacle positions
    obstacles = [obj for obj in env_spec.get("objects", []) 
                 if obj.get("type") in ["wall", "obstacle"]]
    obstacle_positions = np.array([
        [float(obj.get("position", [0, 0])[0]), float(obj.get("position", [0, 0])[1])]
        for obj in obstacles
        if isinstance(obj.get("position"), list) and len(obj.get("position", [])) >= 2
    ])
    
    # Convert actions to deltas
    action_deltas = np.zeros((num_envs, 2))
    for i, action in enumerate(actions):
        if isinstance(action, str):
            # Discrete action
            if action == "up":
                action_deltas[i] = [0, -1]
            elif action == "down":
                action_deltas[i] = [0, 1]
            elif action == "left":
                action_deltas[i] = [-1, 0]
            elif action == "right":
                action_deltas[i] = [1, 0]
        elif isinstance(action, list) and len(action) >= 2:
            # Continuous action
            action_deltas[i] = [float(action[0]), float(action[1])]
    
    # Vectorized position update
    new_positions = vectorized_position_update(
        agent_positions,
        action_deltas,
        world_bounds,
        world.get("coordinateSystem", "grid")
    )
    
    # Vectorized collision detection
    collisions = vectorized_collision_detection(new_positions, obstacle_positions)
    
    # Update positions (only if no collision)
    for i, (collision, new_pos) in enumerate(zip(collisions, new_positions)):
        if not collision:
            if states[i].get("agents"):
                states[i]["agents"][0]["position"] = new_pos.tolist()
    
    # Calculate rewards (vectorized)
    reward_rules = env_spec.get("rules", {}).get("rewards", [])
    rewards = vectorized_reward_calculation(states, env_spec, reward_rules)
    
    # Update states
    new_states = []
    for i, (state, reward) in enumerate(zip(states, rewards)):
        new_state = {
            **state,
            "step": state.get("step", 0) + 1,
            "totalReward": state.get("totalReward", 0.0) + float(reward),
            "done": state.get("done", False) or collisions[i] or state.get("step", 0) >= max_steps
        }
        new_states.append(new_state)
    
    return new_states


def vectorized_distance_matrix(
    positions_a: np.ndarray,
    positions_b: np.ndarray
) -> np.ndarray:
    """
    Compute pairwise distance matrix between two sets of positions.
    
    Args:
        positions_a: Array of shape (N, 2)
        positions_b: Array of shape (M, 2)
    
    Returns:
        Distance matrix of shape (N, M)
    """
    # Broadcasting: (N, 1, 2) - (1, M, 2) = (N, M, 2)
    diff = positions_a[:, np.newaxis, :] - positions_b[np.newaxis, :, :]
    distances = np.sqrt(np.sum(diff ** 2, axis=2))
    return distances


def vectorized_goal_reward(
    agent_positions: np.ndarray,
    goal_positions: np.ndarray,
    reward_value: float = 1.0,
    tolerance: float = 0.5
) -> np.ndarray:
    """
    Calculate goal-reaching rewards for batch of agents.
    
    Args:
        agent_positions: Array of shape (N, 2)
        goal_positions: Array of shape (M, 2)
        reward_value: Reward for reaching goal
        tolerance: Distance tolerance
    
    Returns:
        Reward array of shape (N,)
    """
    if len(goal_positions) == 0:
        return np.zeros(len(agent_positions))
    
    # Compute distances to all goals
    distances = vectorized_distance_matrix(agent_positions, goal_positions)
    
    # Find minimum distance to any goal
    min_distances = np.min(distances, axis=1)
    
    # Reward if within tolerance
    rewards = np.where(min_distances <= tolerance, reward_value, 0.0)
    
    return rewards

