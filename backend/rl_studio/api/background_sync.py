"""
Background task to periodically sync SkyPilot logs and status to Convex.
This ensures researchers have access to real-time training logs and metadata.
"""
import os
import time
import logging
import requests
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def sync_run_metadata_to_convex(
    run_id: str,
    job_id: str,
    convex_url: str
) -> bool:
    """
    Sync SkyPilot job status and logs to Convex database.
    This should be called periodically for running jobs.
    
    Args:
        run_id: Convex run ID
        job_id: SkyPilot job ID
        convex_url: Convex deployment URL
    
    Returns:
        True if successful, False otherwise
    """
    try:
        from ..training.orchestrator import get_job_status, get_job_logs
        
        # Get current status
        status_info = get_job_status(job_id)
        
        # Get logs (last 1000 lines)
        logs_info = get_job_logs(job_id, max_lines=1000)
        
        # Prepare update data
        updates: Dict[str, Any] = {
            "skyPilotStatus": status_info.get("status"),
            "skyPilotResources": status_info.get("resources", {}),
            "lastLogUpdate": int(time.time() * 1000),  # Milliseconds
        }
        
        # Add logs if available (truncate to last 50KB to avoid Convex limits)
        if logs_info and logs_info.get("logs"):
            logs = logs_info["logs"]
            # Truncate to ~50KB (rough estimate: ~1000 chars per line)
            max_log_size = 50000
            if len(logs) > max_log_size:
                logs = logs[-max_log_size:]
                updates["skyPilotLogs"] = f"... (truncated, showing last {max_log_size} chars)\n{logs}"
            else:
                updates["skyPilotLogs"] = logs
        
        # Add duration if available
        if status_info.get("duration"):
            updates["skyPilotDuration"] = status_info.get("duration")
        
        # Add cost estimate if available
        if status_info.get("cost"):
            updates["skyPilotCost"] = status_info.get("cost")
        
        # Update run in Convex
        response = requests.post(
            f"{convex_url}/api/action",
            json={
                "path": "runs:updateSkyPilotMetadata",
                "args": {
                    "id": run_id,
                    **updates,
                },
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        
        if response.ok:
            logger.info(f"Synced SkyPilot metadata for run {run_id}")
            
            # Also sync detailed logs to trainingLogs table
            if logs_info and logs_info.get("logs"):
                sync_detailed_logs_to_convex(run_id, convex_url, logs_info["logs"])
            
            return True
        else:
            logger.warning(f"Failed to sync metadata: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to sync job status to Convex: {e}")
        return False


def sync_detailed_logs_to_convex(
    run_id: str,
    convex_url: str,
    logs: str
) -> bool:
    """
    Sync training logs to Convex trainingLogs table for detailed history.
    
    Args:
        run_id: Convex run ID
        convex_url: Convex deployment URL
        logs: Log content
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Split logs into lines and send in batches
        log_lines = logs.split("\n")
        batch_size = 100  # Send 100 lines at a time
        
        http_url = convex_url.replace("/api", "")
        
        for i in range(0, len(log_lines), batch_size):
            batch = log_lines[i:i + batch_size]
            message = "\n".join(batch)
            
            # Determine log level from content
            log_level = "info"
            if any(keyword in message.lower() for keyword in ["error", "failed", "exception"]):
                log_level = "error"
            elif any(keyword in message.lower() for keyword in ["warning", "warn"]):
                log_level = "warning"
            elif "debug" in message.lower():
                log_level = "debug"
            
            # Send to Convex
            response = requests.post(
                f"{http_url}/trainingLogs",
                json={
                    "runId": run_id,
                    "logLevel": log_level,
                    "message": message,
                    "metadata": {
                        "batch": i // batch_size + 1,
                        "total_batches": (len(log_lines) + batch_size - 1) // batch_size,
                    },
                },
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            
            if not response.ok:
                logger.warning(f"Failed to sync log batch: {response.text}")
                return False
        
        logger.debug(f"Synced {len(log_lines)} log lines for run {run_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to sync logs to Convex: {e}")
        return False

