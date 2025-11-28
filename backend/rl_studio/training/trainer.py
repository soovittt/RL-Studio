"""
RL Trainer using Stable-Baselines3
Professional RL training with PPO, DQN, and other algorithms
"""

from typing import Any, Callable, Dict, List, Optional

import gymnasium as gym
import numpy as np
import torch
from gymnasium import spaces
from stable_baselines3 import A2C, DQN, PPO, SAC, TD3
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.vec_env import DummyVecEnv

from ..rollout.simulator import (
    Vec2,
    create_initial_state,
    step_simulator,
    validate_env_spec,
)


class TrainingMetricsCallback(BaseCallback):
    """Callback to track training metrics"""

    def __init__(self, metrics_callback: Optional[Callable] = None):
        super().__init__()
        self.metrics_callback = metrics_callback
        self.episode_rewards = []
        self.episode_lengths = []
        self.current_episode_reward = 0
        self.current_episode_length = 0

    def _on_step(self) -> bool:
        # Track rewards
        if len(self.locals.get("infos", [])) > 0:
            info = self.locals["infos"][0]
            reward = self.locals.get("rewards", [0])[0]

            self.current_episode_reward += reward
            self.current_episode_length += 1

            if info.get("episode"):
                # Episode done
                self.episode_rewards.append(self.current_episode_reward)
                self.episode_lengths.append(self.current_episode_length)

                if self.metrics_callback:
                    self.metrics_callback(
                        {
                            "step": self.num_timesteps,
                            "reward": self.current_episode_reward,
                            "episode_length": self.current_episode_length,
                            "mean_reward": (
                                np.mean(self.episode_rewards[-100:])
                                if self.episode_rewards
                                else 0
                            ),
                        }
                    )

                self.current_episode_reward = 0
                self.current_episode_length = 0

        return True


class RLStudioEnv(gym.Env):
    """Gymnasium environment wrapper for RL Studio EnvSpec"""

    def __init__(self, env_spec: Dict[str, Any], max_steps: int = 1000):
        super().__init__()
        self.env_spec = env_spec
        self.state = None
        self.max_steps = max_steps

        # Validate environment
        validation = validate_env_spec(env_spec)
        # Handle both tuple and dict returns
        if isinstance(validation, tuple):
            is_valid, error_msg = validation
            if not is_valid:
                raise ValueError(f"Invalid env_spec: {error_msg}")
        elif isinstance(validation, dict):
            if not validation.get("valid", False):
                raise ValueError(
                    f"Invalid env_spec: {validation.get('error', 'Unknown error')}"
                )

        # Define action space
        action_space_spec = env_spec.get("actionSpace", {})
        if action_space_spec.get("type") == "discrete":
            actions = action_space_spec.get("actions", ["up", "down", "left", "right"])
            self.action_space = spaces.Discrete(len(actions))
            self.action_map = actions
        else:
            # Continuous action space
            self.action_space = spaces.Box(
                low=-1.0, high=1.0, shape=(2,), dtype=np.float32
            )
            self.action_map = None

        # Define observation space
        # For now, use agent position + goal positions as observation
        world = env_spec.get("world", {})
        if world.get("coordinateSystem") == "grid":
            # Grid: discrete positions
            obs_dim = (
                2
                + len(
                    [o for o in env_spec.get("objects", []) if o.get("type") == "goal"]
                )
                * 2
            )
            self.observation_space = spaces.Box(
                low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
            )
        else:
            # Continuous: positions
            obs_dim = (
                2
                + len(
                    [o for o in env_spec.get("objects", []) if o.get("type") == "goal"]
                )
                * 2
            )
            self.observation_space = spaces.Box(
                low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
            )

    def _get_observation(self) -> np.ndarray:
        """Extract observation from state"""
        obs = []

        # Agent position
        if self.state and self.state.get("agents"):
            agent = self.state["agents"][0]
            pos = agent.get("position", [0, 0])
            obs.extend(pos)
        else:
            obs.extend([0, 0])

        # Goal positions (relative to agent)
        goals = [o for o in self.env_spec.get("objects", []) if o.get("type") == "goal"]
        if self.state and self.state.get("agents"):
            agent_pos = Vec2.from_list(self.state["agents"][0].get("position", [0, 0]))
            for goal in goals:
                goal_pos = Vec2.from_list(goal.get("position", [0, 0]))
                dx = goal_pos.x - agent_pos.x
                dy = goal_pos.y - agent_pos.y
                obs.extend([dx, dy])
        else:
            for _ in goals:
                obs.extend([0, 0])

        return np.array(obs, dtype=np.float32)

    def reset(self, seed: Optional[int] = None, options: Optional[Dict] = None):
        """Reset environment"""
        super().reset(seed=seed)
        self.state = create_initial_state(self.env_spec)
        obs = self._get_observation()
        info = {}
        return obs, info

    def step(self, action):
        """Step environment"""
        # Convert action to env_spec format
        if self.action_map:
            # Discrete action
            action_str = self.action_map[action]
            env_action = action_str
        else:
            # Continuous action
            env_action = action.tolist()

        # Step simulator
        try:
            new_state = step_simulator(
                self.state, env_action, self.env_spec, self.max_steps
            )
            # Ensure state is a dict
            if not isinstance(new_state, dict):
                import logging

                logger = logging.getLogger(__name__)
                logger.error(
                    f"step_simulator returned non-dict: {type(new_state)}, value: {new_state}"
                )
                raise ValueError(
                    f"step_simulator returned invalid type: {type(new_state)}"
                )
            self.state = new_state
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error in step_simulator: {e}")
            import traceback

            traceback.print_exc()
            raise

        # Extract reward and done
        # Ensure state is a dict
        if not isinstance(self.state, dict):
            import logging

            logger = logging.getLogger(__name__)
            logger.error(
                f"State is not a dict: {type(self.state)}, value: {self.state}"
            )
            raise ValueError(f"Invalid state type: {type(self.state)}")

        # Initialize info if not present
        if "info" not in self.state:
            self.state["info"] = {}
        if "previous_total_reward" not in self.state["info"]:
            self.state["info"]["previous_total_reward"] = 0.0

        reward = self.state.get("totalReward", 0.0) - self.state["info"].get(
            "previous_total_reward", 0.0
        )
        done = self.state.get("done", False)

        # Store previous total reward for next step
        self.state["info"]["previous_total_reward"] = self.state.get("totalReward", 0.0)

        obs = self._get_observation()
        info = {
            "episode": (
                {
                    "r": self.state.get("totalReward", 0.0),
                    "l": self.state.get("step", 0),
                }
                if done
                else None
            ),
            "state": self.state,
        }

        return obs, reward, done, False, info


