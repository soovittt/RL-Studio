"""
GPT-based code generator for RL Studio
Generates production-ready code that matches actual simulator logic
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from openai import OpenAI

logger = logging.getLogger(__name__)

# Load .env file from backend directory
# Try multiple paths to ensure we find it
env_paths = [
    Path(__file__).parent.parent.parent / ".env",  # backend/.env
    Path(__file__).parent.parent.parent.parent / "backend" / ".env",  # Alternative path
    Path.cwd() / ".env",  # Current working directory
    Path.cwd() / "backend" / ".env",  # backend/.env from project root
]

env_loaded = False
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        env_loaded = True
        logger.debug(f"Loaded .env from: {env_path}")
        break

if not env_loaded:
    # Last resort: try loading from current directory
    load_dotenv(override=True)
    logger.debug("Attempted to load .env from current directory")

# Initialize OpenAI client
client = None
api_key = os.getenv("OPENAI_API_KEY")
if (
    api_key
    and api_key.strip()
    and api_key != "sk-your-api-key-here"
    and not api_key.startswith("sk-placeholder")
):
    try:
        client = OpenAI(api_key=api_key)
        logger.info("✅ OpenAI API key loaded successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
        client = None
else:
    if api_key:
        logger.warning(f"OpenAI API key is placeholder or invalid: {api_key[:20]}...")
    else:
        logger.warning(
            "OpenAI API key not found in environment. Code generation will use fallback templates."
        )


class CodeGenerator:
    """Generate RL code using GPT API based on actual environment configuration"""

    def __init__(self):
        if not client:
            logger.warning(
                "OpenAI API key not found. Code generation will use fallback templates."
            )
        self.client = client

    def generate_environment_code(
        self, env_spec: Dict[str, Any], training_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate Gymnasium environment code that matches the actual simulator logic

        Uses GPT to generate code based on:
        - Actual reward rules and calculations
        - Actual action space and dynamics
        - Actual termination conditions
        - Actual world structure and objects
        """
        if not self.client:
            return self._fallback_environment_code(env_spec)

        # Extract actual simulator logic details
        simulator_context = self._extract_simulator_context(env_spec)

        # Build detailed simulator implementation reference
        simulator_implementation = self._build_simulator_reference(env_spec)

        prompt = f"""You are an expert RL engineer. Generate a production-ready, WORKING Gymnasium environment class that EXACTLY matches the RL Studio simulator implementation.

ENVIRONMENT SPECIFICATION:
{json.dumps(env_spec, indent=2)}

ACTUAL SIMULATOR IMPLEMENTATION (MUST MATCH EXACTLY):
{simulator_implementation}

CRITICAL REQUIREMENTS - THE CODE MUST WORK:
1. Reward Calculation: {simulator_context['reward_logic']}
   - MUST iterate through all reward rules in env_spec['rules']['rewards']
   - MUST evaluate each condition and sum the reward values
   - MUST return the total reward as a float

2. Termination Check: {simulator_context['termination_logic']}
   - MUST check all termination rules in env_spec['rules']['terminations']
   - MUST also auto-detect goal reaching (agent within 0.5 units of goal object)
   - MUST check max_steps timeout

3. Action Dynamics: {simulator_context['action_dynamics']}
   - Discrete: Actions are strings like 'up', 'down', 'left', 'right'
   - Grid: Move by cell_size (default 1.0), snap to integer grid positions
   - Continuous: Actions are [dx, dy] lists, move by max_speed * action
   - MUST check bounds and collisions

4. World Setup:
   - Width: {simulator_context['world_bounds']['width']}, Height: {simulator_context['world_bounds']['height']}
   - Coordinate System: {simulator_context['world_bounds']['coordinateSystem']}
   - Objects: {len(simulator_context['objects'])} objects at positions {[obj.get('position', [0,0]) for obj in simulator_context['objects'][:3]]}
   - Agents: {len(simulator_context['agents'])} agents starting at {[a.get('position', [0,0]) for a in simulator_context['agents']]}

5. Observation Space: {simulator_context['observation_space']}
   - MUST return normalized agent position as numpy array

6. Action Space: {simulator_context['action_space']}
   - MUST match exactly: {json.dumps(simulator_context['action_space'], indent=2)}

GENERATE COMPLETE, WORKING CODE:
- The code MUST be production-ready and runnable
- The code MUST match the simulator logic exactly
- Use numpy for all calculations
- Use gymnasium.spaces for action/observation spaces
- Implement proper collision detection
- Implement proper bounds checking
- All reward rules MUST be implemented
- All termination conditions MUST be implemented
- The code MUST work when imported and instantiated

Return ONLY the Python code, no explanations, no markdown, just the class definition."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert RL engineer specializing in Gymnasium environments. Generate production-ready, accurate code. Do NOT include any comments mentioning AI, GPT, or code generation. The code should look like it was written by a professional RL engineer.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,  # Low temperature for deterministic code
                max_tokens=4000,
            )

            code = response.choices[0].message.content.strip()

            # Remove markdown code blocks if present
            if code.startswith("```python"):
                code = code[9:]
            if code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]

            return code.strip()

        except Exception as e:
            logger.error(f"GPT code generation failed: {e}", exc_info=True)
            return self._fallback_environment_code(env_spec)

    def generate_training_code(
        self,
        env_spec: Dict[str, Any],
        training_config: Dict[str, Any],
        algorithm: str = "ppo",
    ) -> str:
        """
        Generate training script using actual algorithm and hyperparameters

        Uses GPT to generate code based on:
        - Actual algorithm (PPO, DQN, etc.)
        - Actual hyperparameters from config
        - Actual environment structure
        - Actual training setup (episodes, runs, etc.)
        """
        if not self.client:
            return self._fallback_training_code(env_spec, training_config, algorithm)

        env_name = env_spec.get("name", "Env").replace(" ", "")
        env_module = env_name.lower().replace(" ", "_")

        prompt = f"""You are an expert RL engineer. Generate a production-ready, WORKING training script using Stable-Baselines3.

