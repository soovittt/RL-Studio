"""
Background task to sync SkyPilot logs and status to Convex database.
This ensures researchers have access to all training logs and metadata.
"""
import os
import time
import logging
import requests
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


def sync_job_status_to_convex(
    run_id: str,
    job_id: str,
    convex_url: str,
    status_info: Dict[str, Any],
    logs_info: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Sync SkyPilot job status and logs to Convex database.
    
    Args:
        run_id: Convex run ID
        job_id: SkyPilot job ID
        convex_url: Convex deployment URL
        status_info: Status information from get_job_status()
        logs_info: Logs information from get_job_logs() (optional)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Prepare update data
        updates: Dict[str, Any] = {
            "skyPilotStatus": status_info.get("status"),
            "skyPilotResources": status_info.get("resources", {}),
            "lastLogUpdate": int(time.time() * 1000),  # Milliseconds
        }
        
        # Add logs if provided (truncate to last 50KB to avoid Convex limits)
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
            return True
        else:
            logger.warning(f"Failed to sync metadata: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to sync job status to Convex: {e}")
        return False


def sync_logs_to_convex(
    run_id: str,
    convex_url: str,
    logs: str,
    log_level: str = "info"
) -> bool:
    """
    Sync training logs to Convex trainingLogs table.
    
    Args:
        run_id: Convex run ID
        convex_url: Convex deployment URL
        logs: Log content
        log_level: Log level (info, warning, error, debug)
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Split logs into lines and send in batches
        log_lines = logs.split("\n")
        batch_size = 100  # Send 100 lines at a time
        
        for i in range(0, len(log_lines), batch_size):
            batch = log_lines[i:i + batch_size]
            message = "\n".join(batch)
            
            # Send to Convex
            http_url = convex_url.replace("/api", "")
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
        
        logger.info(f"Synced {len(log_lines)} log lines for run {run_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to sync logs to Convex: {e}")
        return False

