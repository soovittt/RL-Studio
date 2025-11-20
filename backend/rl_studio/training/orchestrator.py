"""
Backend service for managing SkyPilot training jobs.
Can run as a separate service or be called from API endpoints.
"""
import os
import subprocess
import json
import yaml
from typing import Dict, Any, Optional
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Auto-setup AWS infrastructure on import
# This happens automatically - users just need API keys in .env
try:
    from .aws_setup import setup_infrastructure, setup_aws_credentials_from_env
    _setup_result = setup_aws_credentials_from_env()
    if _setup_result:
        logger.info("✅ AWS credentials auto-configured from .env")
    else:
        logger.debug("AWS credentials not set (optional - only needed for GPU training)")
except Exception as e:
    logger.debug(f"AWS auto-configuration skipped: {e}")


def generate_skypilot_yaml(run_id: str, config: Dict[str, Any], output_path: str, env_spec: Optional[Dict[str, Any]] = None) -> str:
    """
    Generate SkyPilot YAML configuration for a training job.
    
    SkyPilot is a framework for running ML workloads on any cloud (AWS, GCP, Azure, etc.)
    with automatic resource provisioning and cost optimization.
    
    Follows SkyPilot best practices:
    - Uses workdir for code syncing
    - Supports spot instances for cost savings
    - Proper file mounts for data/checkpoints
    - Environment variables for configuration
    """
    # Get accelerator config (default to A10:1 for cost-effective GPU)
    accelerator = config.get("accelerator", "A10:1")
    use_spot = config.get("use_spot", False)  # Use spot instances for cost savings
    
    # Build proper SkyPilot YAML structure following official docs
    yaml_content = {
        "name": f"rl-studio-{run_id}",
        "resources": {
            "accelerators": accelerator,
            "use_spot": use_spot,  # Enable spot instances for ~70% cost savings
            # Optional: specify cloud provider (auto-selects cheapest if not specified)
            # "infra": config.get("cloud", "aws"),  # aws, gcp, azure, k8s, etc.
        },
        # Workdir: local directory to sync to cluster (~/sky_workdir/ on cluster)
        # SkyPilot automatically syncs this directory
        "workdir": config.get("workdir", "."),
        "setup": """# Install RL dependencies
pip install -q stable-baselines3>=2.2.0 gymnasium>=0.29.0 torch>=2.0.0
pip install -q numpy>=1.24.0 scipy>=1.10.0 requests>=2.31.0

# Setup is run under workdir, so we can use files from there
echo "Setup complete. Workdir contents:"
ls -la
""",
        "run": """# Run commands are executed under workdir
# SkyPilot automatically syncs workdir before running
python train.py
""",
        "envs": {
            "RUN_ID": run_id,
            "CONVEX_URL": os.getenv("CONVEX_URL", ""),
            "METRICS_INTERVAL": str(config.get("metrics_interval", 100)),
            "PYTHONUNBUFFERED": "1",  # Ensure real-time output
        },
    }
    
    # Add file mounts for data/checkpoints (optional)
    # Use cloud buckets for persistent storage
    file_mounts = {}
    
    # Mount checkpoint bucket if specified
    checkpoint_bucket = config.get("checkpoint_bucket")
    if checkpoint_bucket:
        file_mounts["/checkpoint"] = {
            "name": checkpoint_bucket,
            "mode": "MOUNT"  # or "MOUNT_CACHED" for read-heavy workloads
        }
    
    # Add local file mounts if specified
    if config.get("train_script_path"):
        # For managed jobs, workdir handles this automatically
        # But we can still add explicit mounts if needed
        pass
    
    if file_mounts:
        yaml_content["file_mounts"] = file_mounts
    
    # Add environment-specific config if provided
    if env_spec:
        env_name = env_spec.get("name", "untitled").replace(" ", "-").lower()
        yaml_content["envs"]["ENV_NAME"] = env_name
        yaml_content["envs"]["ENV_TYPE"] = env_spec.get("envType", "grid")
    
    # Add autostop for cost management (optional)
    if config.get("autostop_minutes"):
        yaml_content["resources"]["autostop"] = config.get("autostop_minutes")
    
    # Add job recovery for spot instances (auto-retry on preemption)
    if use_spot:
        yaml_content["resources"]["job_recovery"] = {
            "max_restarts_on_errors": config.get("max_restarts", 3)
        }

    with open(output_path, "w") as f:
        yaml.dump(yaml_content, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    logger.info(f"Generated SkyPilot YAML: {output_path}")
    logger.info(f"  - Accelerator: {accelerator}")
    logger.info(f"  - Spot instances: {use_spot}")
    logger.info(f"  - Workdir: {yaml_content.get('workdir', '.')}")
    return output_path


def check_skypilot_installed() -> bool:
    """Check if SkyPilot CLI is installed and accessible."""
    try:
        result = subprocess.run(
            ["sky", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_cloud_credentials() -> Dict[str, Any]:
    """Check which cloud providers are configured in SkyPilot."""
    try:
        result = subprocess.run(
            ["sky", "check"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        
        # Parse sky check output
        output = result.stdout.lower()
        clouds = {
            "aws": "aws" in output or "amazon" in output,
            "gcp": "gcp" in output or "google" in output,
            "azure": "azure" in output or "microsoft" in output,
        }
        
        return {
            "installed": True,
            "clouds_configured": clouds,
            "any_cloud_ready": any(clouds.values()),
            "output": result.stdout,
        }
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return {
            "installed": False,
            "clouds_configured": {},
            "any_cloud_ready": False,
            "error": str(e),
        }


def launch_skypilot_job(yaml_path: str, use_managed_jobs: bool = True) -> str:
    """
    Launch a SkyPilot job and return the job ID.
    
    SkyPilot will:
    1. Provision cloud resources (VM with GPU)
    2. Sync workdir to cluster
    3. Run setup commands
    4. Execute run commands
    5. Auto-recover from spot preemptions (if managed jobs)
    
    Args:
        yaml_path: Path to SkyPilot YAML file
        use_managed_jobs: If True, use `sky jobs launch` (auto-recovery, spot support)
                         If False, use `sky launch` (interactive, SSH-able)
    """
    # Check if SkyPilot is installed
    if not check_skypilot_installed():
        raise RuntimeError(
            "SkyPilot CLI not found. Install with: pip install 'skypilot[aws,gcp,azure]'"
        )
    
    # Check cloud credentials
    cloud_status = check_cloud_credentials()
    if not cloud_status.get("any_cloud_ready"):
        logger.warning("No cloud providers configured. Run 'sky check' to set up credentials.")
        logger.warning("SkyPilot supports: AWS, GCP, Azure, Lambda Cloud, etc.")
    
    try:
        if use_managed_jobs:
            # Use managed jobs for production training (auto-recovery, spot support)
            # Managed jobs are better for long-running training jobs
            logger.info("🚀 Launching managed job (auto-recovery enabled)")
            result = subprocess.run(
                ["sky", "jobs", "launch", "-y", "-n", f"rl-studio-{int(os.path.getmtime(yaml_path))}", yaml_path],
                capture_output=True,
                text=True,
                check=True,
                timeout=300,  # 5 minute timeout for job launch
            )
        else:
            # Use regular launch for interactive development
            logger.info("🚀 Launching cluster job (interactive mode)")
            result = subprocess.run(
                ["sky", "launch", "-y", yaml_path],
                capture_output=True,
                text=True,
                check=True,
                timeout=300,  # 5 minute timeout for job launch
            )
        
        # Extract job ID from output
        # SkyPilot output format: "Task ID: <id>" or "Job <id>"
        lines = result.stdout.split("\n")
        job_id = None
        
        for line in lines:
            line_lower = line.lower()
            if "task id" in line_lower or "job id" in line_lower:
                # Extract ID (usually after colon or space)
                parts = line.split()
                for i, part in enumerate(parts):
                    if ("id" in part.lower() or "task" in part.lower()) and i + 1 < len(parts):
                        job_id = parts[i + 1].strip(":")
                        break
                if job_id:
                    break
        
        # Alternative: look for UUID-like patterns
        if not job_id:
            import re
            uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
            matches = re.findall(uuid_pattern, result.stdout, re.IGNORECASE)
            if matches:
                job_id = matches[0]
        
        # Fallback: use timestamp-based ID
        if not job_id:
            import time
            job_id = f"sky-{int(time.time())}"
            logger.warning(f"Could not extract job ID from output, using fallback: {job_id}")
        
        if use_managed_jobs:
            logger.info(f"✅ Launched managed job: {job_id}")
            logger.info(f"View logs: sky jobs logs {job_id}")
            logger.info(f"Check status: sky jobs queue")
            logger.info(f"Cancel job: sky jobs cancel {job_id}")
        else:
            logger.info(f"✅ Launched cluster job: {job_id}")
            logger.info(f"SSH into cluster: ssh <cluster_name>")
            logger.info(f"View logs: sky logs <cluster_name>")
            logger.info(f"Check status: sky status")
        
        return job_id

    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or str(e)
        logger.error(f"❌ Failed to launch SkyPilot job: {error_msg}")
        raise RuntimeError(f"SkyPilot job launch failed: {error_msg}")
    except subprocess.TimeoutExpired:
        logger.error("SkyPilot job launch timed out (>5 minutes)")
        raise RuntimeError("SkyPilot job launch timed out. Check cloud credentials and resources.")


def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Get comprehensive status of a SkyPilot job.
    
    Returns:
        Dict with status, resources, cost estimate, duration, and other metadata
    """
    try:
        # Try to get detailed info from sky jobs queue (for managed jobs)
        result = subprocess.run(
            ["sky", "jobs", "queue"],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        
        # Parse job info from queue output
        lines = result.stdout.split("\n")
        job_info = None
        
        for i, line in enumerate(lines):
            if job_id in line or str(job_id) in line:
                # Found job - parse info from this line and surrounding lines
                job_info = {
                    "job_id": job_id,
                    "status": "unknown",
                    "resources": {},
                    "duration": None,
                    "cost": None,
                }
                
                # Try to extract status
                line_lower = line.lower()
                if "running" in line_lower:
                    job_info["status"] = "RUNNING"
                elif "pending" in line_lower:
                    job_info["status"] = "PENDING"
                elif "succeeded" in line_lower or "completed" in line_lower:
                    job_info["status"] = "SUCCEEDED"
                elif "failed" in line_lower:
                    job_info["status"] = "FAILED"
                elif "cancelled" in line_lower or "canceled" in line_lower:
                    job_info["status"] = "CANCELLED"
                
                # Try to extract resources (GPU type, etc.)
                import re
                gpu_match = re.search(r'(\w+):(\d+)', line)
                if gpu_match:
                    job_info["resources"] = {
                        "accelerator": f"{gpu_match.group(1)}:{gpu_match.group(2)}"
                    }
                
                # Try to extract duration
                duration_match = re.search(r'(\d+[mh]?\s*\d*[sm]?)', line)
                if duration_match:
                    job_info["duration"] = duration_match.group(1)
                
                break
        
        if job_info:
            return job_info
        
        # Fallback: try JSON output
        try:
            result = subprocess.run(
                ["sky", "status", "--json"],
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
            
            jobs = json.loads(result.stdout)
            if isinstance(jobs, list):
                for job in jobs:
                    if job.get("job_id") == job_id or job.get("name", "").endswith(job_id):
                        return {
                            "status": job.get("status", "unknown").upper(),
                            "job_id": job_id,
                            "name": job.get("name", ""),
                            "resources": job.get("resources", {}),
                            "duration": job.get("duration"),
                            "cost": job.get("cost"),
                        }
        except (json.JSONDecodeError, subprocess.CalledProcessError):
            pass
        
        return {"status": "not_found", "job_id": job_id}

    except subprocess.TimeoutExpired:
        logger.error("SkyPilot status check timed out")
        return {"status": "error", "job_id": job_id, "error": "timeout"}
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        return {"status": "error", "job_id": job_id, "error": str(e)}


def get_job_logs(job_id: str, max_lines: int = 1000) -> Dict[str, Any]:
    """
    Get logs from a SkyPilot job.
    
    Args:
        job_id: SkyPilot job ID
        max_lines: Maximum number of log lines to retrieve
    
    Returns:
        Dict with logs, truncated flag, and metadata
    """
    try:
        # Get logs from SkyPilot (no-follow mode to get current logs)
        result = subprocess.run(
            ["sky", "jobs", "logs", "--no-follow", job_id],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,  # 1 minute timeout for log retrieval
        )
        
        logs = result.stdout
        log_lines = logs.split("\n")
        
        # Truncate if too long
        truncated = len(log_lines) > max_lines
        if truncated:
            log_lines = log_lines[-max_lines:]  # Keep last N lines
            logs = "\n".join(log_lines)
        
        return {
            "logs": logs,
            "line_count": len(log_lines),
            "truncated": truncated,
            "job_id": job_id,
        }
        
    except subprocess.CalledProcessError as e:
        logger.warning(f"Could not get logs for job {job_id}: {e.stderr}")
        return {
            "logs": "",
            "line_count": 0,
            "truncated": False,
            "job_id": job_id,
            "error": str(e.stderr),
        }
    except subprocess.TimeoutExpired:
        logger.warning(f"Log retrieval timed out for job {job_id}")
        return {
            "logs": "",
            "line_count": 0,
            "truncated": False,
            "job_id": job_id,
            "error": "timeout",
        }
    except Exception as e:
        logger.error(f"Failed to get job logs: {e}")
        return {
            "logs": "",
            "line_count": 0,
            "truncated": False,
            "job_id": job_id,
            "error": str(e),
        }


def stop_job(job_id: str) -> bool:
    """Stop a running SkyPilot job."""
    try:
        subprocess.run(
            ["sky", "cancel", job_id],
            capture_output=True,
            text=True,
            check=True,
        )
        logger.info(f"Stopped job: {job_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to stop job {job_id}: {e}")
        return False


def launch_training_job(run_id: str, config: Dict[str, Any], env_spec: Optional[Dict[str, Any]] = None, use_managed_jobs: bool = True) -> str:
    """
    Main function to launch a training job via SkyPilot.
    
    Args:
        run_id: Unique identifier for the training run
        config: Configuration dict with:
            - accelerator: GPU type (e.g., "A10:1", "A100:2")
            - use_spot: Use spot instances (default: False, set True for ~70% cost savings)
            - metrics_interval: How often to send metrics
            - workdir: Local directory to sync (default: ".")
            - checkpoint_bucket: Cloud bucket for checkpoints (optional)
            - autostop_minutes: Auto-stop cluster after idle time (optional)
            - max_restarts: Max restarts on errors (default: 3, for spot instances)
            - cloud: Cloud provider (optional, auto-selects cheapest)
        env_spec: Environment specification (optional, for metadata)
        use_managed_jobs: If True, use managed jobs (auto-recovery, spot support)
                         If False, use cluster jobs (interactive, SSH-able)
    
    Returns:
        SkyPilot job ID
    
    Note:
        Managed jobs (`sky jobs launch`) are recommended for production training:
        - Auto-recovery from spot preemptions
        - Automatic cleanup when done
        - Better for scaling to many jobs
        
        Cluster jobs (`sky launch`) are better for interactive development:
        - SSH access for debugging
        - Manual control over lifecycle
    """
    # Create temp directory for YAML
    temp_dir = Path("/tmp/rl-studio-jobs")
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    yaml_path = temp_dir / f"{run_id}.yaml"
    
    # Generate YAML with proper SkyPilot configuration
    generate_skypilot_yaml(run_id, config, str(yaml_path), env_spec)
    
    # Launch job (managed or cluster)
    job_id = launch_skypilot_job(str(yaml_path), use_managed_jobs=use_managed_jobs)
    
    return job_id

