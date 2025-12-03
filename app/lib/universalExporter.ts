// Universal Environment Exporter - Generates Python/Gym code from EnvSpec
import { EnvSpec, ConditionSpec, Vec2, ObjectSpec, AgentSpec } from './envSpec'

export interface ExportConfig {
  envSpec: EnvSpec
  algorithm?: 'ppo' | 'dqn'
  hyperparams?: {
    learning_rate?: number
    gamma?: number
    steps?: number
  }
  run?: {
    concepts?: {
      rewardShaping?: boolean
      curriculum?: boolean
      imitation?: boolean
      explorationBonus?: boolean
    }
  }
}

// Generate Python code to evaluate a condition
function generateConditionCode(condition: ConditionSpec, envSpec: EnvSpec): string {
  switch (condition.type) {
    case 'agent_at_position': {
      const [px, py] = condition.position
      const tolerance = condition.tolerance || 0.5
      return `np.linalg.norm(self.agent_pos - np.array([${px}, ${py}])) <= ${tolerance}`
    }

    case 'agent_at_object': {
      const obj = envSpec.objects.find((o) => o.id === condition.objectId)
      if (!obj) return 'False'
      const [ox, oy] = obj.position
      const radius = obj.size.type === 'circle' ? obj.size.radius : 0.5
      return `np.linalg.norm(self.agent_pos - np.array([${ox}, ${oy}])) <= ${radius + 0.5}`
    }

    case 'collision': {
      return `self._check_collision("${condition.a}", "${condition.b}")`
    }

    case 'timeout':
      return `self.step >= ${condition.steps}`

    case 'inside_region': {
      const objects = envSpec.objects || []
      const region = objects.find((o) => o?.id === condition.regionId)
      if (!region || !region.position) return 'False'
      const [rx, ry] = region.position
      const regionObj = objects.find((o) => o?.id === condition.regionId)
      if (regionObj?.size?.type === 'rect') {
        const { width, height } = regionObj.size
        return `(${rx - width / 2} <= self.agent_pos[0] <= ${rx + width / 2} and ${ry - height / 2} <= self.agent_pos[1] <= ${ry + height / 2})`
      }
      const radius = regionObj?.size?.type === 'circle' ? regionObj.size.radius || 5 : 5
      return `np.linalg.norm(self.agent_pos - np.array([${rx}, ${ry}])) <= ${radius}`
    }

    case 'custom':
      return `self._eval_custom_condition("""${condition.script}""")`

    default:
      return 'False'
  }
}

// Generate reward calculation code
function generateRewardCode(envSpec: EnvSpec): string {
  const rewards = envSpec.rules?.rewards || []
  if (rewards.length === 0) {
    return 'reward = 0.0'
  }

  const rewardChecks = rewards
    .map((rule) => {
      if (!rule || !rule.condition) return ''
      const condition = generateConditionCode(rule.condition, envSpec)
      return `if ${condition}:\n            reward += ${rule.reward || 0}  # ${rule.id || 'rule'}`
    })
    .filter(Boolean)
    .join('\n        ')

  return `reward = 0.0\n        ${rewardChecks}`
}

// Generate termination check code
function generateTerminationCode(envSpec: EnvSpec): string {
  const terminations = envSpec.rules?.terminations || []
  if (terminations.length === 0) {
    return 'terminated = False'
  }

  const terminationChecks = terminations
    .map((rule) => {
      if (!rule || !rule.condition) return ''
      const condition = generateConditionCode(rule.condition, envSpec)
      return `if ${condition}:\n            terminated = True  # ${rule.id || 'rule'}`
    })
    .filter(Boolean)
    .join('\n        ')

  return `terminated = False\n        ${terminationChecks}`.trim()
}

