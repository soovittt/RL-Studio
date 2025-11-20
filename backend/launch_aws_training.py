#!/usr/bin/env python3
"""
Launch a real training job on AWS GPU from your local machine.
This uses SkyPilot to provision an AWS GPU instance and run training there.
"""
import os
import sys
from pathlib import Path
import uuid

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from rl_studio.training.orchestrator import launch_training_job
from rl_studio.training.aws_setup import setup_infrastructure
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_simple_env_spec():
    """Create a simple grid environment for testing."""
    return {
        "id": "test-env",
        "name": "Test Grid Environment",
        "envType": "grid",
        "world": {
            "width": 10,
            "height": 10,
            "coordinateSystem": "grid"
        },
        "agents": [
            {
                "id": "agent1",
                "position": [1, 1],
                "type": "agent"
            }
        ],
        "objects": [
            {
                "id": "goal1",
                "type": "goal",
                "position": [8, 8]
            }
        ],
        "actionSpace": {
            "type": "discrete",
            "actions": ["up", "down", "left", "right", "stay"]
        },
        "observationSpace": {
            "type": "grid",
            "width": 10,
            "height": 10
        },
        "rules": {
            "rewards": [
                {
                    "id": "reach_goal",
                    "type": "reward",
                    "condition": {
                        "type": "agent_at_object",
                        "agentId": "agent1",
                        "objectId": "goal1"
                    },
                    "reward": 10.0,
                    "value": 10.0,
                    "description": "Reward for reaching goal"
                },
                {
                    "id": "step_penalty",
                    "type": "reward",
                    "condition": {
                        "type": "timeout"
                    },
                    "reward": -0.01,
                    "value": -0.01,
                    "description": "Small penalty per step"
                }
            ],
            "terminations": [
                {
                    "id": "reach_goal",
                    "condition": {
                        "type": "agent_at_object",
                        "agentId": "agent1",
                        "objectId": "goal1"
                    },
                    "description": "Terminate when goal is reached"
                },
                {
                    "id": "max_steps",
                    "condition": {
                        "type": "timeout"
                    },
                    "description": "Terminate after max steps"
                }
            ]
        }
    }

def launch_aws_training():
    """Launch a training job on AWS GPU."""
    logger.info("🚀 Setting up infrastructure...")
    
    # Verify infrastructure
    setup_result = setup_infrastructure()
    if not setup_result.get("skypilot_installed"):
        logger.error("❌ SkyPilot not installed. Please install it first.")
        return False
    
    if not setup_result.get("aws_configured"):
        logger.error("❌ AWS credentials not configured. Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to backend/.env")
        return False
    
    if not setup_result.get("aws_accessible"):
        logger.error("❌ AWS not accessible. Please check your credentials.")
        return False
    
    logger.info("✅ Infrastructure ready!")
    
    # Create environment spec
    env_spec = create_simple_env_spec()
    logger.info("✅ Created test environment spec")
    
    # Generate unique run ID
    run_id = f"test-run-{uuid.uuid4().hex[:8]}"
    logger.info(f"📝 Run ID: {run_id}")
    
    # Training configuration
    config = {
        "accelerator": "A10:1",  # AWS GPU type
        "use_spot": True,  # Use spot instances for ~70% cost savings
        "metrics_interval": 100,
        "workdir": str(Path(__file__).parent / "training"),  # Sync training directory
        "autostop_minutes": 30,  # Auto-stop after 30 min of idleness
        "max_restarts": 3,  # Auto-restart on spot preemption
    }
    
    # Get Convex URL for metrics streaming
    convex_url = os.getenv("CONVEX_URL")
    if convex_url:
        logger.info(f"✅ Convex URL found: {convex_url}")
    else:
        logger.warning("⚠️ CONVEX_URL not set. Metrics won't be streamed.")
    
    logger.info("🚀 Launching training job on AWS GPU...")
    logger.info(f"   GPU: {config['accelerator']}")
    logger.info(f"   Spot instances: {config['use_spot']} (70% cost savings)")
    logger.info(f"   Workdir: {config['workdir']}")
    
    try:
        # Launch the job
        job_id = launch_training_job(
            run_id=run_id,
            config=config,
            env_spec=env_spec,
            use_managed_jobs=True  # Use managed jobs for auto-recovery
        )
        
        logger.info(f"✅ Training job launched successfully!")
        logger.info(f"   Job ID: {job_id}")
        logger.info(f"   Run ID: {run_id}")
        logger.info("")
        logger.info("📊 Monitor your training:")
        logger.info(f"   sky jobs logs {job_id}")
        logger.info(f"   sky jobs status {job_id}")
        logger.info("")
        logger.info("💰 Cost estimate:")
        logger.info("   A10:1 GPU: ~$0.30/hour (spot) or ~$1.00/hour (on-demand)")
        logger.info("   This test run: ~$0.10-0.30 (depending on duration)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to launch training job: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 RL Studio - AWS GPU Training Launcher")
    print("=" * 60)
    print()
    print("This will launch a real training job on AWS GPU.")
    print("Cost: ~$0.10-0.30 for a short test run (spot instances)")
    print()
    
    response = input("Continue? (yes/no): ").strip().lower()
    if response not in ["yes", "y"]:
        print("Cancelled.")
        sys.exit(0)
    
    success = launch_aws_training()
    if success:
        print()
        print("=" * 60)
        print("✅ Training job launched on AWS GPU!")
        print("=" * 60)
        sys.exit(0)
    else:
        print()
        print("=" * 60)
        print("❌ Failed to launch training job")
        print("=" * 60)
        sys.exit(1)

