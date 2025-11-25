"""
Research GraphQL resolvers - Hyperparameter sweeps, statistical analysis, model versioning
"""

import strawberry
import json
from typing import List, Optional
from ..types.research import (
    HyperparameterSweepResult, HyperparameterSweepInput, HyperparameterTrial,
    CompareRunsResult, CompareRunsInput, StatisticalComparison,
    ConfidenceIntervalResult, ConfidenceIntervalInput, ConfidenceInterval,
    EffectSizeResult, EffectSizeInput, EffectSize,
    Checkpoint, ModelVersion, CreateVersionInput, CreateVersionResult,
    WandbRun, WandbRunDetails, TestWandbConnectionInput, TestWandbConnectionResult,
    TestMlflowConnectionInput, TestMlflowConnectionResult,
)


@strawberry.type
class ResearchResolver:
    """Research queries and mutations"""
    
    @strawberry.mutation
    async def generate_hyperparameter_sweep(self, input: HyperparameterSweepInput) -> HyperparameterSweepResult:
        """Generate hyperparameter sweep trials"""
        try:
            from ....api.training import generate_hyperparameter_sweep
            from ....api.models import HyperparameterSweepRequest
            
            # Parse JSON strings
            env_spec = json.loads(input.env_spec)
            base_config = json.loads(input.base_config)
            search_space = json.loads(input.search_space)
            
            # Create request object
            request = HyperparameterSweepRequest(
                algorithm=input.algorithm,
                env_spec=env_spec,
                base_config=base_config,
                search_space=search_space,
                search_type=input.search_type,
                n_trials=input.n_trials,
                seed=input.seed,
            )
            
            # Call REST API function
            result = await generate_hyperparameter_sweep(request)
            
            # Convert trials to GraphQL types
            trials = []
            for i, trial in enumerate(result.get("trials", [])):
                trials.append(HyperparameterTrial(
                    trial_number=i + 1,
                    hyperparameters=json.dumps(trial),
                    expected_reward=trial.get("expected_reward"),
                ))
            
            return HyperparameterSweepResult(
                success=result.get("success", True),
                n_trials=result.get("n_trials", len(trials)),
                trials=trials,
                error=result.get("error"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error generating hyperparameter sweep: {e}", exc_info=True)
            return HyperparameterSweepResult(
                success=False,
                n_trials=0,
                trials=[],
                error=str(e),
            )
    
    @strawberry.mutation
    async def compare_runs(self, input: CompareRunsInput) -> CompareRunsResult:
        """Compare multiple training runs with statistical analysis"""
        try:
            from ....api.training import compare_runs
            from ....api.models import CompareRunsRequest
            
            # Parse JSON string
            run_results = json.loads(input.run_results)
            
            # Create request object
            request = CompareRunsRequest(
                run_results=run_results,
                metric=input.metric,
                alpha=input.alpha,
            )
            
            # Call REST API function
            result = await compare_runs(request)
            
            comparison_data = result.get("comparison", {})
            
            return CompareRunsResult(
                success=result.get("success", True),
                comparison=StatisticalComparison(
                    metric=comparison_data.get("metric", ""),
                    n_runs=comparison_data.get("n_runs", 0),
                    run_names=comparison_data.get("run_names", []),
                    means=json.dumps(comparison_data.get("means", {})),
                    overall_mean=comparison_data.get("overall_mean", 0.0),
                    overall_std=comparison_data.get("overall_std", 0.0),
                    best_run=comparison_data.get("best_run", ""),
                    worst_run=comparison_data.get("worst_run", ""),
                    statistical_test=json.dumps(comparison_data.get("statistical_test", {})),
                ),
                error=result.get("error"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error comparing runs: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def calculate_confidence_interval(self, input: ConfidenceIntervalInput) -> ConfidenceIntervalResult:
        """Calculate confidence interval for a set of values"""
        try:
            from ....api.training import calculate_confidence_interval
            
            # Call REST API function
            result = await calculate_confidence_interval(input.values, input.confidence)
            
            ci_data = result.get("confidence_interval", {})
            
            return ConfidenceIntervalResult(
                success=result.get("success", True),
                confidence_interval=ConfidenceInterval(
                    mean=ci_data.get("mean", 0.0),
                    std=ci_data.get("std", 0.0),
                    n=ci_data.get("n", 0),
                    confidence=ci_data.get("confidence", 0.95),
                    lower=ci_data.get("lower", 0.0),
                    upper=ci_data.get("upper", 0.0),
                    margin=ci_data.get("margin", 0.0),
                ),
                error=result.get("error"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error calculating confidence interval: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def calculate_effect_size(self, input: EffectSizeInput) -> EffectSizeResult:
        """Calculate effect size (Cohen's d) between two groups"""
        try:
            from ....api.training import calculate_effect_size
            
            # Call REST API function
            result = await calculate_effect_size(input.group1, input.group2)
            
            effect_data = result.get("effect_size", {})
            
            return EffectSizeResult(
                success=result.get("success", True),
                effect_size=EffectSize(
                    cohens_d=effect_data.get("cohens_d", 0.0),
                    interpretation=effect_data.get("interpretation", ""),
                    mean_diff=effect_data.get("mean_diff", 0.0),
                ),
                error=result.get("error"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error calculating effect size: {e}", exc_info=True)
            raise
    
    @strawberry.field
    async def list_checkpoints(self, run_id: str) -> List[Checkpoint]:
        """List all checkpoints for a run"""
        try:
            from ....api.training import list_model_checkpoints
            
            # Call REST API function
            result = await list_model_checkpoints(run_id)
            
            checkpoints = []
            for cp in result.get("checkpoints", []):
                checkpoints.append(Checkpoint(
                    checkpoint_name=cp.get("checkpoint_name", ""),
                    path=cp.get("path", ""),
                    run_id=cp.get("run_id", run_id),
                    created_at=cp.get("created_at", ""),
                    model_path=cp.get("model_path"),
                    metadata=json.dumps(cp.get("metadata", {})) if cp.get("metadata") else None,
                ))
            
            return checkpoints
        except Exception as e:
            import logging
            logging.error(f"Error listing checkpoints: {e}", exc_info=True)
            return []
    
    @strawberry.field
    async def list_model_versions(self, run_id: str) -> List[ModelVersion]:
        """List all versions for a run"""
        try:
            from ....api.training import list_model_versions as rest_list_model_versions
            
            # Call REST API function
            result = await rest_list_model_versions(run_id)
            
            versions = []
            for v in result.get("versions", []):
                versions.append(ModelVersion(
                    version_name=v.get("version_name", ""),
                    run_id=v.get("run_id", run_id),
                    checkpoint_name=v.get("checkpoint_name", ""),
                    created_at=v.get("created_at", ""),
                    tags=v.get("tags", []),
                    description=v.get("description"),
                    model_path=v.get("model_path", ""),
                ))
            
            return versions
        except Exception as e:
            import logging
            logging.error(f"Error listing model versions: {e}", exc_info=True)
            return []
    
    @strawberry.mutation
    async def create_model_version(self, input: CreateVersionInput) -> CreateVersionResult:
        """Create a versioned model from a checkpoint"""
        try:
            from ....api.training import create_model_version as rest_create_model_version
            
            # Call REST API function
            result = await rest_create_model_version(
                run_id=input.run_id,
                checkpoint_name=input.checkpoint_name,
                version_name=input.version_name,
                tags=input.tags,
                description=input.description,
            )
            
            version_data = result.get("version", {})
            
            return CreateVersionResult(
                success=result.get("success", True),
                version=ModelVersion(
                    version_name=version_data.get("version_name", ""),
                    run_id=version_data.get("run_id", input.run_id),
                    checkpoint_name=version_data.get("checkpoint_name", input.checkpoint_name),
                    created_at=version_data.get("created_at", ""),
                    tags=version_data.get("tags", input.tags or []),
                    description=version_data.get("description", input.description),
                    model_path=version_data.get("model_path", ""),
                ),
                error=result.get("error"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error creating model version: {e}", exc_info=True)
            raise
    
    @strawberry.mutation
    async def test_wandb_connection(self, input: TestWandbConnectionInput) -> TestWandbConnectionResult:
        """Test Weights & Biases connection"""
        try:
            from ....api.training import test_wandb_connection
            from ....api.models import TestWandbConnectionRequest
            
            # Create request object
            request = TestWandbConnectionRequest(api_key=input.api_key)
            
            # Call REST API function
            result = await test_wandb_connection(request)
            
            return TestWandbConnectionResult(
                success=result.get("success", False),
                message=result.get("message", ""),
                wandb_authenticated=result.get("wandb_authenticated", result.get("success", False)),
            )
        except Exception as e:
            import logging
            logging.error(f"Error testing W&B connection: {e}", exc_info=True)
            return TestWandbConnectionResult(
                success=False,
                message=str(e),
                wandb_authenticated=False,
            )
    
    @strawberry.mutation
    async def test_mlflow_connection(self, input: TestMlflowConnectionInput) -> TestMlflowConnectionResult:
        """Test MLflow connection"""
        try:
            from ....api.training import test_mlflow_connection
            from ....api.models import TestMlflowConnectionRequest
            
            # Create request object
            request = TestMlflowConnectionRequest(tracking_uri=input.tracking_uri)
            
            # Call REST API function
            result = await test_mlflow_connection(request)
            
            return TestMlflowConnectionResult(
                success=result.get("success", False),
                message=result.get("message", ""),
            )
        except Exception as e:
            import logging
            logging.error(f"Error testing MLflow connection: {e}", exc_info=True)
            return TestMlflowConnectionResult(
                success=False,
                message=str(e),
            )
    
    @strawberry.field
    async def list_wandb_runs(self, project: Optional[str] = None, api_key: Optional[str] = None) -> List[WandbRun]:
        """List W&B runs for a project"""
        try:
            from ....api.training import list_wandb_runs as rest_list_wandb_runs
            
            # Call REST API function
            result = await rest_list_wandb_runs(project=project, api_key=api_key)
            
            runs = []
            for run_data in result.get("runs", []):
                runs.append(WandbRun(
                    id=run_data.get("id", ""),
                    name=run_data.get("name", ""),
                    state=run_data.get("state", ""),
                    config=json.dumps(run_data.get("config", {})),
                    summary=json.dumps(run_data.get("summary", {})),
                    url=run_data.get("url", ""),
                    created_at=run_data.get("createdAt"),
                    updated_at=run_data.get("updatedAt"),
                ))
            
            return runs
        except Exception as e:
            import logging
            logging.error(f"Error listing W&B runs: {e}", exc_info=True)
            return []
    
    @strawberry.field
    async def get_wandb_run(self, run_id: str, project: Optional[str] = None, api_key: Optional[str] = None) -> Optional[WandbRunDetails]:
        """Get W&B run details and metrics"""
        try:
            from ....api.training import get_wandb_run as rest_get_wandb_run
            
            # Call REST API function
            result = await rest_get_wandb_run(run_id=run_id, project=project, api_key=api_key)
            
            if not result.get("success"):
                return None
            
            return WandbRunDetails(
                run_id=result.get("run_id", run_id),
                run_name=result.get("run_name", ""),
                metrics=json.dumps(result.get("metrics", {})),
                config=json.dumps(result.get("config", {})),
                summary=json.dumps(result.get("summary", {})),
                url=result.get("url", ""),
                project_name=result.get("project_name", project or "rl-studio"),
            )
        except Exception as e:
            import logging
            logging.error(f"Error getting W&B run: {e}", exc_info=True)
            return None