// Generate environment code from EnvSpec
export function exportEnvironmentCode(config: ExportConfig): string {
  const { envSpec } = config
  if (!envSpec) {
    throw new Error('Environment specification is required')
  }

  const envName = (envSpec.name || 'Untitled').replace(/\s+/g, '')
  const isGrid = envSpec.envType === 'grid'
  const isContinuous = envSpec.envType === 'continuous2d'

  // Safe access with defaults
  const objects = envSpec.objects || []
  const agents = envSpec.agents || []
  const world = envSpec.world || { width: 10, height: 10, coordinateSystem: 'grid' }
  const actionSpace = envSpec.actionSpace || {
    type: 'discrete',
    actions: ['up', 'right', 'down', 'left'],
  }
  const stateSpace = envSpec.stateSpace || { type: 'vector', dimensions: [2] }
  const rules = envSpec.rules || { rewards: [], terminations: [] }

  // Build objects list
  const objectsCode = objects
    .map((obj) => {
      if (!obj || !obj.position) return ''
      const [x, y] = obj.position || [0, 0]
      const size =
        obj.size?.type === 'circle'
          ? `{'type': 'circle', 'radius': ${obj.size.radius || 1}}`
          : obj.size?.type === 'rect'
            ? `{'type': 'rect', 'width': ${obj.size.width || 1}, 'height': ${obj.size.height || 1}}`
            : `{'type': 'point'}`
      return `        {'id': '${obj.id || 'obj'}', 'type': '${obj.type || 'object'}', 'position': [${x}, ${y}], 'size': ${size}},`
    })
    .filter(Boolean)
    .join('\n')

  // Build agents list
  const agentsCode = agents
    .map((agent) => {
      if (!agent || !agent.position) return ''
      const [x, y] = agent.position || [0, 0]
      return `        {'id': '${agent.id || 'agent'}', 'name': '${agent.name || 'Agent'}', 'position': [${x}, ${y}]},`
    })
    .filter(Boolean)
    .join('\n')

  // Action space
  const actionSpaceCode =
    actionSpace.type === 'discrete'
      ? `self.action_space = spaces.Discrete(${(actionSpace.actions || []).length || 4})`
      : `self.action_space = spaces.Box(
            low=${(actionSpace.range || [-1, 1])[0]}, 
            high=${(actionSpace.range || [-1, 1])[1]}, 
            shape=(${actionSpace.dimensions || 2},), 
            dtype=np.float32
        )`

  // Observation space
  const dimensions = stateSpace.dimensions || [2]
  const dimensionsStr = Array.isArray(dimensions) ? dimensions.join(', ') : String(dimensions)
  const obsSpaceCode =
    stateSpace.type === 'vector'
      ? `self.observation_space = spaces.Box(
            low=-np.inf, 
            high=np.inf, 
            shape=(${dimensionsStr}), 
            dtype=np.float32
        )`
      : `self.observation_space = spaces.Box(
            low=0, 
            high=255, 
            shape=(${dimensionsStr}), 
            dtype=np.uint8
        )`

  // World bounds
  const bounds = isGrid
    ? `[0, ${world.width}], [0, ${world.height}]`
    : `[-${world.width / 2}, ${world.width / 2}], [-${world.height / 2}, ${world.height / 2}]`

  // Action handling
  const isDiscrete = actionSpace.type === 'discrete'
  const actions = isDiscrete ? actionSpace.actions : ['up', 'right', 'down', 'left']
  const actionRange = !isDiscrete ? actionSpace.range : [-1, 1]
  const actionHandlingCode = isGrid
    ? `        # Discrete grid movement
        row, col = int(self.agent_pos[0]), int(self.agent_pos[1])
        actions = ${JSON.stringify(actions)}
        action_idx = action if isinstance(action, int) else actions.index(action) if action in actions else 0
        
        if action_idx == 0 or actions[action_idx] == 'up':
            row = max(0, row - 1)
        elif action_idx == 1 or actions[action_idx] == 'right':
            col = min(self.width - 1, col + 1)
        elif action_idx == 2 or actions[action_idx] == 'down':
            row = min(self.height - 1, row + 1)
        elif action_idx == 3 or actions[action_idx] == 'left':
            col = max(0, col - 1)
        
        new_pos = np.array([row, col], dtype=np.float32)`
    : `        # Continuous movement
        action = np.clip(action, ${actionRange[0]}, ${actionRange[1]})
        max_speed = 0.1
        new_pos = self.agent_pos + action * max_speed`

  return `import gymnasium as gym
from gymnasium import spaces
import numpy as np

class ${envName}Env(gym.Env):
    """${envSpec.metadata?.notes || envSpec.name || 'Custom RL environment'}"""
    
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 4}
    
    def __init__(self, render_mode=None):
        super().__init__()
        self.render_mode = render_mode
        
        # World configuration
        self.world = {
            'coordinateSystem': '${world.coordinateSystem || 'grid'}',
            'width': ${world.width},
            'height': ${world.height},
            'bounds': [${bounds}],
        }
        
        # Objects
        self.objects = [
${objectsCode}
        ]
        
        # Agents
        self.agents = [
${agentsCode}
        ]
        
        # Action space
        ${actionSpaceCode}
        
        # Observation space
        ${obsSpaceCode}
        
        self.reset()
    
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.step = 0
        
        # Reset agent to initial position
        if self.agents:
            initial_pos = self.agents[0]['position']
            self.agent_pos = np.array(initial_pos, dtype=np.float32)
        else:
            self.agent_pos = np.array([0.0, 0.0], dtype=np.float32)
        
        observation = self._get_obs()
        info = {}
        return observation, info
    
    def step(self, action):
        self.step += 1
        
        # Apply action
        ${actionHandlingCode
          .split('\n')
          .map((line) => '        ' + line)
          .join('\n')}
        
        # Check bounds
        bounds = self.world['bounds']
        new_pos[0] = np.clip(new_pos[0], bounds[0][0], bounds[0][1])
        new_pos[1] = np.clip(new_pos[1], bounds[1][0], bounds[1][1])
        
        # Check collisions with walls/obstacles
        hit_obstacle = False
        for obj in self.objects:
            if obj['type'] not in ['wall', 'obstacle']:
                continue
            obj_pos = np.array(obj['position'])
            dist = np.linalg.norm(new_pos - obj_pos)
            
            if obj['size']['type'] == 'circle':
                if dist < obj['size']['radius'] + 0.5:
                    hit_obstacle = True
                    break
            elif obj['size']['type'] == 'rect':
                w, h = obj['size']['width'], obj['size']['height']
                if (obj_pos[0] - w/2 <= new_pos[0] <= obj_pos[0] + w/2 and
                    obj_pos[1] - h/2 <= new_pos[1] <= obj_pos[1] + h/2):
                    hit_obstacle = True
                    break
        
        if not hit_obstacle:
            self.agent_pos = new_pos
        
        # Calculate reward
${generateRewardCode(envSpec)
  .split('\n')
  .map((line) => '        ' + line)
  .join('\n')}
        
        # Check termination
${generateTerminationCode(envSpec)
  .split('\n')
  .map((line) => '        ' + line)
  .join('\n')}
        
        # Check max steps
        max_steps = ${(() => {
          const timeoutRule = (rules.terminations || []).find(
            (r: any) => r?.condition?.type === 'timeout'
          )
          return timeoutRule && timeoutRule.condition.type === 'timeout'
            ? timeoutRule.condition.steps
            : 100
        })()}
        truncated = self.step >= max_steps
        
        observation = self._get_obs()
        info = {'step': self.step}
        
        return observation, reward, terminated, truncated, info
    
    def _get_obs(self):
        # Simple observation: agent position normalized
        bounds = self.world['bounds']
        normalized_x = (self.agent_pos[0] - bounds[0][0]) / (bounds[0][1] - bounds[0][0])
        normalized_y = (self.agent_pos[1] - bounds[1][0]) / (bounds[1][1] - bounds[1][0])
        return np.array([normalized_x, normalized_y], dtype=np.float32)
    
    def _check_collision(self, a_id, b_id):
        """Check collision between two objects"""
        a_pos = None
        b_pos = None
        
        for agent in self.agents:
            if agent['id'] == a_id:
                a_pos = np.array(agent['position'])
            if agent['id'] == b_id:
                b_pos = np.array(agent['position'])
        
        for obj in self.objects:
            if obj['id'] == a_id:
                a_pos = np.array(obj['position'])
            if obj['id'] == b_id:
                b_pos = np.array(obj['position'])
        
        if a_pos is None or b_pos is None:
            return False
        
        return np.linalg.norm(a_pos - b_pos) < 1.0
    
    def _eval_custom_condition(self, script):
        """Evaluate custom condition script (placeholder)"""
        # In production, use a proper sandbox
        return False
    
    def render(self):
        if self.render_mode == "human":
            print(f"Step: {self.step}, Agent pos: {self.agent_pos}, Reward: {getattr(self, '_last_reward', 0)}")
`
}

