"""
RL Trainer using Stable-Baselines3
Professional RL training with PPO, DQN, and other algorithms
"""

from typing import Dict, Any, Optional, List, Callable
import numpy as np
from stable_baselines3 import PPO, DQN, A2C
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.vec_env import DummyVecEnv
import gymnasium as gym
from gymnasium import spaces
import torch

from ..rollout.simulator import (
    create_initial_state,
    step_simulator,
    validate_env_spec,
    Vec2,
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
                    self.metrics_callback({
                        "step": self.num_timesteps,
                        "reward": self.current_episode_reward,
                        "episode_length": self.current_episode_length,
                        "mean_reward": np.mean(self.episode_rewards[-100:]) if self.episode_rewards else 0,
                    })
                
                self.current_episode_reward = 0
                self.current_episode_length = 0
        
        return True


class RLStudioEnv(gym.Env):
    """Gymnasium environment wrapper for RL Studio EnvSpec"""
    
    def __init__(self, env_spec: Dict[str, Any]):
        super().__init__()
        self.env_spec = env_spec
        self.state = None
        
        # Validate environment
        validation = validate_env_spec(env_spec)
        if not validation["valid"]:
            raise ValueError(f"Invalid env_spec: {validation['error']}")
        
        # Define action space
        action_space_spec = env_spec.get("actionSpace", {})
        if action_space_spec.get("type") == "discrete":
            actions = action_space_spec.get("actions", ["up", "down", "left", "right"])
            self.action_space = spaces.Discrete(len(actions))
            self.action_map = actions
        else:
            # Continuous action space
            self.action_space = spaces.Box(
                low=-1.0,
                high=1.0,
                shape=(2,),
                dtype=np.float32
            )
            self.action_map = None
        
        # Define observation space
        # For now, use agent position + goal positions as observation
        world = env_spec.get("world", {})
        if world.get("coordinateSystem") == "grid":
            # Grid: discrete positions
            obs_dim = 2 + len([o for o in env_spec.get("objects", []) if o.get("type") == "goal"]) * 2
            self.observation_space = spaces.Box(
                low=-np.inf,
                high=np.inf,
                shape=(obs_dim,),
                dtype=np.float32
            )
        else:
            # Continuous: positions
            obs_dim = 2 + len([o for o in env_spec.get("objects", []) if o.get("type") == "goal"]) * 2
            self.observation_space = spaces.Box(
                low=-np.inf,
                high=np.inf,
                shape=(obs_dim,),
                dtype=np.float32
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
        self.state = step_simulator(self.state, env_action, self.env_spec)
        
        # Extract reward and done
        reward = self.state.get("totalReward", 0.0) - (self.state.get("info", {}).get("previous_total_reward", 0.0))
        done = self.state.get("done", False)
        
        # Store previous total reward for next step
        self.state["info"]["previous_total_reward"] = self.state.get("totalReward", 0.0)
        
        obs = self._get_observation()
        info = {
            "episode": {"r": self.state.get("totalReward", 0.0), "l": self.state.get("step", 0)} if done else None,
            "state": self.state,
        }
        
        return obs, reward, done, False, info


class TrainingConfig:
    """Training configuration"""
    
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
        **kwargs
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
        """Create RL model"""
        if env is None:
            env = self.create_env()
        
        # Model hyperparameters
        model_kwargs = {
            "learning_rate": self.config.learning_rate,
            "gamma": self.config.gamma,
            "device": "cuda" if torch.cuda.is_available() else "cpu",
        }
        
        # Algorithm-specific parameters
        if self.config.algorithm == "PPO":
            model_kwargs.update({
                "n_steps": self.config.n_steps,
                "batch_size": self.config.batch_size,
                "n_epochs": self.config.n_epochs,
                "gae_lambda": self.config.gae_lambda,
                "clip_range": self.config.clip_range,
                "ent_coef": self.config.ent_coef,
                "vf_coef": self.config.vf_coef,
                "max_grad_norm": self.config.max_grad_norm,
            })
            self.model = PPO("MlpPolicy", env, **model_kwargs)
        
        elif self.config.algorithm == "DQN":
            model_kwargs.update({
                "learning_starts": 1000,
                "buffer_size": 100000,
                "batch_size": self.config.batch_size,
                "target_update_interval": 1000,
            })
            self.model = DQN("MlpPolicy", env, **model_kwargs)
        
        elif self.config.algorithm == "A2C":
            model_kwargs.update({
                "n_steps": self.config.n_steps,
            })
            self.model = A2C("MlpPolicy", env, **model_kwargs)
        
        else:
            raise ValueError(f"Unknown algorithm: {self.config.algorithm}")
        
        return self.model
    
    def train(
        self,
        metrics_callback: Optional[Callable] = None,
        progress_callback: Optional[Callable] = None
    ):
        """Train the model"""
        if self.model is None:
            self.create_model()
        
        # Create callback
        callback = TrainingMetricsCallback(metrics_callback)
        
        # Train
        self.model.learn(
            total_timesteps=self.config.total_timesteps,
            callback=callback,
            progress_bar=True,
        )
        
        return self.model
    
    def evaluate(self, n_episodes: int = 10) -> Dict[str, Any]:
        """Evaluate the trained model"""
        if self.model is None:
            raise ValueError("Model not trained yet")
        
        if self.env is None:
            self.create_env()
        
        episode_rewards = []
        episode_lengths = []
        
        for _ in range(n_episodes):
            obs, _ = self.env.reset()
            done = False
            episode_reward = 0
            episode_length = 0
            
            while not done:
                action, _ = self.model.predict(obs, deterministic=True)
                obs, reward, done, _, info = self.env.step(action)
                episode_reward += reward
                episode_length += 1
            
            episode_rewards.append(episode_reward)
            episode_lengths.append(episode_length)
        
        return {
            "mean_reward": np.mean(episode_rewards),
            "std_reward": np.std(episode_rewards),
            "mean_length": np.mean(episode_lengths),
            "std_length": np.std(episode_lengths),
            "episode_rewards": episode_rewards,
            "episode_lengths": episode_lengths,
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
        else:
            raise ValueError(f"Unknown algorithm: {self.config.algorithm}")

