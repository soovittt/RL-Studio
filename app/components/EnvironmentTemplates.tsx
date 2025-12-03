import { Id } from '../../convex/_generated/dataModel'

export interface EnvironmentTemplate {
  id: string
  name: string
  description: string
  envType: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom'
  spec: any
}

export const TEMPLATES: EnvironmentTemplate[] = [
  {
    id: 'empty_grid',
    name: 'Empty Grid',
    description: 'A blank gridworld to start from scratch',
    envType: 'grid',
    spec: {
      stateSpace: {
        type: 'discrete',
        shape: [10, 10],
      },
      actionSpace: {
        type: 'discrete',
        actions: ['up', 'down', 'left', 'right'],
      },
      dynamics: {
        type: 'grid',
      },
      reward: {
        rules: [
          { condition: { type: 'goal' }, value: 10 },
          { condition: { type: 'step' }, value: -0.1 },
        ],
      },
      agents: [],
      episode: {
        maxSteps: 100,
        termination: [{ type: 'goal' }, { type: 'maxSteps' }],
      },
      visuals: {
        renderer: 'grid',
        grid: Array(10)
          .fill(null)
          .map(() => Array(10).fill('empty')),
      },
      metadata: {
        tags: ['grid', 'basic'],
        notes: '',
      },
    },
  },
  {
    id: 'maze',
    name: 'Maze',
    description: 'A simple maze with walls and a goal',
    envType: 'grid',
    spec: {
      stateSpace: {
        type: 'discrete',
        shape: [10, 10],
      },
      actionSpace: {
        type: 'discrete',
        actions: ['up', 'down', 'left', 'right'],
      },
      dynamics: {
        type: 'grid',
      },
      reward: {
        rules: [
          { condition: { type: 'goal' }, value: 10 },
          { condition: { type: 'step' }, value: -0.1 },
        ],
      },
      agents: [],
      episode: {
        maxSteps: 200,
        termination: [{ type: 'goal' }, { type: 'maxSteps' }],
      },
      visuals: {
        renderer: 'grid',
        grid: (() => {
          const grid = Array(10)
            .fill(null)
            .map(() => Array(10).fill('empty'))
          // Create a simple maze pattern
          for (let i = 1; i < 9; i++) {
            grid[1][i] = 'wall'
            grid[8][i] = 'wall'
          }
          for (let i = 2; i < 8; i++) {
            grid[i][1] = 'wall'
            grid[i][8] = 'wall'
          }
          grid[0][0] = 'agent'
          grid[9][9] = 'goal'
          return grid
        })(),
      },
      metadata: {
        tags: ['grid', 'maze'],
        notes: 'Simple maze environment',
      },
    },
  },
  {
    id: 'key_door',
    name: 'Key & Door',
    description: 'Collect a key to unlock the door to the goal',
    envType: 'grid',
    spec: {
      stateSpace: {
        type: 'discrete',
        shape: [10, 10],
      },
      actionSpace: {
        type: 'discrete',
        actions: ['up', 'down', 'left', 'right'],
      },
      dynamics: {
        type: 'grid',
      },
      reward: {
        rules: [
          { condition: { type: 'goal' }, value: 10 },
          { condition: { type: 'key' }, value: 1 },
          { condition: { type: 'step' }, value: -0.1 },
        ],
      },
      agents: [],
      episode: {
        maxSteps: 150,
        termination: [{ type: 'goal' }, { type: 'maxSteps' }],
      },
      visuals: {
        renderer: 'grid',
        grid: (() => {
          const grid = Array(10)
            .fill(null)
            .map(() => Array(10).fill('empty'))
          grid[0][0] = 'agent'
          grid[5][5] = 'key'
          grid[9][9] = 'goal'
          // Add some walls
          for (let i = 2; i < 8; i++) {
            grid[i][4] = 'wall'
            grid[i][6] = 'wall'
          }
          return grid
        })(),
      },
      metadata: {
        tags: ['grid', 'key-door'],
        notes: 'Key and door puzzle environment',
      },
    },
  },
  {
    id: 'continuous_navigation',
    name: 'Continuous Navigation',
    description: 'Navigate in continuous 2D space',
    envType: 'continuous2d',
    spec: {
      stateSpace: {
        type: 'continuous',
        shape: [2],
        bounds: [
          [-10, 10],
          [-10, 10],
        ],
      },
      actionSpace: {
        type: 'continuous',
        bounds: [
          [-1, 1],
          [-1, 1],
        ],
      },
      dynamics: {
        type: 'physics',
      },
      reward: {
        rules: [
          { condition: { type: 'goal' }, value: 10 },
          { condition: { type: 'step' }, value: -0.01 },
        ],
      },
      agents: [],
      episode: {
        maxSteps: 200,
        termination: [{ type: 'goal' }, { type: 'maxSteps' }],
      },
      visuals: {
        renderer: 'continuous2d',
        points: [
          { x: -5, y: -5, type: 'agent' },
          { x: 5, y: 5, type: 'goal' },
        ],
      },
      metadata: {
        tags: ['continuous', 'navigation'],
        notes: 'Continuous 2D navigation task',
      },
    },
  },
  {
    id: 'multi_armed_bandit',
    name: 'Multi-Armed Bandit',
    description: 'Classic bandit problem with multiple arms',
    envType: 'bandit',
    spec: {
      stateSpace: {
        type: 'discrete',
        shape: [1],
      },
      actionSpace: {
        type: 'discrete',
        actions: [],
      },
      dynamics: {
        type: 'bandit',
      },
      reward: {
        rules: [
          { condition: { type: 'step' }, value: 0 }, // Rewards come from arms
        ],
      },
      agents: [],
      episode: {
        maxSteps: 1000,
        termination: [{ type: 'maxSteps' }],
      },
      visuals: {
        renderer: 'bandit',
        arms: [
          { id: 'arm1', mean: 0.3, std: 0.1, label: 'Arm 1' },
          { id: 'arm2', mean: 0.5, std: 0.1, label: 'Arm 2' },
          { id: 'arm3', mean: 0.7, std: 0.1, label: 'Arm 3' },
        ],
      },
      metadata: {
        tags: ['bandit', 'exploration'],
        notes: 'Multi-armed bandit with 3 arms',
      },
    },
  },
]
