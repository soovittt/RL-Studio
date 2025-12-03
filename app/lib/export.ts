/**
 * Code export utilities for generating Gym environments and training scripts
 */

export interface ExportConfig {
  environment: any
  run: any
  algorithm: string
  hyperparams: any
}

export function exportEnvironmentCode(env: any): string {
  return `import gymnasium as gym
from gymnasium import spaces
import numpy as np

class ${env.name.replace(/\s+/g, '')}Env(gym.Env):
    """${env.description || 'Custom RL environment'}"""
    
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 4}
    
    def __init__(self, render_mode=None):
        super().__init__()
        self.render_mode = render_mode
        
        # Environment spec
        self.grid = ${JSON.stringify(env.spec.grid, null, 8)}
        self.height = len(self.grid)
        self.width = len(self.grid[0])
        
        # Find agent and goal positions
        self.agent_pos = None
        self.goal_pos = None
        for i, row in enumerate(self.grid):
            for j, cell in enumerate(row):
                if cell == 'agent':
                    self.agent_pos = (i, j)
                elif cell == 'goal':
                    self.goal_pos = (i, j)
        
        # Action space: 0=up, 1=right, 2=down, 3=left
        self.action_space = spaces.Discrete(4)
        
        # Observation space: agent position + grid state
        self.observation_space = spaces.Box(
            low=0, high=1, shape=(self.height * self.width + 2,), dtype=np.float32
        )
        
        self.reset()
    
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if self.agent_pos:
            self._agent_pos = list(self.agent_pos)
        else:
            self._agent_pos = [0, 0]
        
        observation = self._get_obs()
        info = {}
        return observation, info
    
    def step(self, action):
        row, col = self._agent_pos
        
        # Move agent
        if action == 0:  # up
            row = max(0, row - 1)
        elif action == 1:  # right
            col = min(self.width - 1, col + 1)
        elif action == 2:  # down
            row = min(self.height - 1, row + 1)
        elif action == 3:  # left
            col = max(0, col - 1)
        
        # Check collision
        if self.grid[row][col] == 'wall':
            row, col = self._agent_pos
        
        self._agent_pos = [row, col]
        
        # Calculate reward
        reward = -0.1  # step penalty
        
        if self.grid[row][col] == 'goal':
            reward = 1.0
            terminated = True
        elif self.grid[row][col] == 'trap':
            reward = -1.0
            terminated = True
        else:
            terminated = False
        
        truncated = False
        observation = self._get_obs()
        info = {}
        
        return observation, reward, terminated, truncated, info
    
    def _get_obs(self):
        # Flatten grid + agent position
        grid_flat = []
        for row in self.grid:
            for cell in row:
                grid_flat.append(1.0 if cell == 'wall' else 0.0)
        
        obs = np.array(grid_flat + [self._agent_pos[0] / self.height, self._agent_pos[1] / self.width], dtype=np.float32)
        return obs
    
    def render(self):
        if self.render_mode == "human":
            for i, row in enumerate(self.grid):
                line = ""
                for j, cell in enumerate(row):
                    if [i, j] == self._agent_pos:
                        line += "A "
                    elif cell == 'wall':
                        line += "# "
                    elif cell == 'goal':
                        line += "G "
                    elif cell == 'trap':
                        line += "T "
                    else:
                        line += ". "
                print(line)
`
}

export function exportTrainingScript(config: ExportConfig): string {
  return `import gymnasium as gym
from stable_baselines3 import ${config.algorithm === 'ppo' ? 'PPO' : 'DQN'}
from ${config.environment.name.replace(/\s+/g, '')}Env import ${config.environment.name.replace(/\s+/g, '')}Env
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--learning-rate', type=float, default=${config.hyperparams.learning_rate || 3e-4})
    parser.add_argument('--gamma', type=float, default=${config.hyperparams.gamma || 0.99})
    parser.add_argument('--total-timesteps', type=int, default=${config.hyperparams.steps || 1000000})
    args = parser.parse_args()
    
    env = ${config.environment.name.replace(/\s+/g, '')}Env()
    
    model = ${config.algorithm === 'ppo' ? 'PPO' : 'DQN'}(
        "MlpPolicy",
        env,
        learning_rate=args.learning_rate,
        gamma=args.gamma,
        verbose=1,
    )
    
    model.learn(total_timesteps=args.total_timesteps)
    model.save("${config.environment.name.replace(/\s+/g, '_').toLowerCase()}_${config.algorithm}")
    
    print("Training complete!")

if __name__ == "__main__":
    main()
`
}

export function exportConfigYAML(config: ExportConfig): string {
  return `algorithm: ${config.algorithm}
hyperparameters:
  learning_rate: ${config.hyperparams.learning_rate || 3e-4}
  gamma: ${config.hyperparams.gamma || 0.99}
  total_timesteps: ${config.hyperparams.steps || 1000000}

environment:
  name: ${config.environment.name}
  type: ${config.environment.type}
  description: ${config.environment.description || ''}

rl_concepts:
  reward_shaping: ${config.run.concepts.rewardShaping}
  curriculum: ${config.run.concepts.curriculum}
  imitation: ${config.run.concepts.imitation}
  exploration_bonus: ${config.run.concepts.explorationBonus}
`
}

export function exportSkyPilotYAML(config: ExportConfig): string {
  return `name: ${config.environment.name.replace(/\s+/g, '-').toLowerCase()}-training

resources:
  accelerators: A10:1

setup: |
  pip install stable-baselines3 gymnasium numpy torch

run: |
  python train.py --learning-rate ${config.hyperparams.learning_rate || 3e-4} --gamma ${config.hyperparams.gamma || 0.99} --total-timesteps ${config.hyperparams.steps || 1000000}

envs:
  RUN_ID: ${config.run._id}
  CONVEX_URL: \${CONVEX_URL}
`
}

export function exportProject(config: ExportConfig): Record<string, string> {
  return {
    'env.py': exportEnvironmentCode(config.environment),
    'train.py': exportTrainingScript(config),
    'config.yaml': exportConfigYAML(config),
    'skypilot.yaml': exportSkyPilotYAML(config),
    'README.md': `# ${config.environment.name}

${config.environment.description || 'RL training project exported from RL Studio'}

## Environment

Type: ${config.environment.type}
Algorithm: ${config.algorithm.toUpperCase()}

## Training

\`\`\`bash
python train.py
\`\`\`

## SkyPilot

\`\`\`bash
sky launch skypilot.yaml
\`\`\`
`,
  }
}
