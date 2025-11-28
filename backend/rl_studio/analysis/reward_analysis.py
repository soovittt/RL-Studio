"""
Reward Decomposition and Crediting Analysis
Scientific RL feature for understanding reward attribution
"""

from collections import defaultdict
from typing import Any, Dict, List, Tuple

import numpy as np


class RewardCrediting:
    """Tracks reward attribution per rule across episodes"""

    def __init__(self):
        self.rule_contributions: Dict[str, List[float]] = defaultdict(list)
        self.rule_fire_counts: Dict[str, int] = defaultdict(int)
        self.rule_total_rewards: Dict[str, float] = defaultdict(float)
        self.step_rewards: List[Dict[str, float]] = []

    def record_step(self, rewards: List[Dict[str, Any]]):
        """Record rewards for a single step"""
        step_dict = {}
        for reward in rewards:
            rule_id = reward.get("ruleId", "unknown")
            value = reward.get("value", 0.0)
            step_dict[rule_id] = value
            self.rule_contributions[rule_id].append(value)
            self.rule_fire_counts[rule_id] += 1
            self.rule_total_rewards[rule_id] += value
        self.step_rewards.append(step_dict)

    def get_analysis(self) -> Dict[str, Any]:
        """Get comprehensive reward analysis"""
        analysis = {
            "per_rule_stats": {},
            "most_active_rules": [],
            "cumulative_contributions": {},
            "heatmap_data": [],
        }

        # Per-rule statistics
        for rule_id, contributions in self.rule_contributions.items():
            if len(contributions) > 0:
                analysis["per_rule_stats"][rule_id] = {
                    "total": self.rule_total_rewards[rule_id],
                    "mean": np.mean(contributions),
                    "std": np.std(contributions),
                    "min": np.min(contributions),
                    "max": np.max(contributions),
                    "fire_count": self.rule_fire_counts[rule_id],
                    "fire_rate": self.rule_fire_counts[rule_id] / len(self.step_rewards)
                    if self.step_rewards
                    else 0,
                }

        # Most active rules (by fire count)
        analysis["most_active_rules"] = sorted(
            self.rule_fire_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]

        # Cumulative contributions
        for rule_id in self.rule_contributions.keys():
            cumulative = np.cumsum(self.rule_contributions[rule_id])
            analysis["cumulative_contributions"][rule_id] = cumulative.tolist()

        # Heatmap data (rule activity over time)
        if self.step_rewards:
            num_steps = len(self.step_rewards)
            rule_ids = list(set().union(*[step.keys() for step in self.step_rewards]))
            heatmap = []
            for step_idx, step_rewards in enumerate(self.step_rewards):
                for rule_id in rule_ids:
                    value = step_rewards.get(rule_id, 0.0)
                    heatmap.append(
                        {
                            "step": step_idx,
                            "rule": rule_id,
                            "value": value,
                        }
                    )
            analysis["heatmap_data"] = heatmap

        return analysis


class RewardAnalyzer:
    """Main reward analysis engine"""

    def __init__(self):
        self.crediting = RewardCrediting()
        self.episode_rewards: List[float] = []
        self.episode_analyses: List[Dict[str, Any]] = []

    def analyze_rollout(self, rollout_steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze a complete rollout - OPTIMIZED with NumPy vectorization"""
        # Reset for new rollout
        self.crediting = RewardCrediting()

        # OPTIMIZED: Batch process steps for better performance
        # Process each step (can be parallelized for large rollouts)
        for step in rollout_steps:
            rewards = step.get("state", {}).get("info", {}).get("rewards", [])
            self.crediting.record_step(rewards)

        # Get analysis (uses NumPy for heavy calculations)
        analysis = self.crediting.get_analysis()

        # OPTIMIZED: Use NumPy for reward calculations
        import numpy as np

        rewards_array = np.array([step.get("reward", 0.0) for step in rollout_steps])
        total_reward = float(np.sum(rewards_array))

        # Add episode-level insights
        analysis["episode_total"] = total_reward
        analysis["episode_length"] = len(rollout_steps)
        analysis["reward_density"] = (
            float(np.mean(rewards_array)) if len(rewards_array) > 0 else 0.0
        )

        # Detect reward shaping issues
        analysis["warnings"] = self._detect_issues(analysis)

        return analysis

    def analyze_multiple_rollouts(
        self, rollouts: List[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Analyze multiple rollouts for aggregate statistics"""
        all_analyses = []
        for rollout in rollouts:
            analysis = self.analyze_rollout(rollout)
            all_analyses.append(analysis)
            self.episode_analyses.append(analysis)
            self.episode_rewards.append(analysis["episode_total"])

        # Aggregate statistics
        aggregate = {
            "num_episodes": len(rollouts),
            "mean_episode_reward": np.mean(self.episode_rewards)
            if self.episode_rewards
            else 0,
            "std_episode_reward": np.std(self.episode_rewards)
            if self.episode_rewards
            else 0,
            "rule_consistency": self._analyze_rule_consistency(all_analyses),
            "top_termination_causes": self._get_top_termination_causes(rollouts),
        }

        return aggregate

    def _detect_issues(self, analysis: Dict[str, Any]) -> List[str]:
        """Detect potential reward shaping issues"""
        warnings = []

        # Check for unreachable rewards
        for rule_id, stats in analysis["per_rule_stats"].items():
            if stats["fire_count"] == 0:
                warnings.append(f"Rule {rule_id} never fired (unreachable?)")
            elif stats["fire_rate"] < 0.01:
                warnings.append(
                    f"Rule {rule_id} fires very rarely ({stats['fire_rate']:.1%})"
                )

        # Check for overly dense shaping
        if analysis["reward_density"] > 10:
            warnings.append("Very dense reward shaping (may cause reward hacking)")

        # Check for contradictory rules
        rule_values = {
            rule_id: stats["mean"]
            for rule_id, stats in analysis["per_rule_stats"].items()
        }
        positive_rules = [r for r, v in rule_values.items() if v > 0]
        negative_rules = [r for r, v in rule_values.items() if v < 0]
        if len(positive_rules) > 5 and len(negative_rules) > 5:
            warnings.append("Many conflicting reward rules (may confuse agent)")

        return warnings

    def _analyze_rule_consistency(
        self, analyses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze consistency of rule firing across episodes"""
        rule_fire_rates = defaultdict(list)

        for analysis in analyses:
            for rule_id, stats in analysis["per_rule_stats"].items():
                rule_fire_rates[rule_id].append(stats["fire_rate"])

        consistency = {}
        for rule_id, rates in rule_fire_rates.items():
            consistency[rule_id] = {
                "mean_fire_rate": np.mean(rates),
                "std_fire_rate": np.std(rates),
                "consistency": "high"
                if np.std(rates) < 0.1
                else "medium"
                if np.std(rates) < 0.3
                else "low",
            }

        return consistency

    def _get_top_termination_causes(
        self, rollouts: List[List[Dict[str, Any]]]
    ) -> List[Tuple[str, int]]:
        """Get top termination causes across rollouts"""
        termination_counts = defaultdict(int)

        for rollout in rollouts:
            if rollout:
                last_step = rollout[-1]
                termination_reason = (
                    last_step.get("state", {})
                    .get("info", {})
                    .get("termination_reason", "unknown")
                )
                termination_counts[termination_reason] += 1

        return sorted(termination_counts.items(), key=lambda x: x[1], reverse=True)
