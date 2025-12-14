"""
Rollout GraphQL resolvers
"""

import hashlib
import json
import logging
from typing import Optional

import strawberry

from ....rollout.model_loader import load_model_for_inference, run_rollout_with_model
from ....rollout.simulator import run_rollout, validate_env_spec
from ....utils.security import sanitize_env_spec, validate_env_spec_structure
from ..types.rollout import RolloutInput, RolloutResult, Step

logger = logging.getLogger(__name__)


@strawberry.type
class RolloutResolver:
    """Rollout queries and mutations"""

    @strawberry.mutation
    async def run_rollout(self, input: RolloutInput) -> RolloutResult:
        """Run a rollout with the given environment and policy"""
        import asyncio

        start_time = asyncio.get_event_loop().time()

        try:
            import json

            env_spec = (
                json.loads(input.env_spec)
                if isinstance(input.env_spec, str)
                else input.env_spec
            )

            # Security validation
            is_valid, error_msg = validate_env_spec_structure(env_spec)
            if not is_valid:
                return RolloutResult(
                    success=False,
                    total_reward=0.0,
                    episode_length=0,
                    termination_reason=f"Security validation failed: {error_msg}",
                    steps=[],
                    execution_time=asyncio.get_event_loop().time() - start_time,
                    error=error_msg,
                )

            # Sanitize and validate
            sanitized_spec = sanitize_env_spec(env_spec)
            is_valid, error_msg = validate_env_spec(sanitized_spec)
            if not is_valid:
                return RolloutResult(
                    success=False,
                    total_reward=0.0,
                    episode_length=0,
                    termination_reason=f"Invalid environment: {error_msg}",
                    steps=[],
                    execution_time=asyncio.get_event_loop().time() - start_time,
                    error=error_msg,
                )

            # Handle trained model policy
            if input.policy == "trained_model":
                if not input.run_id and not input.model_url:
                    return RolloutResult(
                        success=False,
                        total_reward=0.0,
                        episode_length=0,
                        termination_reason="runId or modelUrl required for trained_model policy",
                        steps=[],
                        execution_time=asyncio.get_event_loop().time() - start_time,
                        error="runId or modelUrl required",
                    )

                # Load model and run
                model = load_model_for_inference(
                    run_id=input.run_id, model_url=input.model_url
                )

                result = run_rollout_with_model(
                    env_spec=sanitized_spec, model=model, max_steps=input.max_steps
                )
            else:
                # Run with policy
                result = run_rollout(
                    env_spec=sanitized_spec,
                    policy=input.policy,
                    max_steps=input.max_steps,
                )

            # Save rollout to S3 if configured (non-blocking)
            try:
                from ....utils.rollout_storage import save_rollout_to_s3
                
                # Generate env_id from env_spec hash
                env_spec_str = json.dumps(sanitized_spec, sort_keys=True)
                env_id = hashlib.md5(env_spec_str.encode()).hexdigest()[:12]
                
                # Save full rollout data to S3
                s3_url = save_rollout_to_s3(
                    rollout_data=result,
                    env_id=env_id,
                )
                logger.info(f"✅ Saved rollout to S3: {s3_url}")
            except Exception as e:
                # Don't fail rollout if S3 save fails - just log it
                logger.warning(f"Failed to save rollout to S3 (non-critical): {e}")

            # Convert steps to GraphQL types
            steps = []
            for i, step in enumerate(result.get("steps", [])):
                steps.append(
                    Step(
                        step_number=i,
                        state=json.dumps(step.get("state", {})),
                        action=step.get("action"),
                        reward=step.get("reward", 0.0),
                        done=step.get("done", False),
                        info=(
                            json.dumps(step.get("info", {}))
                            if step.get("info")
                            else None
                        ),
                    )
                )

            return RolloutResult(
                success=result.get("success", True),
                total_reward=result.get("totalReward", 0.0),
                episode_length=result.get("episodeLength", 0),
                termination_reason=result.get("terminationReason"),
                steps=steps,
                execution_time=asyncio.get_event_loop().time() - start_time,
                error=None,
            )
        except Exception as e:
            import logging

            logging.error(f"Rollout error: {e}", exc_info=True)
            return RolloutResult(
                success=False,
                total_reward=0.0,
                episode_length=0,
                termination_reason=str(e),
                steps=[],
                execution_time=asyncio.get_event_loop().time() - start_time,
                error=str(e),
            )
