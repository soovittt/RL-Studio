"""
Hyperparameter Suggestion Engine
Provides intelligent hyperparameter recommendations based on environment type
"""

from typing import Any, Dict, List, Tuple

import numpy as np


class HyperparameterSuggester:
    """Suggests hyperparameters based on environment characteristics"""

    def __init__(self):
        self.heuristics = self._load_heuristics()

    def _load_heuristics(self) -> Dict[str, Dict[str, Any]]:
        """Load hyperparameter heuristics"""
        return {
            "grid": {
                "learning_rate": {"min": 1e-4, "max": 1e-2, "default": 3e-3},
                "gamma": {"min": 0.9, "max": 0.999, "default": 0.99},
                "entropy_coef": {"min": 0.001, "max": 0.1, "default": 0.01},
                "clip_range": {"min": 0.1, "max": 0.3, "default": 0.2},
            },
            "continuous2d": {
                "learning_rate": {"min": 1e-5, "max": 1e-3, "default": 3e-4},
                "gamma": {"min": 0.95, "max": 0.999, "default": 0.99},
                "entropy_coef": {"min": 0.01, "max": 0.1, "default": 0.05},
                "clip_range": {"min": 0.1, "max": 0.3, "default": 0.2},
            },
            "multi_agent": {
                "learning_rate": {"min": 1e-5, "max": 1e-3, "default": 1e-4},
                "gamma": {"min": 0.9, "max": 0.99, "default": 0.95},
                "entropy_coef": {"min": 0.01, "max": 0.2, "default": 0.05},
                "clip_range": {"min": 0.1, "max": 0.3, "default": 0.2},
            },
        }

    def suggest(
        self, env_spec: Dict[str, Any], algorithm: str = "PPO"
    ) -> Dict[str, Any]:
        """Suggest hyperparameters for environment"""
        env_type = env_spec.get("envType", "grid")
        world = env_spec.get("world", {})

        # Base suggestions from heuristics
        base_heuristic = self.heuristics.get(env_type, self.heuristics["grid"])
        suggestions = {
            "learning_rate": base_heuristic["learning_rate"]["default"],
            "gamma": base_heuristic["gamma"]["default"],
            "entropy_coef": base_heuristic["entropy_coef"]["default"],
            "clip_range": base_heuristic["clip_range"]["default"],
        }

        # Adjust based on environment size
        if world.get("coordinateSystem") == "grid":
            width = world.get("width", 10)
            height = world.get("height", 10)
            size = width * height

            # Larger environments need more exploration
            if size > 100:
                suggestions["entropy_coef"] *= 1.5
                suggestions["learning_rate"] *= 0.8  # More stable for large spaces
            elif size < 50:
                suggestions["entropy_coef"] *= 0.7  # Less exploration needed
                suggestions["learning_rate"] *= 1.2  # Can learn faster

        # Adjust based on action space
        action_space = env_spec.get("actionSpace", {})
        if action_space.get("type") == "continuous":
            # Continuous actions need more exploration
            suggestions["entropy_coef"] *= 1.3
            suggestions["learning_rate"] *= 0.9

        # Adjust based on number of agents
        num_agents = len(env_spec.get("agents", []))
        if num_agents > 1:
            # Multi-agent: more exploration, lower learning rate
            suggestions["entropy_coef"] *= 1.2
            suggestions["learning_rate"] *= 0.8

        # Adjust based on reward sparsity
        reward_rules = env_spec.get("rules", {}).get("rewards", [])
        if len(reward_rules) == 0:
            # Sparse rewards: more exploration
            suggestions["entropy_coef"] *= 1.5
        elif len(reward_rules) > 10:
            # Dense rewards: less exploration needed
            suggestions["entropy_coef"] *= 0.7

        # Algorithm-specific adjustments
        if algorithm == "DQN":
            suggestions.update(
                {
                    "learning_rate": suggestions["learning_rate"]
                    * 0.5,  # DQN typically uses lower LR
                    "buffer_size": 100000,
                    "learning_starts": 1000,
                    "target_update_interval": 1000,
                }
            )

        # Clamp to valid ranges
        for key, value in suggestions.items():
            if key in base_heuristic:
                min_val = base_heuristic[key]["min"]
                max_val = base_heuristic[key]["max"]
                suggestions[key] = np.clip(value, min_val, max_val)

        # Generate explanation
        explanation = self._generate_explanation(env_spec, suggestions)

        return {
            "suggestions": suggestions,
            "explanation": explanation,
            "confidence": self._calculate_confidence(env_spec),
        }

    def _generate_explanation(
        self, env_spec: Dict[str, Any], suggestions: Dict[str, float]
    ) -> str:
        """Generate human-readable explanation"""
        parts = []

        env_type = env_spec.get("envType", "grid")
        parts.append(f"For {env_type} environments:")

        if suggestions["learning_rate"] > 1e-3:
            parts.append("Higher learning rate for faster convergence")
        else:
            parts.append("Lower learning rate for stable training")

        if suggestions["entropy_coef"] > 0.05:
            parts.append("Higher entropy coefficient to encourage exploration")
        else:
            parts.append("Lower entropy coefficient for exploitation")

        return " ".join(parts)

    def _calculate_confidence(self, env_spec: Dict[str, Any]) -> float:
        """Calculate confidence in suggestions (0-1)"""
        # Higher confidence for standard environments
        env_type = env_spec.get("envType", "grid")
        if env_type in ["grid", "continuous2d"]:
            return 0.8
        else:
            return 0.6
