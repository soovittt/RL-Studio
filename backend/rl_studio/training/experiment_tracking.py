"""
Experiment Tracking for Research
Supports Weights & Biases, MLflow, and local logging
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# Try to import optional dependencies
try:
    import wandb
    WANDB_AVAILABLE = True
except ImportError:
    WANDB_AVAILABLE = False
    logger.debug("Weights & Biases not available. Install with: pip install wandb")

try:
    import mlflow
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    logger.debug("MLflow not available. Install with: pip install mlflow")


class ExperimentTracker:
    """Unified experiment tracking interface"""
    
    def __init__(
        self,
        experiment_name: str,
        project_name: Optional[str] = None,
        tracking_backend: str = "local",  # "local", "wandb", "mlflow"
        run_id: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        wandb_api_key: Optional[str] = None,  # Allow passing API key directly
        mlflow_tracking_uri: Optional[str] = None,  # Allow passing MLflow URI
    ):
        self.experiment_name = experiment_name
        self.project_name = project_name or "rl-studio"
        self.tracking_backend = tracking_backend
        self.run_id = run_id
        self.config = config or {}
        self.tags = tags or []
        self.wandb_api_key = wandb_api_key
        self.mlflow_tracking_uri = mlflow_tracking_uri
        
        # Initialize tracking backend
        self.wandb_run = None
        self.mlflow_run = None
        self.local_log_dir = None
        
        self._initialize_tracking()
    
    def _initialize_tracking(self):
        """Initialize the selected tracking backend"""
        if self.tracking_backend == "wandb" and WANDB_AVAILABLE:
            self._init_wandb()
        elif self.tracking_backend == "mlflow" and MLFLOW_AVAILABLE:
            self._init_mlflow()
        else:
            self._init_local()
    
    def _init_wandb(self):
        """Initialize Weights & Biases"""
        try:
            # Set API key if provided
            if self.wandb_api_key:
                os.environ["WANDB_API_KEY"] = self.wandb_api_key
                # Login with the provided key
                wandb.login(key=self.wandb_api_key, relogin=True)
            
            self.wandb_run = wandb.init(
                project=self.project_name,
                name=self.experiment_name,
                id=self.run_id,
                config=self.config,
                tags=self.tags,
                reinit=True,
            )
            logger.info(f"✅ Initialized Weights & Biases: {self.wandb_run.url}")
        except Exception as e:
            logger.warning(f"Failed to initialize W&B: {e}. Falling back to local tracking.")
            self._init_local()
    
    def _init_mlflow(self):
        """Initialize MLflow"""
        try:
            # Set tracking URI if provided
            if self.mlflow_tracking_uri:
                mlflow.set_tracking_uri(self.mlflow_tracking_uri)
            
            mlflow.set_experiment(self.project_name)
            self.mlflow_run = mlflow.start_run(run_name=self.experiment_name, run_id=self.run_id)
            mlflow.log_params(self.config)
            if self.tags:
                mlflow.set_tags({f"tag_{i}": tag for i, tag in enumerate(self.tags)})
            logger.info(f"✅ Initialized MLflow: {self.mlflow_run.info.run_id}")
        except Exception as e:
            logger.warning(f"Failed to initialize MLflow: {e}. Falling back to local tracking.")
            self._init_local()
    
    def _init_local(self):
        """Initialize local file-based tracking"""
        log_dir = Path("experiments") / self.project_name / self.experiment_name
        if self.run_id:
            log_dir = log_dir / self.run_id
        log_dir.mkdir(parents=True, exist_ok=True)
        self.local_log_dir = log_dir
        
        # Save config
        config_path = log_dir / "config.json"
        with open(config_path, "w") as f:
            json.dump(self.config, f, indent=2)
        
        logger.info(f"✅ Initialized local tracking: {self.local_log_dir}")
    
    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        """Log metrics to tracking backend"""
        if self.wandb_run:
            self.wandb_run.log(metrics, step=step)
        elif self.mlflow_run:
            mlflow.log_metrics(metrics, step=step)
        else:
            # Local logging
            metrics_file = self.local_log_dir / "metrics.jsonl"
            with open(metrics_file, "a") as f:
                log_entry = {"step": step, "timestamp": datetime.now().isoformat(), **metrics}
                f.write(json.dumps(log_entry) + "\n")
    
    def log_params(self, params: Dict[str, Any]):
        """Log hyperparameters"""
        if self.wandb_run:
            self.wandb_run.config.update(params)
        elif self.mlflow_run:
            mlflow.log_params(params)
        else:
            # Update local config
            config_path = self.local_log_dir / "config.json"
            if config_path.exists():
                with open(config_path, "r") as f:
                    config = json.load(f)
                config.update(params)
                with open(config_path, "w") as f:
                    json.dump(config, f, indent=2)
    
    def log_artifact(self, file_path: str, artifact_name: Optional[str] = None):
        """Log file artifact"""
        if self.wandb_run:
            self.wandb_run.log_artifact(file_path, name=artifact_name)
        elif self.mlflow_run:
            mlflow.log_artifact(file_path, artifact_path=artifact_name)
        else:
            # Copy to local artifacts directory
            artifacts_dir = self.local_log_dir / "artifacts"
            artifacts_dir.mkdir(exist_ok=True)
            import shutil
            dest_path = artifacts_dir / (artifact_name or Path(file_path).name)
            shutil.copy2(file_path, dest_path)
    
    def log_model(self, model_path: str, model_name: str = "model"):
        """Log trained model"""
        if self.wandb_run:
            self.wandb_run.log_model(model_name, model_path)
        elif self.mlflow_run:
            mlflow.pytorch.log_model(model_path, artifact_path=model_name)
        else:
            # Copy to local models directory
            models_dir = self.local_log_dir / "models"
            models_dir.mkdir(exist_ok=True)
            import shutil
            dest_path = models_dir / f"{model_name}.zip"
            import zipfile
            with zipfile.ZipFile(dest_path, "w") as zf:
                for root, dirs, files in os.walk(model_path):
                    for file in files:
                        zf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), model_path))
    
    def finish(self):
        """Finish the experiment run"""
        if self.wandb_run:
            self.wandb_run.finish()
        elif self.mlflow_run:
            mlflow.end_run()
        else:
            # Mark as completed
            status_file = self.local_log_dir / "status.json"
            with open(status_file, "w") as f:
                json.dump({
                    "status": "completed",
                    "finished_at": datetime.now().isoformat(),
                }, f, indent=2)
    
    def get_run_url(self) -> Optional[str]:
        """Get URL to view the run"""
        if self.wandb_run:
            return self.wandb_run.url
        elif self.mlflow_run:
            return mlflow.get_tracking_uri()
        else:
            return str(self.local_log_dir.absolute())


def create_tracker(
    experiment_name: str,
    backend: Optional[str] = None,
    **kwargs
) -> ExperimentTracker:
    """
    Create an experiment tracker with automatic backend selection
    
    Args:
        experiment_name: Name of the experiment
        backend: "wandb", "mlflow", or "local" (auto-selects if None)
        **kwargs: Additional arguments for ExperimentTracker
    """
    # Auto-select backend if not specified
    if backend is None:
        if WANDB_AVAILABLE and os.getenv("WANDB_API_KEY"):
            backend = "wandb"
        elif MLFLOW_AVAILABLE:
            backend = "mlflow"
        else:
            backend = "local"
    
    return ExperimentTracker(
        experiment_name=experiment_name,
        tracking_backend=backend,
        **kwargs
    )

