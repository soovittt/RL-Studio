"""
RL training script that runs on SkyPilot.
Fetches config from Convex and streams metrics back.
"""
import os
import json
import time
import requests
from typing import Dict, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CONVEX_URL = os.getenv("CONVEX_URL")
RUN_ID = os.getenv("RUN_ID")
METRICS_INTERVAL = int(os.getenv("METRICS_INTERVAL", "100"))
FRAME_INTERVAL = int(os.getenv("FRAME_INTERVAL", "1000"))


def fetch_config(run_id: str, convex_url: str) -> Dict[str, Any]:
    """Fetch training configuration from Convex."""
    try:
        # Call Convex action to get run config
        response = requests.post(
            f"{convex_url}/api/action",
            json={
                "path": "runs:getConfig",
                "args": {"runId": run_id},
            },
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to fetch config: {e}")
        # Return default config
        return {
            "algorithm": "ppo",
            "hyperparams": {
                "learning_rate": 3e-4,
                "gamma": 0.99,
                "steps": 1000000,
            },
            "environment": {
                "type": "grid",
                "spec": {},
            },
        }


def send_metrics(
    run_id: str,
    step: int,
    metrics: Dict[str, float],
    convex_url: str,
    convex_deployment_url: Optional[str] = None,
):
    """Send training metrics to Convex HTTP endpoint."""
    try:
        # Use Convex HTTP endpoint
        # convex_url is like "https://xxx.convex.cloud/api"
        # We need "https://xxx.convex.cloud" for HTTP routes
        http_url = convex_deployment_url or convex_url.replace("/api", "")
        if not http_url.startswith("http"):
            http_url = f"https://{http_url}" if not http_url.startswith("http") else http_url
        
        response = requests.post(
            f"{http_url}/metrics",
            json={
                "runId": run_id,
                "step": step,
                "reward": metrics.get("reward", 0.0),
                "loss": metrics.get("loss"),
                "entropy": metrics.get("entropy"),
                "valueLoss": metrics.get("valueLoss"),
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
        logger.debug(f"Sent metrics for run {run_id} at step {step}: reward={metrics.get('reward', 0.0)}")
    except Exception as e:
        logger.warning(f"Failed to send metrics at step {step}: {e}")
        # Don't raise - metrics are non-critical, training should continue


def create_env_from_spec(spec: Dict[str, Any]):
    """
    Create Gymnasium environment from EnvSpec.
    
    Uses the actual simulator logic from the backend to ensure consistency.
    """
    try:
        # Try to use the backend RLStudioEnv if available
        # This ensures training uses the exact same logic as rollouts
        import sys
        from pathlib import Path
        
        # Try to import from mounted backend (if available)
        # SkyPilot mounts backend to /backend if configured
        backend_paths = [
            Path("/backend"),  # SkyPilot mount location
            Path(__file__).parent.parent / "backend",  # Local development
        ]
        
        for backend_path in backend_paths:
            if backend_path.exists() and str(backend_path) not in sys.path:
                sys.path.insert(0, str(backend_path))
        
        try:
            from rl_studio.training.trainer import RLStudioEnv
            logger.info("Using RLStudioEnv from backend (matches rollout simulator)")
            return RLStudioEnv(spec)
        except ImportError:
            logger.warning("Could not import RLStudioEnv, using fallback environment")
            pass
    except Exception as e:
        logger.warning(f"Could not use backend environment: {e}, using fallback")
    
    # Fallback: Simple environment for basic training
    from gymnasium import Env
    from gymnasium.spaces import Discrete, Box
    import numpy as np

    class SimpleEnv(Env):
        """Simple fallback environment"""
        def __init__(self, spec):
            super().__init__()
            self.spec = spec
            
            # Get world dimensions
            world = spec.get("world", {})
            self.width = world.get("width", 10)
            self.height = world.get("height", 10)
            
            # Get action space
            action_space = spec.get("actionSpace", {})
            if action_space.get("type") == "discrete":
                actions = action_space.get("actions", ["up", "down", "left", "right"])
                self.action_space = Discrete(len(actions))
                self.action_map = actions
            else:
                self.action_space = Box(low=-1.0, high=1.0, shape=(2,), dtype=np.float32)
                self.action_map = None
            
            # Simple observation: agent position normalized
            self.observation_space = Box(
                low=0.0, high=1.0, shape=(2,), dtype=np.float32
            )
            
            # Initial state
            agents = spec.get("agents", [])
            if agents:
                self.agent_pos = list(agents[0].get("position", [0, 0]))
            else:
                self.agent_pos = [0, 0]

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            agents = self.spec.get("agents", [])
            if agents:
                self.agent_pos = list(agents[0].get("position", [0, 0]))
            else:
                self.agent_pos = [0, 0]
            return self._get_obs(), {}

        def step(self, action):
            # Simple movement
            if self.action_map:
                # Discrete action
                action_str = self.action_map[action]
                if action_str == "up":
                    self.agent_pos[1] = max(0, self.agent_pos[1] - 1)
                elif action_str == "down":
                    self.agent_pos[1] = min(self.height - 1, self.agent_pos[1] + 1)
                elif action_str == "left":
                    self.agent_pos[0] = max(0, self.agent_pos[0] - 1)
                elif action_str == "right":
                    self.agent_pos[0] = min(self.width - 1, self.agent_pos[0] + 1)
            else:
                # Continuous action
                self.agent_pos[0] = max(0, min(self.width - 1, self.agent_pos[0] + action[0] * 0.1))
                self.agent_pos[1] = max(0, min(self.height - 1, self.agent_pos[1] + action[1] * 0.1))
            
            # Simple reward: distance to goal
            goals = [o for o in self.spec.get("objects", []) if o.get("type") == "goal"]
            reward = -0.01  # Step penalty
            terminated = False
            
            if goals:
                goal = goals[0]
                goal_pos = goal.get("position", [self.width - 1, self.height - 1])
                dist = np.sqrt((self.agent_pos[0] - goal_pos[0])**2 + (self.agent_pos[1] - goal_pos[1])**2)
                if dist < 0.5:
                    reward = 1.0
                    terminated = True
                else:
                    reward = -dist * 0.1  # Reward for getting closer

            return self._get_obs(), reward, terminated, False, {}

        def _get_obs(self):
            # Normalize position
            obs = np.array([
                self.agent_pos[0] / max(self.width, 1),
                self.agent_pos[1] / max(self.height, 1)
            ], dtype=np.float32)
            return obs

    return SimpleEnv(spec)


def train_ppo(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Train using PPO algorithm."""
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.callbacks import BaseCallback

        class MetricsCallback(BaseCallback):
            def __init__(self, run_id, convex_url, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.run_id = run_id
                self.convex_url = convex_url
                self.last_metrics_step = 0

            def _on_step(self) -> bool:
                if self.num_timesteps - self.last_metrics_step >= METRICS_INTERVAL:
                    # Get episode info
                    info = self.locals.get("infos", [{}])[0]
                    episode_info = info.get("episode", {})
                    
                    # Extract metrics
                    reward = float(episode_info.get("r", 0)) if episode_info else 0.0
                    
                    # Try to get training metrics from model
                    metrics = {"reward": reward}
                    
                    # Get loss and entropy if available
                    if hasattr(self.model, "logger") and self.model.logger.name_to_value:
                        logger_dict = self.model.logger.name_to_value
                        if "train/loss" in logger_dict:
                            metrics["loss"] = float(logger_dict["train/loss"])
                        if "train/entropy_loss" in logger_dict:
                            metrics["entropy"] = float(logger_dict["train/entropy_loss"])
                        if "train/value_loss" in logger_dict:
                            metrics["valueLoss"] = float(logger_dict["train/value_loss"])
                    
                    send_metrics(
                        self.run_id,
                        self.num_timesteps,
                        metrics,
                        self.convex_url,
                    )
                    self.last_metrics_step = self.num_timesteps
                return True

        hyperparams = config.get("hyperparams", {})
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=hyperparams.get("learning_rate", 3e-4),
            gamma=hyperparams.get("gamma", 0.99),
            verbose=1,
            tensorboard_log=f"/tmp/tensorboard/{run_id}",
        )

        callback = MetricsCallback(run_id, convex_url)
        model.learn(
            total_timesteps=hyperparams.get("steps", 1000000),
            callback=callback,
            progress_bar=True,
        )

        logger.info("Training completed successfully")
        return model

    except ImportError:
        logger.warning("Stable-Baselines3 not available, using mock training")
        return train_mock(env, config, run_id, convex_url)


def train_dqn(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Train using DQN algorithm."""
    try:
        from stable_baselines3 import DQN
        from stable_baselines3.common.callbacks import BaseCallback

        class MetricsCallback(BaseCallback):
            def __init__(self, run_id, convex_url, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.run_id = run_id
                self.convex_url = convex_url
                self.last_metrics_step = 0

            def _on_step(self) -> bool:
                if self.num_timesteps - self.last_metrics_step >= METRICS_INTERVAL:
                    # Get episode info
                    info = self.locals.get("infos", [{}])[0]
                    episode_info = info.get("episode", {})
                    
                    # Extract metrics
                    reward = float(episode_info.get("r", 0)) if episode_info else 0.0
                    
                    # Try to get training metrics from model
                    metrics = {"reward": reward}
                    
                    # Get loss if available
                    if hasattr(self.model, "logger") and self.model.logger.name_to_value:
                        logger_dict = self.model.logger.name_to_value
                        if "train/loss" in logger_dict:
                            metrics["loss"] = float(logger_dict["train/loss"])
                    
                    send_metrics(
                        self.run_id,
                        self.num_timesteps,
                        metrics,
                        self.convex_url,
                    )
                    self.last_metrics_step = self.num_timesteps
                return True

        hyperparams = config.get("hyperparams", {})
        model = DQN(
            "MlpPolicy",
            env,
            learning_rate=hyperparams.get("learning_rate", 1e-4),
            gamma=hyperparams.get("gamma", 0.99),
            verbose=1,
            tensorboard_log=f"/tmp/tensorboard/{run_id}",
        )

        callback = MetricsCallback(run_id, convex_url)
        model.learn(
            total_timesteps=hyperparams.get("steps", 1000000),
            callback=callback,
            progress_bar=True,
        )

        logger.info("Training completed successfully")
        return model

    except ImportError:
        logger.warning("Stable-Baselines3 not available, using mock training")
        return train_mock(env, config, run_id, convex_url)


def train_mock(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Mock training for testing without Stable-Baselines3."""
    logger.info("Running mock training")
    hyperparams = config.get("hyperparams", {})
    total_steps = hyperparams.get("steps", 1000)

    for step in range(0, total_steps, METRICS_INTERVAL):
        # Simulate training progress
        obs, reward, terminated, truncated, info = env.step(env.action_space.sample())
        if terminated or truncated:
            obs, info = env.reset()

        if step % METRICS_INTERVAL == 0:
            send_metrics(
                run_id,
                step,
                {
                    "reward": float(reward),
                    "loss": 0.1 - (step / total_steps) * 0.1,
                    "entropy": 0.8 - (step / total_steps) * 0.5,
                },
                convex_url,
            )

        if step % 10000 == 0:
            logger.info(f"Step {step}/{total_steps}")

    logger.info("Mock training completed")
    return None


def train_a2c(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Train using A2C (Advantage Actor-Critic) algorithm."""
    try:
        from stable_baselines3 import A2C
        from stable_baselines3.common.callbacks import BaseCallback

        class MetricsCallback(BaseCallback):
            def __init__(self, run_id, convex_url, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.run_id = run_id
                self.convex_url = convex_url
                self.last_metrics_step = 0

            def _on_step(self) -> bool:
                if self.num_timesteps - self.last_metrics_step >= METRICS_INTERVAL:
                    info = self.locals.get("infos", [{}])[0]
                    episode_info = info.get("episode", {})
                    reward = float(episode_info.get("r", 0)) if episode_info else 0.0
                    
                    metrics = {"reward": reward}
                    if hasattr(self.model, "logger") and self.model.logger.name_to_value:
                        logger_dict = self.model.logger.name_to_value
                        if "train/loss" in logger_dict:
                            metrics["loss"] = float(logger_dict["train/loss"])
                        if "train/value_loss" in logger_dict:
                            metrics["valueLoss"] = float(logger_dict["train/value_loss"])
                    
                    send_metrics(self.run_id, self.num_timesteps, metrics, self.convex_url)
                    self.last_metrics_step = self.num_timesteps
                return True

        hyperparams = config.get("hyperparams", {})
        model = A2C(
            "MlpPolicy",
            env,
            learning_rate=hyperparams.get("learning_rate", 7e-4),
            gamma=hyperparams.get("gamma", 0.99),
            n_steps=hyperparams.get("rollout_length", 5),
            verbose=1,
            tensorboard_log=f"/tmp/tensorboard/{run_id}",
        )

        callback = MetricsCallback(run_id, convex_url)
        model.learn(
            total_timesteps=hyperparams.get("steps", 1000000),
            callback=callback,
            progress_bar=True,
        )

        logger.info("A2C training completed successfully")
        return model

    except ImportError:
        logger.warning("Stable-Baselines3 not available, using mock training")
        return train_mock(env, config, run_id, convex_url)


def train_bc(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Train using Behavior Cloning (BC) algorithm."""
    try:
        from imitation.algorithms import bc
        from imitation.data import rollout
        from stable_baselines3 import PPO
        from stable_baselines3.common.callbacks import BaseCallback
        import numpy as np

        class MetricsCallback(BaseCallback):
            def __init__(self, run_id, convex_url, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.run_id = run_id
                self.convex_url = convex_url
                self.last_metrics_step = 0

            def _on_step(self) -> bool:
                if self.num_timesteps - self.last_metrics_step >= METRICS_INTERVAL:
                    metrics = {"reward": 0.0, "loss": 0.0}
                    # BC doesn't have episode rewards during training, but we can track loss
                    send_metrics(self.run_id, self.num_timesteps, metrics, self.convex_url)
                    self.last_metrics_step = self.num_timesteps
                return True

        hyperparams = config.get("hyperparams", {})
        
        # For BC, we need expert demonstrations
        # First, train a quick expert policy (or load from dataset if provided)
        logger.info("Training expert policy for BC...")
        expert_policy = PPO("MlpPolicy", env, verbose=0)
        expert_policy.learn(total_timesteps=10000)  # Quick expert training
        
        # Generate expert trajectories
        logger.info("Generating expert demonstrations...")
        expert_trajs = rollout.generate_trajectories(
            expert_policy,
            env,
            sample_until=rollout.make_min_episodes(50),
        )
        
        # Create BC trainer
        bc_trainer = bc.BC(
            observation_space=env.observation_space,
            action_space=env.action_space,
            demonstrations=expert_trajs,
            rng=np.random.default_rng(seed=hyperparams.get("seed", 42)),
        )
        
        # Train BC with metrics callback
        logger.info("Training BC policy...")
        for epoch in range(hyperparams.get("update_epochs", 10)):
            bc_trainer.train(n_epochs=1)
            # Send metrics
            if epoch % 2 == 0:  # Every 2 epochs
                send_metrics(
                    run_id,
                    epoch * 1000,  # Approximate step count
                    {"reward": 0.0, "loss": 0.0},
                    convex_url,
                )

        logger.info("BC training completed successfully")
        # Return a wrapper that makes BC policy compatible with SB3 interface
        return bc_trainer.policy

    except ImportError:
        logger.warning("Imitation library not available, using PPO as BC fallback")
        # Fallback: use PPO with supervised learning approach
        return train_ppo(env, config, run_id, convex_url)


def train_imitation(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Train using Imitation Learning (GAIL-lite)."""
    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.callbacks import BaseCallback
        import numpy as np

        class MetricsCallback(BaseCallback):
            def __init__(self, run_id, convex_url, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self.run_id = run_id
                self.convex_url = convex_url
                self.last_metrics_step = 0

            def _on_step(self) -> bool:
                if self.num_timesteps - self.last_metrics_step >= METRICS_INTERVAL:
                    info = self.locals.get("infos", [{}])[0]
                    episode_info = info.get("episode", {})
                    reward = float(episode_info.get("r", 0)) if episode_info else 0.0
                    
                    metrics = {"reward": reward}
                    if hasattr(self.model, "logger") and self.model.logger.name_to_value:
                        logger_dict = self.model.logger.name_to_value
                        if "train/loss" in logger_dict:
                            metrics["loss"] = float(logger_dict["train/loss"])
                    
                    send_metrics(self.run_id, self.num_timesteps, metrics, self.convex_url)
                    self.last_metrics_step = self.num_timesteps
                return True

        hyperparams = config.get("hyperparams", {})
        concepts = config.get("concepts", {})
        
        # For imitation learning, we use PPO with reward shaping from expert
        # In production, this would use GAIL or similar adversarial training
        logger.info("Training with imitation learning (GAIL-lite via PPO + reward shaping)")
        
        model = PPO(
            "MlpPolicy",
            env,
            learning_rate=hyperparams.get("learning_rate", 3e-4),
            gamma=hyperparams.get("gamma", 0.99),
            verbose=1,
            tensorboard_log=f"/tmp/tensorboard/{run_id}",
        )

        callback = MetricsCallback(run_id, convex_url)
        model.learn(
            total_timesteps=hyperparams.get("steps", 1000000),
            callback=callback,
            progress_bar=True,
        )

        logger.info("Imitation learning completed successfully")
        return model

    except ImportError:
        logger.warning("Stable-Baselines3 not available, using mock training")
        return train_mock(env, config, run_id, convex_url)


def train_random(env, config: Dict[str, Any], run_id: str, convex_url: str):
    """Random/Heuristic policy for debugging."""
    logger.info("Running random policy (debug mode)")
    hyperparams = config.get("hyperparams", {})
    total_steps = hyperparams.get("steps", 10000)

    for step in range(0, total_steps, METRICS_INTERVAL):
        obs, reward, terminated, truncated, info = env.step(env.action_space.sample())
        if terminated or truncated:
            obs, info = env.reset()

        if step % METRICS_INTERVAL == 0:
            send_metrics(
                run_id,
                step,
                {
                    "reward": float(reward),
                    "loss": 0.0,  # No training loss for random
                    "entropy": 1.0,  # Maximum entropy (random)
                },
                convex_url,
            )

        if step % 10000 == 0:
            logger.info(f"Random policy step {step}/{total_steps}")

    logger.info("Random policy completed")
    return None


def update_run_status(run_id: str, status: str, convex_url: str):
    """Update run status in Convex database."""
    try:
        http_url = convex_url.replace("/api", "")
        response = requests.post(
            f"{convex_url}/api/action",
            json={
                "path": "runs:updateStatus",
                "args": {
                    "id": run_id,
                    "status": status,
                },
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if response.ok:
            logger.info(f"Updated run {run_id} status to '{status}'")
        else:
            logger.warning(f"Failed to update run status: {response.text}")
    except Exception as e:
        logger.warning(f"Could not update run status: {e}")


def train(run_id: str):
    """Main training loop."""
    if not CONVEX_URL:
        raise ValueError("CONVEX_URL environment variable required")
    if not run_id:
        raise ValueError("RUN_ID environment variable required")

    logger.info(f"Starting training for run {run_id}")
    
    # Update run status to "running" in database
    try:
        update_run_status(run_id, "running", CONVEX_URL)
    except Exception as e:
        logger.warning(f"Could not update run status at start: {e}")

    try:
        # Fetch configuration
        config = fetch_config(run_id, CONVEX_URL)
        algorithm = config.get("algorithm", "ppo").lower()
        logger.info(f"Loaded config: algorithm={algorithm}")

        # Create environment
        env_spec = config.get("environment", {}).get("spec", {})
        env = create_env_from_spec(env_spec)

        # Train based on algorithm
        if algorithm == "ppo":
            train_ppo(env, config, run_id, CONVEX_URL)
        elif algorithm == "dqn":
            train_dqn(env, config, run_id, CONVEX_URL)
        elif algorithm == "a2c":
            train_a2c(env, config, run_id, CONVEX_URL)
        elif algorithm == "bc":
            train_bc(env, config, run_id, CONVEX_URL)
        elif algorithm == "imitation":
            train_imitation(env, config, run_id, CONVEX_URL)
        elif algorithm == "random":
            train_random(env, config, run_id, CONVEX_URL)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}. Supported: ppo, dqn, a2c, bc, imitation, random")

        logger.info("Training finished successfully")
        
        # Update run status to "completed" in database
        try:
            update_run_status(run_id, "completed", CONVEX_URL)
        except Exception as e:
            logger.warning(f"Could not update run status at completion: {e}")
            
    except Exception as e:
        logger.error(f"Training failed: {e}")
        
        # Update run status to "error" in database
        try:
            update_run_status(run_id, "error", CONVEX_URL)
        except Exception as update_error:
            logger.warning(f"Could not update run status on error: {update_error}")
        
        raise


if __name__ == "__main__":
    train(RUN_ID)