class TrainingConfig:
    """Training configuration with reproducibility support"""

    def __init__(
        self,
        algorithm: str = "PPO",
        total_timesteps: int = 1000000,
        learning_rate: float = 3e-4,
        gamma: float = 0.99,
        n_steps: int = 2048,
        batch_size: int = 64,
        n_epochs: int = 10,
        gae_lambda: float = 0.95,
        clip_range: float = 0.2,
        ent_coef: float = 0.01,
        vf_coef: float = 0.5,
        max_grad_norm: float = 0.5,
        seed: Optional[int] = None,
        **kwargs,
    ):
        self.algorithm = algorithm
        self.total_timesteps = total_timesteps
        self.learning_rate = learning_rate
        self.gamma = gamma
        self.n_steps = n_steps
        self.batch_size = batch_size
        self.n_epochs = n_epochs
        self.gae_lambda = gae_lambda
        self.clip_range = clip_range
        self.ent_coef = ent_coef
        self.vf_coef = vf_coef
        self.max_grad_norm = max_grad_norm
        self.seed = seed
        self.extra_kwargs = kwargs


class RLTrainer:
    """Main RL trainer using Stable-Baselines3"""

    def __init__(self, env_spec: Dict[str, Any], config: TrainingConfig):
        self.env_spec = env_spec
        self.config = config
        self.model = None
        self.env = None
        self.metrics_callback = None

    def create_env(self):
        """Create Gymnasium environment"""
        self.env = RLStudioEnv(self.env_spec)
        return self.env

    def create_model(self, env: Optional[gym.Env] = None):
        """Create RL model with seed management for reproducibility"""
        if env is None:
            env = self.create_env()

        # Set seeds for reproducibility
        if self.config.seed is not None:
            import random

            random.seed(self.config.seed)
            np.random.seed(self.config.seed)
            torch.manual_seed(self.config.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(self.config.seed)
            env.reset(seed=self.config.seed)

        # Model hyperparameters
        model_kwargs = {
            "learning_rate": self.config.learning_rate,
            "gamma": self.config.gamma,
            "device": "cuda" if torch.cuda.is_available() else "cpu",
        }

        # Add seed to model kwargs if supported
        if self.config.seed is not None:
            model_kwargs["seed"] = self.config.seed

        # Algorithm-specific parameters
        if self.config.algorithm == "PPO":
            model_kwargs.update(
                {
                    "n_steps": self.config.n_steps,
                    "batch_size": self.config.batch_size,
                    "n_epochs": self.config.n_epochs,
                    "gae_lambda": self.config.gae_lambda,
                    "clip_range": self.config.clip_range,
                    "ent_coef": self.config.ent_coef,
                    "vf_coef": self.config.vf_coef,
                    "max_grad_norm": self.config.max_grad_norm,
                }
            )
            self.model = PPO("MlpPolicy", env, **model_kwargs)

        elif self.config.algorithm == "DQN":
            model_kwargs.update(
                {
                    "learning_starts": 1000,
                    "buffer_size": 100000,
                    "batch_size": self.config.batch_size,
                    "target_update_interval": 1000,
                }
            )
            self.model = DQN("MlpPolicy", env, **model_kwargs)

        elif self.config.algorithm == "A2C":
            model_kwargs.update(
                {
                    "n_steps": self.config.n_steps,
                }
            )
            self.model = A2C("MlpPolicy", env, **model_kwargs)

        elif self.config.algorithm == "TD3":
            # TD3 requires continuous action space
            if not isinstance(env.action_space, spaces.Box):
                raise ValueError("TD3 requires continuous action space")
            model_kwargs.update(
                {
                    "buffer_size": 100000,
                    "learning_starts": 1000,
                    "batch_size": self.config.batch_size,
                    "tau": 0.005,  # Soft update coefficient
                    "gamma": self.config.gamma,
                    "train_freq": (1, "step"),
                    "gradient_steps": 1,
                    "action_noise": None,  # Can be configured via extra_kwargs
                }
            )
            model_kwargs.update(self.config.extra_kwargs)
            self.model = TD3("MlpPolicy", env, **model_kwargs)

        elif self.config.algorithm == "SAC":
            # SAC requires continuous action space
            if not isinstance(env.action_space, spaces.Box):
                raise ValueError("SAC requires continuous action space")
            model_kwargs.update(
                {
                    "buffer_size": 100000,
                    "learning_starts": 1000,
                    "batch_size": self.config.batch_size,
                    "tau": 0.005,  # Soft update coefficient
                    "gamma": self.config.gamma,
                    "train_freq": (1, "step"),
                    "gradient_steps": 1,
                    "ent_coef": "auto",  # Automatic entropy coefficient
                }
            )
            model_kwargs.update(self.config.extra_kwargs)
            self.model = SAC("MlpPolicy", env, **model_kwargs)

        else:
            raise ValueError(f"Unknown algorithm: {self.config.algorithm}")

        return self.model

    def train(
        self,
        metrics_callback: Optional[Callable] = None,
        progress_callback: Optional[Callable] = None,
        log_interval: int = 10,
    ):
        """Train the model with experiment tracking support"""
        if self.model is None:
            self.create_model()

        # Create callback
        callback = TrainingMetricsCallback(metrics_callback)

        # Train
        self.model.learn(
            total_timesteps=self.config.total_timesteps,
            callback=callback,
            progress_bar=True,
            log_interval=log_interval,
        )

        return self.model

    def evaluate(
        self,
        n_episodes: int = 10,
        deterministic: bool = True,
        seed: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Evaluate the trained model with comprehensive metrics"""
        if self.model is None:
            raise ValueError("Model not trained yet")

        if self.env is None:
            self.create_env()

        # Set evaluation seed if provided
        eval_seed = seed if seed is not None else self.config.seed

        episode_rewards = []
        episode_lengths = []
        episode_successes = []

        for episode_idx in range(n_episodes):
            # Use different seed for each episode if base seed provided
            ep_seed = eval_seed + episode_idx if eval_seed is not None else None
            obs, _ = self.env.reset(seed=ep_seed)
            done = False
            episode_reward = 0
            episode_length = 0
            episode_success = False

            while not done:
                action, _ = self.model.predict(obs, deterministic=deterministic)
                obs, reward, done, _, info = self.env.step(action)
                episode_reward += reward
                episode_length += 1

                # Check for success (if goal reached)
                if info.get("state", {}).get("done") and reward > 0:
                    episode_success = True

            episode_rewards.append(episode_reward)
            episode_lengths.append(episode_length)
            episode_successes.append(episode_success)

        # Calculate comprehensive statistics
        rewards_array = np.array(episode_rewards)
        lengths_array = np.array(episode_lengths)

        return {
            "mean_reward": float(np.mean(rewards_array)),
            "std_reward": float(np.std(rewards_array)),
            "min_reward": float(np.min(rewards_array)),
            "max_reward": float(np.max(rewards_array)),
            "median_reward": float(np.median(rewards_array)),
            "mean_length": float(np.mean(lengths_array)),
            "std_length": float(np.std(lengths_array)),
            "success_rate": (
                float(np.mean(episode_successes)) if episode_successes else 0.0
            ),
            "episode_rewards": [float(r) for r in episode_rewards],
            "episode_lengths": [int(l) for l in episode_lengths],
            "episode_successes": episode_successes,
            "n_episodes": n_episodes,
        }

    def save(self, path: str):
        """Save model"""
        if self.model is None:
            raise ValueError("Model not trained yet")
        self.model.save(path)

    def load(self, path: str):
        """Load model"""
        if self.config.algorithm == "PPO":
            self.model = PPO.load(path)
        elif self.config.algorithm == "DQN":
            self.model = DQN.load(path)
        elif self.config.algorithm == "A2C":
            self.model = A2C.load(path)
        elif self.config.algorithm == "TD3":
            self.model = TD3.load(path)
        elif self.config.algorithm == "SAC":
            self.model = SAC.load(path)
        else:
            raise ValueError(f"Unknown algorithm: {self.config.algorithm}")
