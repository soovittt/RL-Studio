"""
Research Analysis Tools
Statistical testing, multi-run comparison, significance testing
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


class StatisticalAnalysis:
    """Statistical analysis for RL experiments"""

    @staticmethod
    def compare_runs(
        run_results: List[Dict[str, Any]],
        metric: str = "mean_reward",
        alpha: float = 0.05,
    ) -> Dict[str, Any]:
        """
        Compare multiple runs with statistical tests

        Args:
            run_results: List of evaluation results from different runs
            metric: Metric to compare (e.g., "mean_reward", "success_rate")
            alpha: Significance level

        Returns:
            Comparison results with statistical tests
        """
        if len(run_results) < 2:
            raise ValueError("Need at least 2 runs to compare")

        # Extract metric values
        values = []
        run_names = []
        for i, result in enumerate(run_results):
            if metric in result:
                values.append(result[metric])
                run_names.append(result.get("run_id", f"run_{i}"))
            elif "episode_rewards" in result:
                # Use episode rewards if available
                values.append(np.mean(result["episode_rewards"]))
                run_names.append(result.get("run_id", f"run_{i}"))

        if len(values) < 2:
            raise ValueError(f"Metric '{metric}' not found in results")

        values = np.array(values)

        # Basic statistics
        comparison = {
            "metric": metric,
            "n_runs": len(values),
            "run_names": run_names,
            "means": {name: float(val) for name, val in zip(run_names, values)},
            "overall_mean": float(np.mean(values)),
            "overall_std": float(np.std(values)),
            "best_run": run_names[np.argmax(values)],
            "worst_run": run_names[np.argmin(values)],
        }

        # Statistical tests
        if len(values) == 2:
            # Two-sample t-test
            t_stat, p_value = stats.ttest_ind([values[0]], [values[1]])
            comparison["statistical_test"] = {
                "test": "t-test",
                "t_statistic": float(t_stat),
                "p_value": float(p_value),
                "significant": p_value < alpha,
            }
        else:
            # ANOVA for multiple groups
            # For simplicity, use Kruskal-Wallis (non-parametric)
            h_stat, p_value = stats.kruskal(*[[v] for v in values])
            comparison["statistical_test"] = {
                "test": "kruskal-wallis",
                "h_statistic": float(h_stat),
                "p_value": float(p_value),
                "significant": p_value < alpha,
            }

        return comparison

    @staticmethod
    def confidence_interval(
        values: List[float],
        confidence: float = 0.95,
    ) -> Dict[str, float]:
        """Calculate confidence interval"""
        values = np.array(values)
        n = len(values)
        mean = np.mean(values)
        std = np.std(values, ddof=1)  # Sample standard deviation

        # t-distribution for small samples, normal for large
        if n < 30:
            from scipy.stats import t

            t_critical = t.ppf((1 + confidence) / 2, n - 1)
            margin = t_critical * std / np.sqrt(n)
        else:
            from scipy.stats import norm

            z_critical = norm.ppf((1 + confidence) / 2)
            margin = z_critical * std / np.sqrt(n)

        return {
            "mean": float(mean),
            "std": float(std),
            "n": n,
            "confidence": confidence,
            "lower": float(mean - margin),
            "upper": float(mean + margin),
            "margin": float(margin),
        }

    @staticmethod
    def effect_size(
        group1: List[float],
        group2: List[float],
    ) -> Dict[str, float]:
        """Calculate Cohen's d effect size"""
        g1 = np.array(group1)
        g2 = np.array(group2)

        mean1, mean2 = np.mean(g1), np.mean(g2)
        std1, std2 = np.std(g1, ddof=1), np.std(g2, ddof=1)
        n1, n2 = len(g1), len(g2)

        # Pooled standard deviation
        pooled_std = np.sqrt(((n1 - 1) * std1**2 + (n2 - 1) * std2**2) / (n1 + n2 - 2))

        # Cohen's d
        cohens_d = (mean1 - mean2) / pooled_std if pooled_std > 0 else 0.0

        # Effect size interpretation
        if abs(cohens_d) < 0.2:
            interpretation = "negligible"
        elif abs(cohens_d) < 0.5:
            interpretation = "small"
        elif abs(cohens_d) < 0.8:
            interpretation = "medium"
        else:
            interpretation = "large"

        return {
            "cohens_d": float(cohens_d),
            "interpretation": interpretation,
            "mean_diff": float(mean1 - mean2),
        }


class MultiRunAnalyzer:
    """Analyze and compare multiple training runs"""

    def __init__(self):
        self.runs: List[Dict[str, Any]] = []

    def add_run(
        self,
        run_id: str,
        evaluation_results: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
    ):
        """Add a run's results"""
        self.runs.append(
            {
                "run_id": run_id,
                "results": evaluation_results,
                "config": config or {},
            }
        )

    def compare_all(self, metric: str = "mean_reward") -> Dict[str, Any]:
        """Compare all runs"""
        run_results = [{"run_id": run["run_id"], **run["results"]} for run in self.runs]
        return StatisticalAnalysis.compare_runs(run_results, metric=metric)

    def get_best_run(self, metric: str = "mean_reward") -> Dict[str, Any]:
        """Get the best performing run"""
        best_run = None
        best_value = float("-inf")

        for run in self.runs:
            value = run["results"].get(metric, float("-inf"))
            if value > best_value:
                best_value = value
                best_run = run

        return best_run or {}

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive comparison report"""
        if not self.runs:
            return {"error": "No runs to analyze"}

        report = {
            "n_runs": len(self.runs),
            "runs": [],
            "comparisons": {},
        }

        # Individual run summaries
        for run in self.runs:
            report["runs"].append(
                {
                    "run_id": run["run_id"],
                    "mean_reward": run["results"].get("mean_reward", 0),
                    "success_rate": run["results"].get("success_rate", 0),
                    "config": run["config"],
                }
            )

        # Statistical comparisons
        for metric in ["mean_reward", "success_rate"]:
            try:
                run_results = [
                    {"run_id": run["run_id"], **run["results"]} for run in self.runs
                ]
                report["comparisons"][metric] = StatisticalAnalysis.compare_runs(
                    run_results, metric=metric
                )
            except Exception as e:
                logger.warning(f"Could not compare {metric}: {e}")

        return report
