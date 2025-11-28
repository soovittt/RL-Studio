"""
Model loading utility for running rollouts with trained models.
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def fetch_model_url_from_convex(run_id: str, convex_url: str) -> Optional[str]:
    """Fetch model URL from Convex for a given run ID."""
    try:
        import requests

        # Call Convex action to get model
        http_url = convex_url.replace("/api", "")
        if not http_url.startswith("http"):
            http_url = (
                f"https://{http_url}" if not http_url.startswith("http") else http_url
            )

        response = requests.post(
            f"{http_url}/api/action",
            json={
                "path": "models:get",
                "args": {"runId": run_id},
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.ok:
            data = response.json()
            if data and "modelUrl" in data:
                return data["modelUrl"]

        return None
    except Exception as e:
        logger.error(f"Failed to fetch model URL from Convex: {e}")
        return None


def detect_algorithm_from_model(model_path: str) -> str:
    """
    Detect algorithm from model files.
    Stable-Baselines3 saves models with algorithm name in files.
    """
    model_path_obj = Path(model_path)

    # Check for algorithm-specific files
    if (model_path_obj / "policy.pth").exists() or (
        model_path_obj / "policy.zip"
    ).exists():
        # Check metadata or config files
        try:
            # Try to read config or metadata
            config_file = model_path_obj / "config.json"
            if config_file.exists():
                import json

                with open(config_file) as f:
                    config = json.load(f)
                    if "algorithm" in config:
                        return config["algorithm"].lower()
        except:
            pass

        # Default to PPO if we can't detect
        return "ppo"

    # Check file extension or naming
    if "dqn" in str(model_path).lower():
        return "dqn"
    elif "a2c" in str(model_path).lower():
        return "a2c"
    elif "ppo" in str(model_path).lower():
        return "ppo"

    # Default
    return "ppo"


def load_model_for_inference(
    model_url: Optional[str] = None,
    run_id: Optional[str] = None,
    convex_url: Optional[str] = None,
) -> Optional[Any]:
    """
    Load trained model for inference.

    Args:
        model_url: Direct model URL (s3://, gs://, or file://)
        run_id: Run ID to fetch model URL from Convex
        convex_url: Convex URL for fetching model metadata

    Returns:
        Loaded model object or None if failed
    """
    try:
        # If run_id provided, fetch model URL from Convex
        if run_id and not model_url and convex_url:
            model_url = fetch_model_url_from_convex(run_id, convex_url)
            if not model_url:
                logger.error(f"Could not fetch model URL for run {run_id}")
                return None

        if not model_url:
            logger.error("No model URL provided")
            return None

        # Download model to temp directory
        temp_dir = tempfile.mkdtemp()
        local_path = os.path.join(temp_dir, "model")

        # Download from storage if needed
        if model_url.startswith("s3://") or model_url.startswith("gs://"):
            from ..utils.storage import download_model

            if not download_model(model_url, local_path):
                logger.error(f"Failed to download model from {model_url}")
                return None
        elif model_url.startswith("file://"):
            local_path = model_url.replace("file://", "")
        else:
            # Assume it's already a local path
            local_path = model_url

        # Detect algorithm
        algorithm = detect_algorithm_from_model(local_path)
        logger.info(f"Detected algorithm: {algorithm}")

        # Load model based on algorithm
        if algorithm == "ppo":
            from stable_baselines3 import PPO

            model = PPO.load(local_path)
        elif algorithm == "dqn":
            from stable_baselines3 import DQN

            model = DQN.load(local_path)
        elif algorithm == "a2c":
            from stable_baselines3 import A2C

            model = A2C.load(local_path)
        else:
            logger.error(f"Unsupported algorithm: {algorithm}")
            return None

        logger.info(f"Model loaded successfully from {model_url}")
        return model

    except ImportError as e:
        logger.error(f"Failed to import model class: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return None


def run_rollout_with_model(
    env_spec: Dict[str, Any], model: Any, max_steps: int = 100
) -> Dict[str, Any]:
    """
    Run rollout using trained model.

    Args:
        env_spec: Environment specification
        model: Loaded model object
        max_steps: Maximum steps

    Returns:
        Rollout result dictionary
    """
    from ..rollout.simulator import create_initial_state, step_simulator
    from ..training.trainer import RLStudioEnv

    try:
        # Create environment
        env = RLStudioEnv(env_spec)

        # Run episode
        obs, _ = env.reset()
        state = create_initial_state(env_spec)
        steps = []
        done = False

        while not done and state["step"] < max_steps:
            # Get action from model
            action, _ = model.predict(obs, deterministic=True)

            # Convert action to env_spec format
            if hasattr(env, "action_map") and env.action_map:
                # Discrete action - map to action string
                if isinstance(action, (list, tuple)):
                    action_idx = int(action[0])
                else:
                    action_idx = int(action)
                action_str = env.action_map[action_idx]
            else:
                # Continuous action - convert to list
                if hasattr(action, "tolist"):
                    action_str = action.tolist()
                elif isinstance(action, (list, tuple)):
                    action_str = list(action)
                else:
                    action_str = [float(action)]

            # Step environment
            state = step_simulator(state, action_str, env_spec, max_steps)

            # Get new observation
            obs = env._get_observation()

            # Create step
            step = {
                "state": {
                    "agents": state.get("agents", []),
                    "objects": state.get("objects", []),
                    "step": state.get("step", 0),
                    "totalReward": state.get("totalReward", 0),
                    "done": state.get("done", False),
                    "info": state.get("info", {}),
                },
                "action": action_str,
                "reward": state.get("totalReward", 0)
                - (steps[-1]["state"]["totalReward"] if steps else 0),
                "done": state.get("done", False),
            }
            steps.append(step)

            done = state.get("done", False)

        # Determine success
        success = False
        if state.get("done") and state.get("totalReward", 0) > 0:
            # Check if goal was reached
            for obj in state.get("objects", []):
                if obj.get("type") == "goal":
                    for agent in state.get("agents", []):
                        if agent.get("position") == obj.get("position"):
                            success = True
                            break

        return {
            "success": success,
            "steps": steps,
            "totalReward": state.get("totalReward", 0),
            "episodeLength": state.get("step", 0),
            "terminationReason": (
                "goal_reached"
                if success
                else "max_steps" if state["step"] >= max_steps else "unknown"
            ),
        }

    except Exception as e:
        logger.error(f"Failed to run rollout with model: {e}")
        import traceback

        traceback.print_exc()
        return {
            "success": False,
            "steps": [],
            "totalReward": 0,
            "episodeLength": 0,
            "terminationReason": f"error: {str(e)}",
        }
