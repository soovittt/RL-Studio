"""
Advanced RL Diagnostics
TD-error, value function, policy entropy, KL divergence, etc.
"""

from typing import Any, Dict, List

import numpy as np


class RLDiagnostics:
    """Advanced RL diagnostics for research-level analysis"""

    def __init__(self):
        self.td_errors: List[float] = []
        self.value_estimates: List[float] = []
        self.policy_entropy_history: List[float] = []
        self.kl_divergences: List[float] = []
        self.gradient_norms: List[float] = []

    def compute_td_error(
        self,
        reward: float,
        value_current: float,
        value_next: float,
        gamma: float = 0.99,
        done: bool = False,
    ) -> float:
        """Compute TD-error (temporal difference error)"""
        if done:
            target = reward
        else:
            target = reward + gamma * value_next

        td_error = target - value_current
        self.td_errors.append(td_error)
        return td_error

    def compute_value_function_heatmap(
        self,
        state_positions: List[List[float]],
        value_estimates: List[float],
        world_width: float,
        world_height: float,
        grid_size: int = 20,
    ) -> Dict[str, Any]:
        """Create value function heatmap"""
        # Discretize space into grid
        heatmap = np.zeros((grid_size, grid_size))
        counts = np.zeros((grid_size, grid_size))

        for pos, value in zip(state_positions, value_estimates):
            # Map position to grid cell
            x_idx = int((pos[0] / world_width) * grid_size)
            y_idx = int((pos[1] / world_height) * grid_size)
            x_idx = max(0, min(grid_size - 1, x_idx))
            y_idx = max(0, min(grid_size - 1, y_idx))

            heatmap[y_idx, x_idx] += value
            counts[y_idx, x_idx] += 1

        # Average values per cell
        with np.errstate(divide="ignore", invalid="ignore"):
            heatmap = np.divide(
                heatmap, counts, out=np.zeros_like(heatmap), where=counts != 0
            )

        return {
            "heatmap": heatmap.tolist(),
            "min_value": float(np.min(heatmap[counts > 0]))
            if np.any(counts > 0)
            else 0,
            "max_value": float(np.max(heatmap[counts > 0]))
            if np.any(counts > 0)
            else 0,
            "grid_size": grid_size,
        }

    def compute_policy_entropy(self, action_probs: Dict[str, float]) -> float:
        """Compute policy entropy from action probabilities"""
        probs = list(action_probs.values())
        if not probs or sum(probs) == 0:
            return 0.0

        # Normalize
        total = sum(probs)
        probs = [p / total for p in probs]

        entropy = -sum(p * np.log(p + 1e-10) for p in probs)
        self.policy_entropy_history.append(entropy)
        return entropy

    def compute_kl_divergence(
        self, old_probs: Dict[str, float], new_probs: Dict[str, float]
    ) -> float:
        """Compute KL divergence between old and new policy"""
        # Get common actions
        actions = set(old_probs.keys()) | set(new_probs.keys())

        kl = 0.0
        for action in actions:
            old_p = old_probs.get(action, 1e-10)
            new_p = new_probs.get(action, 1e-10)
            kl += old_p * np.log((old_p + 1e-10) / (new_p + 1e-10))

        self.kl_divergences.append(kl)
        return kl

    def record_gradient_norm(self, norm: float):
        """Record gradient norm (for PPO training)"""
        self.gradient_norms.append(norm)

    def get_diagnostics_summary(self) -> Dict[str, Any]:
        """Get comprehensive diagnostics summary"""
        return {
            "td_error": {
                "mean": np.mean(self.td_errors) if self.td_errors else 0,
                "std": np.std(self.td_errors) if self.td_errors else 0,
                "min": np.min(self.td_errors) if self.td_errors else 0,
                "max": np.max(self.td_errors) if self.td_errors else 0,
            },
            "policy_entropy": {
                "mean": np.mean(self.policy_entropy_history)
                if self.policy_entropy_history
                else 0,
                "std": np.std(self.policy_entropy_history)
                if self.policy_entropy_history
                else 0,
                "trend": "increasing"
                if len(self.policy_entropy_history) > 1
                and self.policy_entropy_history[-1] > self.policy_entropy_history[0]
                else "decreasing",
            },
            "kl_divergence": {
                "mean": np.mean(self.kl_divergences) if self.kl_divergences else 0,
                "std": np.std(self.kl_divergences) if self.kl_divergences else 0,
                "max": np.max(self.kl_divergences) if self.kl_divergences else 0,
            },
            "gradient_norm": {
                "mean": np.mean(self.gradient_norms) if self.gradient_norms else 0,
                "std": np.std(self.gradient_norms) if self.gradient_norms else 0,
                "max": np.max(self.gradient_norms) if self.gradient_norms else 0,
            },
        }
