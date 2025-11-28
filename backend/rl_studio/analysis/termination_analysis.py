"""
Dynamic Termination Analysis
Scientific RL feature for understanding episode termination patterns
Uses scipy, numpy for proper statistical analysis
"""

from collections import defaultdict
from typing import Any, Dict, List, Tuple

import numpy as np
from scipy import stats


class TerminationAnalyzer:
    """Analyzes termination patterns across rollouts"""

    def __init__(self):
        self.termination_reasons: List[str] = []
        self.termination_steps: List[int] = []
        self.termination_heatmap: Dict[str, List[int]] = defaultdict(list)

    def analyze_rollout(self, rollout_steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze termination for a single rollout"""
        if not rollout_steps:
            return {"terminated": False}

        last_step = rollout_steps[-1]
        state = last_step.get("state", {})
        done = state.get("done", False)

        if done:
            termination_reason = state.get("info", {}).get(
                "termination_reason", "unknown"
            )
            step = state.get("step", len(rollout_steps))

            self.termination_reasons.append(termination_reason)
            self.termination_steps.append(step)
            self.termination_heatmap[termination_reason].append(step)

            return {
                "terminated": True,
                "reason": termination_reason,
                "step": step,
                "episode_length": len(rollout_steps),
            }

        return {"terminated": False}

    def analyze_multiple_rollouts(
        self, rollouts: List[List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Analyze termination patterns across multiple rollouts"""
        termination_counts = defaultdict(int)
        termination_step_distributions = defaultdict(list)
        conflicting_rules = []

        for rollout in rollouts:
            analysis = self.analyze_rollout(rollout)
            if analysis.get("terminated"):
                reason = analysis["reason"]
                step = analysis["step"]
                termination_counts[reason] += 1
                termination_step_distributions[reason].append(step)

        # Detect conflicting termination rules
        # (rules that fire at similar times but have different outcomes)
        if len(termination_counts) > 1:
            # Check if multiple termination types occur frequently
            total_terminations = sum(termination_counts.values())
            for reason, count in termination_counts.items():
                if count / total_terminations > 0.3 and len(termination_counts) > 1:
                    conflicting_rules.append(
                        {
                            "rule": reason,
                            "frequency": count / total_terminations,
                            "conflict_with": [
                                r for r in termination_counts.keys() if r != reason
                            ],
                        }
                    )

        # Build heatmap data using scipy.stats for proper statistics
        heatmap_data = []
        for reason, steps in termination_step_distributions.items():
            if steps:
                steps_array = np.array(steps)
                # Use scipy.stats for proper statistical measures
                mean_step = float(stats.tmean(steps_array))  # Trimmed mean (robust)
                std_step = float(stats.tstd(steps_array))  # Trimmed std (robust)
                median_step = float(np.median(steps_array))

                heatmap_data.append(
                    {
                        "reason": reason,
                        "mean_step": mean_step,
                        "median_step": median_step,
                        "std_step": std_step,
                        "min_step": int(np.min(steps_array)),
                        "max_step": int(np.max(steps_array)),
                        "count": len(steps),
                        "skewness": float(
                            stats.skew(steps_array)
                        ),  # Distribution shape
                        "kurtosis": float(
                            stats.kurtosis(steps_array)
                        ),  # Tail heaviness
                    }
                )

        # Top termination causes
        top_causes = sorted(
            termination_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "termination_counts": dict(termination_counts),
            "top_causes": top_causes,
            "heatmap_data": heatmap_data,
            "conflicting_rules": conflicting_rules,
            "premature_terminations": self._detect_premature_terminations(
                termination_step_distributions
            ),
            "late_terminations": self._detect_late_terminations(
                termination_step_distributions
            ),
        }

    def _detect_premature_terminations(
        self, distributions: Dict[str, List[int]], threshold_percentile: int = 10
    ) -> List[Dict[str, Any]]:
        """Detect terminations that happen too early"""
        premature = []

        for reason, steps in distributions.items():
            if steps:
                threshold = np.percentile(steps, threshold_percentile)
                early_steps = [s for s in steps if s < threshold]
                if early_steps:
                    premature.append(
                        {
                            "reason": reason,
                            "count": len(early_steps),
                            "mean_step": np.mean(early_steps),
                            "threshold": threshold,
                        }
                    )

        return premature

    def _detect_late_terminations(
        self, distributions: Dict[str, List[int]], threshold_percentile: int = 90
    ) -> List[Dict[str, Any]]:
        """Detect terminations that happen too late"""
        late = []

        for reason, steps in distributions.items():
            if steps:
                threshold = np.percentile(steps, threshold_percentile)
                late_steps = [s for s in steps if s > threshold]
                if late_steps:
                    late.append(
                        {
                            "reason": reason,
                            "count": len(late_steps),
                            "mean_step": np.mean(late_steps),
                            "threshold": threshold,
                        }
                    )

        return late