export function exportTrainingScript(config: ExportConfig): string {
  const { envSpec } = config
  if (!envSpec) {
    throw new Error('Environment specification is required')
  }
  const envName = (envSpec.name || 'Untitled').replace(/\s+/g, '')
  const algorithm = config.algorithm || 'ppo'
  const hyperparams = config.hyperparams || {}

  return `import gymnasium as gym
from stable_baselines3 import ${algorithm === 'ppo' ? 'PPO' : 'DQN'}
from ${envName.toLowerCase()}_env import ${envName}Env
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--learning-rate', type=float, default=${hyperparams.learning_rate || 3e-4})
    parser.add_argument('--gamma', type=float, default=${hyperparams.gamma || 0.99})
    parser.add_argument('--total-timesteps', type=int, default=${hyperparams.steps || 1000000})
    args = parser.parse_args()
    
    env = ${envName}Env()
    
    model = ${algorithm === 'ppo' ? 'PPO' : 'DQN'}(
        "MlpPolicy",
        env,
        learning_rate=args.learning_rate,
        gamma=args.gamma,
        verbose=1,
    )
    
    model.learn(total_timesteps=args.total_timesteps)
    model.save("${envName.toLowerCase()}_${algorithm}")
    
    print("Training complete!")

if __name__ == "__main__":
    main()
`
}

