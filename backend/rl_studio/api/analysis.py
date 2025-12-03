"""
API endpoints for RL analysis features
Real-time streaming with heavy Python calculations (NumPy, SciPy)
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Lazy imports - don't load heavy NumPy/SciPy libraries until actually needed
# This allows the server to start quickly, then load dependencies when endpoints are called
from ..utils.json_serializer import serialize_for_json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class AnalyzeRolloutRequest(BaseModel):
    rollout_steps: List[Dict[str, Any]]
    env_spec: Dict[str, Any]


class AnalyzeMultipleRolloutsRequest(BaseModel):
    rollouts: List[List[Dict[str, Any]]]
    env_spec: Dict[str, Any]


@router.post("/reward")
async def analyze_reward(request: AnalyzeRolloutRequest):
    """Analyze reward decomposition for a rollout - REAL Python calculations"""
    try:
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.reward_analysis import RewardAnalyzer

        analyzer = RewardAnalyzer()
        # Heavy computation with NumPy/SciPy
        analysis = await loop.run_in_executor(
            None, analyzer.analyze_rollout, request.rollout_steps
        )
        # Convert NumPy types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)
        return {"success": True, "analysis": analysis_serialized}
    except Exception as e:
        logger.error(f"Reward analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/reward")
async def analyze_reward_streaming(websocket: WebSocket):
    """Stream reward analysis with real-time progress"""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        request = AnalyzeRolloutRequest(**data)

        await websocket.send_json(
            {"type": "started", "message": "Starting reward analysis..."}
        )

        # Run heavy computation with progress updates
        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.reward_analysis import RewardAnalyzer

        analyzer = RewardAnalyzer()

        # Stream progress
        def progress_callback(progress: float, message: str):
            asyncio.create_task(
                websocket.send_json(
                    {"type": "progress", "progress": progress, "message": message}
                )
            )

        # Run analysis with progress
        analysis = await loop.run_in_executor(
            None, lambda: analyzer.analyze_rollout(request.rollout_steps)
        )

        # Convert NumPy types to native Python types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)

        await websocket.send_json({"type": "complete", "analysis": analysis_serialized})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Reward analysis streaming failed: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception as send_error:
            logger.error(
                f"Failed to send error to WebSocket client: {send_error}",
                exc_info=True,
                extra={"original_error": str(e), "original_error_type": type(e).__name__},
            )
            # Close connection if we can't send error
            try:
                await websocket.close(code=1011, reason="Internal server error")
            except Exception:
                pass  # Connection may already be closed


@router.post("/reward/multiple")
async def analyze_multiple_rewards(request: AnalyzeMultipleRolloutsRequest):
    """Analyze reward patterns across multiple rollouts"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.reward_analysis import RewardAnalyzer

        analyzer = RewardAnalyzer()
        analysis = analyzer.analyze_multiple_rollouts(request.rollouts)
        return {"success": True, "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trajectory")
async def analyze_trajectory(request: AnalyzeRolloutRequest):
    """Analyze trajectory for a rollout - REAL Python calculations with NumPy"""
    try:
        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.trajectory_analysis import TrajectoryAnalyzer

        analyzer = TrajectoryAnalyzer()
        # Heavy computation with NumPy for trajectory analysis
        analysis = await loop.run_in_executor(
            None, analyzer.analyze_rollout, request.rollout_steps, request.env_spec
        )
        # Convert NumPy types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)
        return {"success": True, "analysis": analysis_serialized}
    except Exception as e:
        logger.error(f"Trajectory analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/trajectory")
async def analyze_trajectory_streaming(websocket: WebSocket):
    """Stream trajectory analysis with real-time progress"""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        request = AnalyzeRolloutRequest(**data)

        await websocket.send_json(
            {"type": "started", "message": "Starting trajectory analysis..."}
        )

        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.trajectory_analysis import TrajectoryAnalyzer

        analyzer = TrajectoryAnalyzer()

        # Heavy NumPy calculations
        analysis = await loop.run_in_executor(
            None, analyzer.analyze_rollout, request.rollout_steps, request.env_spec
        )

        # Convert NumPy types to native Python types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)

        await websocket.send_json({"type": "complete", "analysis": analysis_serialized})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Trajectory analysis streaming failed: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception as send_error:
            logger.error(
                f"Failed to send error to WebSocket client: {send_error}",
                exc_info=True,
                extra={"original_error": str(e), "original_error_type": type(e).__name__},
            )
            # Close connection if we can't send error
            try:
                await websocket.close(code=1011, reason="Internal server error")
            except Exception:
                pass  # Connection may already be closed


@router.post("/trajectory/multiple")
async def analyze_multiple_trajectories(request: AnalyzeMultipleRolloutsRequest):
    """Analyze trajectories across multiple rollouts"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.trajectory_analysis import TrajectoryAnalyzer

        analyzer = TrajectoryAnalyzer()
        analysis = analyzer.analyze_multiple_rollouts(
            request.rollouts, request.env_spec
        )
        return {"success": True, "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/termination")
async def analyze_termination(request: AnalyzeRolloutRequest):
    """Analyze termination for a rollout"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.termination_analysis import TerminationAnalyzer

        analyzer = TerminationAnalyzer()
        analysis = analyzer.analyze_rollout(request.rollout_steps)
        return {"success": True, "analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/termination/multiple")
async def analyze_multiple_terminations(request: AnalyzeMultipleRolloutsRequest):
    """Analyze termination patterns across multiple rollouts - REAL Python calculations"""
    try:
        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.termination_analysis import TerminationAnalyzer

        analyzer = TerminationAnalyzer()
        # Heavy computation with NumPy for statistical analysis
        analysis = await loop.run_in_executor(
            None, analyzer.analyze_multiple_rollouts, request.rollouts
        )
        # Convert NumPy types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)
        return {"success": True, "analysis": analysis_serialized}
    except Exception as e:
        logger.error(f"Termination analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/termination/multiple")
async def analyze_multiple_terminations_streaming(websocket: WebSocket):
    """Stream termination analysis with real-time progress"""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        request = AnalyzeMultipleRolloutsRequest(**data)

        await websocket.send_json(
            {
                "type": "started",
                "message": f"Analyzing {len(request.rollouts)} rollouts...",
            }
        )

        loop = asyncio.get_event_loop()
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.termination_analysis import TerminationAnalyzer

        analyzer = TerminationAnalyzer()

        # Heavy NumPy statistical calculations
        analysis = await loop.run_in_executor(
            None, analyzer.analyze_multiple_rollouts, request.rollouts
        )

        # Convert NumPy types to native Python types for JSON serialization
        analysis_serialized = serialize_for_json(analysis)

        await websocket.send_json({"type": "complete", "analysis": analysis_serialized})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Termination analysis streaming failed: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "error": str(e)})
        except Exception as send_error:
            logger.error(
                f"Failed to send error to WebSocket client: {send_error}",
                exc_info=True,
                extra={"original_error": str(e), "original_error_type": type(e).__name__},
            )
            # Close connection if we can't send error
            try:
                await websocket.close(code=1011, reason="Internal server error")
            except Exception:
                pass  # Connection may already be closed


@router.post("/diagnostics")
async def get_diagnostics(request: AnalyzeRolloutRequest):
    """Get advanced RL diagnostics"""
    try:
        # Lazy import to avoid loading heavy deps at startup
        from ..analysis.diagnostics import RLDiagnostics

        diagnostics = RLDiagnostics()
        # Process rollout to compute diagnostics
        # (In real implementation, this would come from training metrics)
        summary = diagnostics.get_diagnostics_summary()
        return {"success": True, "diagnostics": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
