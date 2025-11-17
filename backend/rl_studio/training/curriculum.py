"""
Curriculum Learning Engine
Automatically adjusts environment difficulty during training
"""

from typing import Dict, Any, List, Optional, Callable
import numpy as np


class CurriculumStage:
    """A stage in the curriculum"""
    
    def __init__(
        self,
        name: str,
        env_modifier: Callable[[Dict[str, Any]], Dict[str, Any]],
        transition_condition: Callable[[List[float]], bool],
        description: str = ""
    ):
        self.name = name
        self.env_modifier = env_modifier
        self.transition_condition = transition_condition
        self.description = description


class CurriculumLearningEngine:
    """Manages curriculum learning"""
    
    def __init__(self, base_env_spec: Dict[str, Any]):
        self.base_env_spec = base_env_spec
        self.stages: List[CurriculumStage] = []
        self.current_stage_idx = 0
        self.episode_rewards: List[float] = []
        self.stage_transitions: List[Dict[str, Any]] = []
    
    def add_stage(
        self,
        name: str,
        env_modifier: Callable[[Dict[str, Any]], Dict[str, Any]],
        transition_condition: Callable[[List[float]], bool],
        description: str = ""
    ):
        """Add a curriculum stage"""
        stage = CurriculumStage(name, env_modifier, transition_condition, description)
        self.stages.append(stage)
    
    def get_current_env_spec(self) -> Dict[str, Any]:
        """Get current environment spec (modified by curriculum)"""
        if not self.stages:
            return self.base_env_spec
        
        current_stage = self.stages[self.current_stage_idx]
        return current_stage.env_modifier(self.base_env_spec.copy())
    
    def record_episode_reward(self, reward: float):
        """Record episode reward and check for stage transitions"""
        self.episode_rewards.append(reward)
        
        # Keep only recent rewards for transition check
        if len(self.episode_rewards) > 100:
            self.episode_rewards = self.episode_rewards[-100:]
        
        # Check if we should transition to next stage
        if self.current_stage_idx < len(self.stages) - 1:
            current_stage = self.stages[self.current_stage_idx]
            recent_rewards = self.episode_rewards[-20:] if len(self.episode_rewards) >= 20 else self.episode_rewards
            
            if current_stage.transition_condition(recent_rewards):
                self.current_stage_idx += 1
                self.stage_transitions.append({
                    "step": len(self.episode_rewards),
                    "from_stage": current_stage.name,
                    "to_stage": self.stages[self.current_stage_idx].name,
                    "mean_reward": np.mean(recent_rewards),
                })
                return True
        
        return False
    
    def get_stage_info(self) -> Dict[str, Any]:
        """Get information about current stage"""
        if not self.stages:
            return {"stage": "none", "progress": 0.0}
        
        current_stage = self.stages[self.current_stage_idx]
        progress = (self.current_stage_idx + 1) / len(self.stages)
        
        return {
            "stage": current_stage.name,
            "stage_index": self.current_stage_idx,
            "total_stages": len(self.stages),
            "progress": progress,
            "description": current_stage.description,
            "transitions": self.stage_transitions,
        }


# Predefined curriculum modifiers
def make_easier_goals(env_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Make goals easier to reach (closer to start)"""
    agents = env_spec.get("agents", [])
    goals = [o for o in env_spec.get("objects", []) if o.get("type") == "goal"]
    
    if agents and goals:
        agent_pos = agents[0].get("position", [0, 0])
        for goal in goals:
            goal_pos = goal.get("position", [0, 0])
            # Move goal closer to agent
            new_x = agent_pos[0] + (goal_pos[0] - agent_pos[0]) * 0.5
            new_y = agent_pos[1] + (goal_pos[1] - agent_pos[1]) * 0.5
            goal["position"] = [new_x, new_y]
    
    return env_spec


def reduce_obstacles(env_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Remove some obstacles"""
    objects = env_spec.get("objects", [])
    obstacles = [o for o in objects if o.get("type") in ["wall", "obstacle"]]
    
    # Remove half of obstacles
    num_to_remove = len(obstacles) // 2
    for _ in range(num_to_remove):
        if obstacles:
            obj_to_remove = obstacles.pop()
            objects.remove(obj_to_remove)
    
    return env_spec


def increase_reward_density(env_spec: Dict[str, Any]) -> Dict[str, Any]:
    """Increase reward density (add more shaping rewards)"""
    rules = env_spec.get("rules", {})
    rewards = rules.get("rewards", [])
    
    # Add a per-step reward if not present
    has_per_step = any(r.get("condition", {}).get("type") == "perStep" for r in rewards)
    if not has_per_step:
        rewards.append({
            "id": "curriculum_per_step",
            "condition": {"type": "perStep"},
            "reward": 0.1,
        })
        rules["rewards"] = rewards
    
    return env_spec


# Predefined transition conditions
def mean_reward_threshold(threshold: float) -> Callable[[List[float]], bool]:
    """Transition when mean reward exceeds threshold"""
    def condition(rewards: List[float]) -> bool:
        return len(rewards) >= 10 and np.mean(rewards) >= threshold
    return condition


def success_rate_threshold(rate: float, min_episodes: int = 20) -> Callable[[List[float]], bool]:
    """Transition when success rate exceeds threshold"""
    def condition(rewards: List[float]) -> bool:
        if len(rewards) < min_episodes:
            return False
        # Assume reward > 0 means success (adjust based on your reward structure)
        successes = sum(1 for r in rewards if r > 0)
        return successes / len(rewards) >= rate
    return condition

