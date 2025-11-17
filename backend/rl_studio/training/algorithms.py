"""
Algorithm Registry
Central registry for available RL algorithms
"""

from typing import Dict, Any, List
from stable_baselines3 import PPO, DQN, A2C, TD3, SAC


class AlgorithmRegistry:
    """Registry of available RL algorithms"""
    
    ALGORITHMS = {
        "PPO": {
            "name": "Proximal Policy Optimization",
            "type": "on_policy",
            "supports_continuous": True,
            "supports_discrete": True,
            "description": "State-of-the-art on-policy algorithm, good for most tasks",
            "class": PPO,
        },
        "DQN": {
            "name": "Deep Q-Network",
            "type": "off_policy",
            "supports_continuous": False,
            "supports_discrete": True,
            "description": "Classic off-policy algorithm for discrete action spaces",
            "class": DQN,
        },
        "A2C": {
            "name": "Advantage Actor-Critic",
            "type": "on_policy",
            "supports_continuous": True,
            "supports_discrete": True,
            "description": "Simpler on-policy alternative to PPO",
            "class": A2C,
        },
        "TD3": {
            "name": "Twin Delayed DDPG",
            "type": "off_policy",
            "supports_continuous": True,
            "supports_discrete": False,
            "description": "State-of-the-art for continuous control",
            "class": TD3,
        },
        "SAC": {
            "name": "Soft Actor-Critic",
            "type": "off_policy",
            "supports_continuous": True,
            "supports_discrete": False,
            "description": "Sample-efficient continuous control with entropy regularization",
            "class": SAC,
        },
    }
    
    @classmethod
    def get_available_algorithms(cls, action_space_type: str = "discrete") -> List[Dict[str, Any]]:
        """Get algorithms compatible with action space type"""
        compatible = []
        for algo_id, algo_info in cls.ALGORITHMS.items():
            if action_space_type == "discrete" and algo_info["supports_discrete"]:
                compatible.append({
                    "id": algo_id,
                    **algo_info,
                })
            elif action_space_type == "continuous" and algo_info["supports_continuous"]:
                compatible.append({
                    "id": algo_id,
                    **algo_info,
                })
        return compatible
    
    @classmethod
    def get_algorithm_info(cls, algorithm_id: str) -> Dict[str, Any]:
        """Get information about a specific algorithm"""
        if algorithm_id not in cls.ALGORITHMS:
            raise ValueError(f"Unknown algorithm: {algorithm_id}")
        return {
            "id": algorithm_id,
            **cls.ALGORITHMS[algorithm_id],
        }

