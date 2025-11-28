"""
Hyperparameter Sweep Support
Grid search, random search, and Bayesian optimization
"""

import itertools
import logging
import random
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Try to import optuna for Bayesian optimization
try:
    import optuna

    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    logger.debug("Optuna not available. Install with: pip install optuna")


class HyperparameterSweep:
    """Hyperparameter sweep manager"""

    def __init__(
        self,
        search_type: str = "grid",  # "grid", "random", "bayesian"
        n_trials: int = 10,
        seed: Optional[int] = None,
    ):
        self.search_type = search_type
        self.n_trials = n_trials
        self.seed = seed
        self.trials: List[Dict[str, Any]] = []

    def generate_trials(
        self,
        hyperparameter_space: Dict[str, List[Any]],
    ) -> List[Dict[str, Any]]:
        """Generate hyperparameter trials"""
        if self.search_type == "grid":
            return self._grid_search(hyperparameter_space)
        elif self.search_type == "random":
            return self._random_search(hyperparameter_space)
        elif self.search_type == "bayesian":
            return self._bayesian_search(hyperparameter_space)
        else:
            raise ValueError(f"Unknown search type: {self.search_type}")

    def _grid_search(self, space: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        """Generate all combinations for grid search"""
        keys = list(space.keys())
        values = list(space.values())

        trials = []
        for combination in itertools.product(*values):
            trial = dict(zip(keys, combination))
            trials.append(trial)

        return trials

    def _random_search(self, space: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        """Generate random samples"""
        if self.seed is not None:
            random.seed(self.seed)

        trials = []
        for _ in range(self.n_trials):
            trial = {}
            for key, values in space.items():
                trial[key] = random.choice(values)
            trials.append(trial)

        return trials

    def _bayesian_search(self, space: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        """Generate trials using Bayesian optimization (Optuna)"""
        if not OPTUNA_AVAILABLE:
            logger.warning("Optuna not available. Falling back to random search.")
            return self._random_search(space)

        # Convert space to Optuna format
        def objective(trial):
            trial_params = {}
            for key, values in space.items():
                if isinstance(values[0], (int, float)):
                    if isinstance(values[0], int):
                        trial_params[key] = trial.suggest_int(
                            key, min(values), max(values)
                        )
                    else:
                        trial_params[key] = trial.suggest_float(
                            key, min(values), max(values)
                        )
                else:
                    trial_params[key] = trial.suggest_categorical(key, values)

            # Store trial params
            self.trials.append(trial_params)
            return 0.0  # Placeholder - actual objective computed during training

        study = optuna.create_study(
            direction="maximize", sampler=optuna.samplers.TPESampler(seed=self.seed)
        )
        study.optimize(objective, n_trials=self.n_trials, show_progress_bar=False)

        return self.trials


def create_sweep_config(
    algorithm: str,
    base_config: Dict[str, Any],
    search_space: Dict[str, List[Any]],
    search_type: str = "grid",
    n_trials: int = 10,
) -> Dict[str, Any]:
    """
    Create a hyperparameter sweep configuration

    Example:
        sweep_config = create_sweep_config(
            algorithm="PPO",
            base_config={"total_timesteps": 100000},
            search_space={
                "learning_rate": [1e-4, 3e-4, 1e-3],
                "gamma": [0.95, 0.99, 0.999],
                "batch_size": [32, 64, 128],
            },
            search_type="grid",
        )
    """
    return {
        "algorithm": algorithm,
        "base_config": base_config,
        "search_space": search_space,
        "search_type": search_type,
        "n_trials": n_trials,
    }