ENVIRONMENT SPECIFICATION:
{json.dumps(env_spec, indent=2)}

TRAINING CONFIGURATION:
{json.dumps(training_config, indent=2)}

ALGORITHM: {algorithm.upper()}

CRITICAL REQUIREMENTS - THE CODE MUST WORK:
1. Import: from {env_module}_env import {env_name}Env
2. Algorithm: {algorithm.upper()} from stable_baselines3
3. Hyperparameters (EXACT VALUES):
   - learning_rate: {training_config.get('hyperparams', {}).get('learning_rate', 3e-4)}
   - gamma: {training_config.get('hyperparams', {}).get('gamma', 0.99)}
   - total_timesteps: {training_config.get('hyperparams', {}).get('steps', 1000000)}
4. Environment: env = {env_name}Env()
5. Model: model = {algorithm.upper()}("MlpPolicy", env, learning_rate=..., gamma=..., verbose=1)
6. Training: model.learn(total_timesteps=...)
7. Saving: model.save("{env_module}_{algorithm}")
8. Include proper error handling and logging
9. The script MUST be runnable with: python train.py

GENERATE COMPLETE, WORKING CODE:
- The code MUST be production-ready and runnable
- Include all necessary imports
- Include command-line argument parsing (optional but recommended)
- Include proper error handling
- Include model saving
- The code MUST work when executed