export function exportConfigYAML(config: ExportConfig): string {
  const { envSpec } = config
  const algorithm = config.algorithm || 'ppo'
  const hyperparams = config.hyperparams || {}

  return `algorithm: ${algorithm}
hyperparameters:
  learning_rate: ${hyperparams.learning_rate || 3e-4}
  gamma: ${hyperparams.gamma || 0.99}
  total_timesteps: ${hyperparams.steps || 1000000}

environment:
  name: ${envSpec.name || 'Untitled Environment'}
  type: ${envSpec.envType || 'grid'}
  description: ${envSpec.metadata?.notes || ''}

rl_concepts:
  reward_shaping: ${config.run?.concepts?.rewardShaping || false}
  curriculum: ${config.run?.concepts?.curriculum || false}
  imitation: ${config.run?.concepts?.imitation || false}
  exploration_bonus: ${config.run?.concepts?.explorationBonus || false}
`
}

export function exportSkyPilotYAML(config: ExportConfig): string {
  const { envSpec } = config
  if (!envSpec) {
    throw new Error('Environment specification is required')
  }
  const algorithm = config.algorithm || 'ppo'
  const hyperparams = config.hyperparams || {}

  return `name: ${(envSpec.name || 'untitled').replace(/\s+/g, '-').toLowerCase()}-training

resources:
  accelerators: A10:1

setup: |
  pip install stable-baselines3 gymnasium numpy torch

run: |
  python train.py --learning-rate ${hyperparams.learning_rate || 3e-4} --gamma ${hyperparams.gamma || 0.99} --total-timesteps ${hyperparams.steps || 1000000}

envs:
  RUN_ID: ${(config.run as any)?._id || 'local'}
  CONVEX_URL: \${CONVEX_URL}
`
}

export function exportProject(config: ExportConfig): Record<string, string> {
  const { envSpec } = config
  if (!envSpec) {
    throw new Error('Environment specification is required')
  }

  const envName = (envSpec.name || 'untitled').replace(/\s+/g, '-').toLowerCase()
  const algorithm = config.algorithm || 'ppo'

  // Safe access with defaults
  const rewards = envSpec.rules?.rewards || []
  const terminations = envSpec.rules?.terminations || []
  const objects = envSpec.objects || []
  const agents = envSpec.agents || []
  const world = envSpec.world || { width: 10, height: 10 }
  const metadata = envSpec.metadata || { tags: [] }

  return {
    [`${envName}_env.py`]: exportEnvironmentCode(config),
    'train.py': exportTrainingScript(config),
    'config.yaml': exportConfigYAML(config),
    'skypilot.yaml': exportSkyPilotYAML(config),
    'README.md': `# ${envSpec.name || 'Untitled Environment'}

${(metadata as { notes?: string }).notes || 'RL training project exported from RL Studio'}

## Environment

Type: ${envSpec.envType || 'grid'}
Algorithm: ${algorithm.toUpperCase()}
World: ${world.width} × ${world.height}
Objects: ${objects.length}
Agents: ${agents.length}

## Reward Rules

${
  rewards.length > 0
    ? rewards
        .map(
          (r) =>
            `- ${r.condition?.type || 'unknown'}: ${(r.reward || 0) >= 0 ? '+' : ''}${r.reward || 0}${r.shaping ? ' (shaping)' : ''}`
        )
        .join('\n')
    : 'None'
}

## Termination Conditions

${
  terminations.length > 0
    ? terminations.map((r) => `- ${r.condition?.type || 'unknown'}`).join('\n')
    : 'None (max steps only)'
}

## Training

\`\`\`bash
python train.py
\`\`\`

## SkyPilot

\`\`\`bash
sky launch skypilot.yaml
\`\`\`
`,
    'env_spec.json': JSON.stringify(envSpec, null, 2),
  }
}
