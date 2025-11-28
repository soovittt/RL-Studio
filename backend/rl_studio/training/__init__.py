"""
RL Training Module
Leverages Stable-Baselines3 and PyTorch for professional RL training
"""

# Lazy imports to avoid loading heavy ML libraries at startup
# This allows the server to start quickly, then load dependencies when needed


def _lazy_import_trainer():
    """Lazy import of trainer (loads torch, stable-baselines3)"""
    from .trainer import RLTrainer, TrainingConfig

    return RLTrainer, TrainingConfig


def _lazy_import_suggester():
    """Lazy import of hyperparameter suggester"""
    from .hyperparameter_suggestions import HyperparameterSuggester

    return HyperparameterSuggester


def _lazy_import_curriculum():
    """Lazy import of curriculum learning"""
    from .curriculum import CurriculumLearningEngine

    return CurriculumLearningEngine


def _lazy_import_algorithms():
    """Lazy import of algorithm registry"""
    from .algorithms import AlgorithmRegistry

    return AlgorithmRegistry


# Import experiment tracking (lightweight)
from .experiment_tracking import ExperimentTracker, create_tracker

# Always import orchestrator (lightweight, no heavy deps)
from .orchestrator import get_job_logs, get_job_status, launch_training_job, stop_job


# Lazy getters for heavy imports
def get_RLTrainer():
    RLTrainer, _ = _lazy_import_trainer()
    return RLTrainer


def get_TrainingConfig():
    _, TrainingConfig = _lazy_import_trainer()
    return TrainingConfig


def get_HyperparameterSuggester():
    return _lazy_import_suggester()


def get_CurriculumLearningEngine():
    return _lazy_import_curriculum()


def get_AlgorithmRegistry():
    return _lazy_import_algorithms()


__all__ = [
    "get_RLTrainer",
    "get_TrainingConfig",
    "get_HyperparameterSuggester",
    "get_CurriculumLearningEngine",
    "get_AlgorithmRegistry",
    "launch_training_job",
    "get_job_status",
    "stop_job",
    "ExperimentTracker",
    "create_tracker",
]