Return ONLY the Python code, no explanations, no markdown, just the script."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert RL engineer specializing in Stable-Baselines3 training. Generate production-ready, accurate training scripts. Do NOT include any comments mentioning AI, GPT, or code generation. The code should look like it was written by a professional RL engineer.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=3000,
            )

            code = response.choices[0].message.content.strip()

            # Remove markdown code blocks if present
            if code.startswith("```python"):
                code = code[9:]
            if code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]

            return code.strip()

        except Exception as e:
            logger.error(f"GPT training code generation failed: {e}", exc_info=True)
            return self._fallback_training_code(env_spec, training_config, algorithm)

    def _extract_simulator_context(self, env_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Extract actual simulator logic from env_spec for GPT context"""
        rules = env_spec.get("rules", {})
        rewards = rules.get("rewards", [])
        terminations = rules.get("terminations", [])

        # Build reward calculation logic description
        reward_logic = []
        for rule in rewards:
            cond_type = rule.get("condition", {}).get("type", "unknown")
            reward_value = rule.get("reward", 0)
            rule_id = rule.get("id", "unknown")
            reward_logic.append(
                f"Rule '{rule_id}': if {cond_type} then reward += {reward_value}"
            )

        # Build termination logic description
        termination_logic = []
        for rule in terminations:
            cond_type = rule.get("condition", {}).get("type", "unknown")
            rule_id = rule.get("id", "unknown")
            if cond_type == "timeout":
                steps = rule.get("condition", {}).get("steps", 100)
                termination_logic.append(
                    f"Rule '{rule_id}': if step >= {steps} then terminated = True"
                )
            else:
                termination_logic.append(
                    f"Rule '{rule_id}': if {cond_type} then terminated = True"
                )
        # Add auto goal detection
        termination_logic.append(
            "Auto: if agent within 0.5 units of goal object then terminated = True"
        )

        # Extract action dynamics
        action_space = env_spec.get("actionSpace", {})
        if action_space.get("type") == "discrete":
            actions = action_space.get("actions", [])
            action_dynamics = f"Discrete actions: {actions} (strings like 'up', 'down', 'left', 'right')"
        else:
            range_val = action_space.get("range", [-1, 1])
            dimensions = action_space.get("dimensions", 2)
            action_dynamics = f"Continuous actions: Box({range_val[0]}, {range_val[1]}, shape=({dimensions},)) - list [dx, dy]"

        # Extract world bounds
        world = env_spec.get("world", {})
        world_bounds = {
            "width": world.get("width", 10),
            "height": world.get("height", 10),
            "coordinateSystem": world.get("coordinateSystem", "grid"),
            "cellSize": world.get("cellSize", 1.0),
        }

        return {
            "reward_logic": "\n".join(reward_logic)
            if reward_logic
            else "reward = 0.0 (no reward rules)",
            "reward_calculation": "Iterate through env_spec['rules']['rewards'], evaluate each condition, sum reward values",
            "termination_logic": "\n".join(termination_logic)
            if terminations
            else "terminated = False (no termination rules)",
            "termination_check": "Check all termination rules + auto goal detection + max_steps timeout",
            "action_dynamics": action_dynamics,
            "action_space": action_space,
            "observation_space": env_spec.get("stateSpace", {}),
            "world_bounds": world_bounds,
            "objects": env_spec.get("objects", []),
            "agents": env_spec.get("agents", []),
            "env_type": env_spec.get("envType", "grid"),
        }

    def _build_simulator_reference(self, env_spec: Dict[str, Any]) -> str:
        """Build detailed reference of actual simulator implementation"""
        world = env_spec.get("world", {})
        is_grid = env_spec.get("envType") == "grid"
        coord_system = world.get("coordinateSystem", "grid")

        reference = f"""SIMULATOR IMPLEMENTATION DETAILS:

1. REWARD CALCULATION (from calculate_reward function):
   - Iterate through env_spec['rules']['rewards']
   - For each rule, evaluate rule['condition'] using evaluate_condition()
   - If condition is True, add rule['reward'] to total
   - Return sum of all matching reward values

2. TERMINATION CHECK (from check_termination function):
   - First check all termination rules in env_spec['rules']['terminations']
   - Auto-detect goal: if agent within 0.5 units of any goal object, terminate
   - Check max_steps: if step >= max_steps, truncate (not terminate)

3. ACTION APPLICATION (from apply_action function):
   - Discrete actions (strings): 
     * Grid: Move by cell_size (default 1.0), snap to integer grid positions
     * Continuous: Move by step_size (0.1)
   - Continuous actions (list [dx, dy]):
     * Move by: new_pos = old_pos + [dx, dy] * max_speed (0.1)
   - Bounds checking:
     * Grid: clamp to [0, width-1] and [0, height-1], round to integers
     * Cartesian: clamp to [-width/2, width/2] and [-height/2, height/2]
     * Other: clamp to [0, width] and [0, height]
   - Collision: Check distance < 1.0 to wall/obstacle objects, don't move if collision

4. WORLD SETUP:
   - Coordinate System: {coord_system}
   - Width: {world.get('width', 10)}, Height: {world.get('height', 10)}
   - Cell Size: {world.get('cellSize', 1.0)} (for grid)
   - Objects: {len(env_spec.get('objects', []))} objects
   - Agents: {len(env_spec.get('agents', []))} agents

5. OBSERVATION:
   - Normalize agent position: (pos - bounds_min) / (bounds_max - bounds_min)
   - Return as numpy array of shape (2,) dtype=np.float32

6. INITIAL STATE:
   - Agent starts at position from env_spec['agents'][0]['position']
   - Objects at positions from env_spec['objects']
   - Step counter starts at 0
   - Total reward starts at 0.0
"""
        return reference

    def _fallback_environment_code(self, env_spec: Dict[str, Any]) -> str:
        """Fallback template if GPT is unavailable"""
        env_name = env_spec.get("name", "Env").replace(" ", "")
        return f'''import gymnasium as gym
from gymnasium import spaces
import numpy as np

class {env_name}Env(gym.Env):
    """RL environment for {env_spec.get('name', 'Custom Environment')}"""
    
    def __init__(self):
        super().__init__()
        self.action_space = spaces.Discrete(4)
        self.observation_space = spaces.Box(low=0, high=1, shape=(2,), dtype=np.float32)
    
    def reset(self, seed=None, options=None):
        return np.array([0.0, 0.0]), {{}}
    
    def step(self, action):
        reward = 0.0
        terminated = False
        return np.array([0.0, 0.0]), reward, terminated, False, {{}}
'''

    def _fallback_training_code(
        self, env_spec: Dict[str, Any], training_config: Dict[str, Any], algorithm: str
    ) -> str:
        """Fallback template if GPT is unavailable"""
        return f"""import gymnasium as gym
from stable_baselines3 import {algorithm.upper()}

# TODO: Import your environment
# from your_env import YourEnv

env = None  # TODO: Create environment
model = {algorithm.upper()}("MlpPolicy", env)
model.learn(total_timesteps={training_config.get('hyperparams', {}).get('steps', 1000000)})
model.save("model")
"""


def generate_environment_code(
    env_spec: Dict[str, Any], training_config: Optional[Dict[str, Any]] = None
) -> str:
    """Convenience function to generate environment code"""
    generator = CodeGenerator()
    return generator.generate_environment_code(env_spec, training_config)


def generate_training_code(
    env_spec: Dict[str, Any], training_config: Dict[str, Any], algorithm: str = "ppo"
) -> str:
    """Convenience function to generate training code"""
    generator = CodeGenerator()
    return generator.generate_training_code(env_spec, training_config, algorithm)
