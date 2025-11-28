"""
API route handlers
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..rollout.model_loader import load_model_for_inference, run_rollout_with_model
from ..rollout.simulator import run_rollout, validate_env_spec
from ..training import get_job_status, launch_training_job, stop_job
from ..utils.security import sanitize_env_spec, validate_env_spec_structure
from .admin import router as admin_router
from .analysis import router as analysis_router
from .benchmarks import router as benchmarks_router
from .codegen import router as codegen_router
from .compile import router as compile_router
from .generation import router as generation_router
from .infrastructure import router as infrastructure_router
from .ingestion import router as ingestion_router
from .models import (
    HealthResponse,
    JobStatusResponse,
    LaunchJobRequest,
    LaunchJobResponse,
    RolloutRequest,
    RolloutResponse,
)

# Removed: scenes_router and assets_router - use GraphQL instead
# from .scenes import router as scenes_router
# from .assets import router as assets_router
from .templates import router as templates_router
from .training import router as training_router
from .verification import router as verification_router

logger = logging.getLogger(__name__)

router = APIRouter()

# Include sub-routers
# NOTE: assets_router and scenes_router have been REMOVED - all operations now use GraphQL
# GraphQL endpoint: POST /graphql
router.include_router(analysis_router)
router.include_router(
    training_router
)  # Contains some deprecated endpoints - use GraphQL for core operations
router.include_router(verification_router)
router.include_router(generation_router)
router.include_router(benchmarks_router)
router.include_router(codegen_router)
router.include_router(infrastructure_router)
# Removed: scenes_router - use GraphQL instead
# Removed: assets_router - use GraphQL instead
router.include_router(templates_router)
router.include_router(compile_router)
router.include_router(admin_router)
router.include_router(ingestion_router)

# ============================================================================
# Rollout Routes
# ============================================================================
# NOTE: HTTP rollout endpoint has been REMOVED - use GraphQL instead
# GraphQL endpoint: POST /graphql with mutation { runRollout(...) }
# WebSocket endpoint (/ws/rollout) is kept as GraphQL doesn't support WebSocket subscriptions


# Removed: @router.post("/api/rollout", ...) - use GraphQL mutation { runRollout(...) }
# Function kept for potential internal use
async def run_rollout_http(request: RolloutRequest):
    """Run a rollout and return complete results - OPTIMIZED"""
    start_time = asyncio.get_event_loop().time()

    try:
        if not isinstance(request.envSpec, dict):
            raise ValueError("envSpec must be a dictionary")

        # Security: Validate and sanitize environment spec
        is_valid, error_msg = validate_env_spec_structure(request.envSpec)
        if not is_valid:
            execution_time = asyncio.get_event_loop().time() - start_time
            return RolloutResponse(
                success=False,
                error=f"Security validation failed: {error_msg}",
                executionTime=execution_time,
            )

        # Sanitize input
        sanitized_spec = sanitize_env_spec(request.envSpec)

        # Validate environment first
        is_valid, error_msg = validate_env_spec(sanitized_spec)
        if not is_valid:
            execution_time = asyncio.get_event_loop().time() - start_time
            return RolloutResponse(
                success=False,
                error=f"Invalid environment: {error_msg}",
                executionTime=execution_time,
            )

        # Handle trained model policy
        if request.policy == "trained_model":
            if not request.runId and not request.modelUrl:
                execution_time = asyncio.get_event_loop().time() - start_time
                return RolloutResponse(
                    success=False,
                    error="runId or modelUrl required for trained_model policy",
                    executionTime=execution_time,
                )

            # Load model
            convex_url = os.getenv("CONVEX_URL")
            model = load_model_for_inference(
                model_url=request.modelUrl, run_id=request.runId, convex_url=convex_url
            )

            if not model:
                execution_time = asyncio.get_event_loop().time() - start_time
                return RolloutResponse(
                    success=False,
                    error="Failed to load model. Check that model exists and storage is configured.",
                    executionTime=execution_time,
                )

            # Run rollout with model
            result = run_rollout_with_model(
                env_spec=sanitized_spec, model=model, max_steps=request.maxSteps
            )
        else:
            # Use existing random/greedy rollout
            # Check if batch processing requested
            if request.batchSize and request.batchSize > 1 and request.useParallel:
                from ..rollout.parallel_simulator import run_vectorized_batch

                batch_result = run_vectorized_batch(
                    env_spec=sanitized_spec,
                    policy=request.policy,
                    max_steps=request.maxSteps,
                    batch_size=request.batchSize,
                )
                # Return first result for compatibility, but include batch stats
                if batch_result["results"]:
                    result = batch_result["results"][0]
                    result["batch_statistics"] = batch_result["statistics"]
                else:
                    result = {
                        "success": False,
                        "error": "No rollouts completed",
                        "steps": [],
                        "totalReward": 0.0,
                        "episodeLength": 0,
                    }
            else:
                result = run_rollout(
                    env_spec=sanitized_spec,
                    policy=request.policy,
                    max_steps=request.maxSteps,
                )

        result_dict = {
            "steps": [
                {
                    "state": {
                        "agents": [
                            {"id": a["id"], "position": a["position"]}
                            for a in step["state"]["agents"]
                        ],
                        "objects": step["state"]["objects"],
                        "step": step["state"]["step"],
                        "totalReward": step["state"]["totalReward"],
                        "done": step["state"]["done"],
                        "info": step["state"]["info"],
                    },
                    "action": step["action"],
                    "reward": step["reward"],
                    "done": step["done"],
                }
                for step in result["steps"]
            ],
            "totalReward": result["totalReward"],
            "episodeLength": result["episodeLength"],
            "success": result["success"],
            "terminationReason": result.get("terminationReason"),
        }

        execution_time = asyncio.get_event_loop().time() - start_time

        return RolloutResponse(
            success=True, result=result_dict, executionTime=execution_time
        )

    except Exception as e:
        logger.error(f"Rollout failed: {e}", exc_info=True)
        execution_time = asyncio.get_event_loop().time() - start_time
        return RolloutResponse(
            success=False, error=str(e), executionTime=execution_time
        )


@router.websocket("/ws/rollout")
async def run_rollout_websocket(websocket: WebSocket):
    """Run a rollout with real-time streaming via WebSocket"""
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        request = RolloutRequest(**data)

        if not isinstance(request.envSpec, dict):
            await websocket.send_json(
                {"type": "error", "error": "envSpec must be a dictionary"}
            )
            return

        # Validate environment first
        is_valid, error_msg = validate_env_spec(request.envSpec)
        if not is_valid:
            await websocket.send_json(
                {"type": "error", "error": f"Invalid environment: {error_msg}"}
            )
            return

        # Handle trained model policy
        model = None
        if request.policy == "trained_model":
            if not request.runId and not request.modelUrl:
                await websocket.send_json(
                    {
                        "type": "error",
                        "error": "runId or modelUrl required for trained_model policy",
                    }
                )
                return

            # Load model
            convex_url = os.getenv("CONVEX_URL")
            model = load_model_for_inference(
                model_url=request.modelUrl, run_id=request.runId, convex_url=convex_url
            )

            if not model:
                await websocket.send_json(
                    {"type": "error", "error": "Failed to load model"}
                )
            return

        await websocket.send_json(
            {"type": "started", "policy": request.policy, "maxSteps": request.maxSteps}
        )

        def stream_callback(step):
            try:
                asyncio.create_task(
                    websocket.send_json(
                        {
                            "type": "step",
                            "step": {
                                "state": {
                                    "agents": [
                                        {"id": a["id"], "position": a["position"]}
                                        for a in step["state"]["agents"]
                                    ],
                                    "objects": step["state"]["objects"],
                                    "step": step["state"]["step"],
                                    "totalReward": step["state"]["totalReward"],
                                    "done": step["state"]["done"],
                                    "info": step["state"]["info"],
                                },
                                "action": step["action"],
                                "reward": step["reward"],
                                "done": step["done"],
                            },
                        }
                    )
                )
            except Exception as e:
                logger.error(f"Failed to send step: {e}")

        if model:
            # Run rollout with model (note: run_rollout_with_model doesn't support streaming yet)
            result = run_rollout_with_model(
                env_spec=request.envSpec, model=model, max_steps=request.maxSteps
            )
            # Send all steps at once for model rollouts
            for step in result.get("steps", []):
                await websocket.send_json({"type": "step", "step": step})
        else:
            result = run_rollout(
                env_spec=request.envSpec,
                policy=request.policy,
                max_steps=request.maxSteps,
                stream_callback=stream_callback,
            )

        await websocket.send_json(
            {
                "type": "complete",
                "result": {
                    "totalReward": result["totalReward"],
                    "episodeLength": result["episodeLength"],
                    "success": result["success"],
                    "terminationReason": result.get("terminationReason"),
                },
            }
        )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket rollout failed: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except:
            pass


# ============================================================================
# Training Job Routes
# ============================================================================
# NOTE: Training REST endpoints have been REMOVED - use GraphQL instead
# GraphQL endpoint: POST /graphql with mutation { launchTraining(...) }


# Removed: @router.post("/api/training/launch", ...) - use GraphQL mutation { launchTraining(...) }
# Function kept for potential internal use
async def launch_training(request: LaunchJobRequest):
    """
    Launch a training job via SkyPilot

    Fetches environment specification from Convex and generates proper training setup.
    Automatically sets up AWS infrastructure if needed.
    """
    try:
        # Auto-setup AWS infrastructure before launching
        try:
            from ..training.aws_setup import setup_infrastructure

            setup_result = setup_infrastructure()
            if not setup_result.get("skypilot_installed"):
                return LaunchJobResponse(
                    success=False,
                    error="SkyPilot not installed. Installing now... (this may take a minute)",
                )
            if setup_result.get("warnings"):
                logger.warning(f"AWS setup warnings: {setup_result['warnings']}")
        except Exception as e:
            logger.warning(f"Infrastructure setup warning: {e}")

        # Fetch env_spec from Convex if not provided
        env_spec = None
        if request.config.get("env_spec"):
            env_spec = request.config.get("env_spec")
        else:
            # Try to fetch from Convex (if CONVEX_URL is set)
            import os

            import requests

            convex_url = os.getenv("CONVEX_URL")
            if convex_url and request.runId:
                try:
                    # Call Convex action to get run config with env_spec
                    response = requests.post(
                        f"{convex_url}/api/action",
                        json={
                            "path": "runs:getConfig",
                            "args": {"runId": request.runId},
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                    )
                    if response.ok:
                        config = response.json()
                        env_spec = config.get("environment", {}).get("spec", {})
                        logger.info(
                            f"Fetched env_spec from Convex for run {request.runId}"
                        )
                except Exception as e:
                    logger.warning(
                        f"Could not fetch env_spec from Convex: {e}. Training will use default environment."
                    )

        # Launch training job with env_spec
        try:
            job_id = launch_training_job(
                request.runId,
                request.config,
                env_spec=env_spec,
                use_managed_jobs=request.config.get("use_managed_jobs", True),
            )
            logger.info(f"✅ Training job launched successfully: {job_id}")

            # Update run status in Convex to "running" and save skyPilotJobId
            import os

            import requests

            convex_url = os.getenv("CONVEX_URL")
            if convex_url and request.runId:
                try:
                    # Update run status to "running" and save job ID
                    response = requests.post(
                        f"{convex_url}/api/action",
                        json={
                            "path": "runs:updateStatus",
                            "args": {
                                "id": request.runId,
                                "status": "running",
                                "skyPilotJobId": job_id,
                            },
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                    )
                    if response.ok:
                        logger.info(
                            f"Updated run {request.runId} status to 'running' with job ID {job_id}"
                        )
                    else:
                        logger.warning(f"Failed to update run status: {response.text}")

                    # Sync initial metadata
                    try:
                        from ..api.background_sync import sync_run_metadata_to_convex

                        sync_run_metadata_to_convex(request.runId, job_id, convex_url)
                    except Exception as sync_error:
                        logger.warning(f"Could not sync initial metadata: {sync_error}")

                except Exception as e:
                    logger.warning(f"Could not update run status in Convex: {e}")

            return LaunchJobResponse(success=True, jobId=job_id)
        except Exception as job_error:
            error_msg = str(job_error)
            logger.error(
                f"❌ Failed to launch training job: {error_msg}", exc_info=True
            )
            return LaunchJobResponse(
                success=False, error=f"Failed to launch training job: {error_msg}"
            )
    except Exception as e:
        logger.error(f"Failed to launch training job: {e}", exc_info=True)
        return LaunchJobResponse(success=False, error=str(e))


# Removed: @router.get("/api/training/status/{job_id}", ...) - use GraphQL query { trainingStatus(...) }
async def get_training_status(job_id: str, sync: bool = True):
    """
    Get comprehensive status of a training job including SkyPilot metadata and logs.

    Args:
        job_id: SkyPilot job ID
        sync: If True, sync latest status/logs to Convex database
    """
    try:
        import os

        import requests

        from ..api.background_sync import sync_run_metadata_to_convex
        from ..training.orchestrator import get_job_logs, get_job_status

        status = get_job_status(job_id)

        # Get logs if job is running or recently completed
        logs_info = None
        if status.get("status") in ["RUNNING", "SUCCEEDED", "FAILED"]:
            logs_info = get_job_logs(job_id, max_lines=500)  # Get last 500 lines

        # Sync to Convex if requested
        if sync:
            try:
                convex_url = os.getenv("CONVEX_URL")
                if convex_url:
                    # Find run_id from job_id by querying Convex
                    response = requests.post(
                        f"{convex_url}/api/action",
                        json={
                            "path": "runs:getBySkyPilotJobId",
                            "args": {"skyPilotJobId": job_id},
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                    )
                    if response.ok:
                        run = response.json()
                        if run:
                            from ..api.background_sync import (
                                sync_run_metadata_to_convex,
                            )

                            sync_run_metadata_to_convex(run["_id"], job_id, convex_url)
            except Exception as sync_error:
                logger.debug(f"Could not auto-sync: {sync_error}")

        # Combine status and logs
        full_status = {
            **status,
            "logs": logs_info.get("logs", "") if logs_info else None,
            "log_line_count": logs_info.get("line_count", 0) if logs_info else 0,
            "logs_truncated": logs_info.get("truncated", False) if logs_info else False,
        }

        return JobStatusResponse(
            success=True,
            status=status.get("status"),
            jobId=job_id,
            metadata=full_status,  # Include full metadata with logs
        )
    except Exception as e:
        logger.error(f"Failed to get job status: {e}", exc_info=True)
        return JobStatusResponse(success=False, error=str(e), jobId=job_id)


@router.get("/api/training/logs/{job_id}")
async def get_training_logs(job_id: str, max_lines: int = 1000):
    """Get logs from a training job"""
    try:
        from ..training.orchestrator import get_job_logs

        logs_info = get_job_logs(job_id, max_lines=max_lines)

        return {
            "success": True,
            "job_id": job_id,
            "logs": logs_info.get("logs", ""),
            "line_count": logs_info.get("line_count", 0),
            "truncated": logs_info.get("truncated", False),
        }
    except Exception as e:
        logger.error(f"Failed to get job logs: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# Removed: @router.post("/api/training/stop/{job_id}", ...) - use GraphQL mutation { stopTraining(...) }
async def stop_training(job_id: str):
    """Stop a running training job"""
    try:
        success = stop_job(job_id)
        return {"success": success, "jobId": job_id}
    except Exception as e:
        logger.error(f"Failed to stop job: {e}", exc_info=True)
        return {"success": False, "error": str(e), "jobId": job_id}
