"""
Training GraphQL resolvers
"""

import json
from typing import Optional

import strawberry

from ....training.orchestrator import (get_job_status, launch_training_job,
                                       stop_job)
from ..types.training import JobStatus, TrainingRun, TrainingRunInput


@strawberry.type
class TrainingResolver:
    """Training queries and mutations"""

    @strawberry.mutation
    async def launch_training(self, input: TrainingRunInput) -> TrainingRun:
        """Launch a training job"""
        try:
            import json

            env_spec = (
                json.loads(input.env_spec)
                if isinstance(input.env_spec, str)
                else input.env_spec
            )
            config = (
                json.loads(input.config)
                if isinstance(input.config, str)
                else input.config
            )

            # Launch the job
            job_id = launch_training_job(
                input.run_id,
                config,
                env_spec=env_spec,
                use_managed_jobs=input.use_managed_jobs,
            )

            # Get initial status
            status_data = get_job_status(job_id)

            return TrainingRun(
                id=input.run_id,
                run_id=input.run_id,
                env_spec=json.dumps(env_spec),
                config=None,  # TODO: Convert config dict to TrainingConfig
                status=JobStatus(
                    status=status_data.get("status", "PENDING"),
                    job_id=job_id,
                    progress=status_data.get("progress"),
                    metadata=json.dumps(status_data.get("metadata", {})),
                    logs=status_data.get("logs"),
                    error=status_data.get("error"),
                ),
                created_at=None,  # TODO: Get from Convex
                updated_at=None,
                metrics=None,
            )
        except Exception as e:
            import logging

            logging.error(f"Training launch error: {e}", exc_info=True)
            raise

    @strawberry.field
    async def training_status(self, job_id: str) -> Optional[JobStatus]:
        """Get training job status"""
        try:
            status_data = get_job_status(job_id)

            return JobStatus(
                status=status_data.get("status", "UNKNOWN"),
                job_id=job_id,
                progress=status_data.get("progress"),
                metadata=json.dumps(status_data.get("metadata", {})),
                logs=status_data.get("logs"),
                error=status_data.get("error"),
            )
        except Exception as e:
            import logging

            logging.error(f"Error getting training status: {e}")
            return None

    @strawberry.mutation
    async def stop_training(self, job_id: str) -> bool:
        """Stop a running training job"""
        try:
            return stop_job(job_id)
        except Exception as e:
            import logging

            logging.error(f"Error stopping training: {e}")
            return False
