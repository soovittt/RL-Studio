/**
 * Seed script to populate Phase 1 templates
 * Requires assets to be seeded first
 */
import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { api } from './_generated/api'
import { Id } from './_generated/dataModel'

// Template definitions
const TEMPLATES = [
  {
    name: 'Basic Gridworld',
    description:
      'Simple gridworld with one agent and one goal. Perfect for learning value iteration and Q-learning.',
    category: 'grid',
    tags: ['grid', 'navigation', 'tabular'],
    meta: {
      difficulty: 'beginner',
      taskFamily: 'grid_navigation',
      primaryUseCases: ['value_based', 'tabular', 'education'],
      supportedAlgos: ['q_learning', 'sarsa', 'dqn'],
      supportsMultiAgent: false,
      mode: 'grid',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null, // Will be resolved by name lookup
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 1, col: 1 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 8, col: 8 } },
        },
      ],
      metadata: {
        gridConfig: { rows: 10, cols: 10 },
        tags: ['grid', 'navigation'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right', 'stay'],
          },
          observationSpace: {
            type: 'box',
            shape: [2],
            low: [0, 0],
            high: [9, 9],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.1 },
      ],
      episode: {
        maxSteps: 200,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          { type: 'max_steps', maxSteps: 200 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [1, 0, 1] }],
        },
      },
    },
  },
  {
    name: 'Cliff Walking',
    description:
      'Agent must reach goal while avoiding a cliff with large negative reward. Classic exploration vs exploitation task.',
    category: 'grid',
    tags: ['grid', 'navigation', 'exploration'],
    meta: {
      difficulty: 'beginner',
      taskFamily: 'grid_navigation',
      primaryUseCases: ['exploration', 'episodic'],
      supportedAlgos: ['q_learning', 'sarsa'],
      supportsMultiAgent: false,
      mode: 'grid',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 0, col: 0 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [11, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 0, col: 11 } },
        },
        // Cliff cells (rows 1-2, cols 1-10)
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `entity_cliff_${i + 1}`,
          assetId: null,
          assetName: 'Trap',
          name: `Cliff ${i + 1}`,
          parentId: null,
          transform: { position: [i + 1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 1, col: i + 1 } },
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `entity_cliff_${i + 11}`,
          assetId: null,
          assetName: 'Trap',
          name: `Cliff ${i + 11}`,
          parentId: null,
          transform: { position: [i + 1, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 2, col: i + 1 } },
        })),
      ],
      metadata: {
        gridConfig: { rows: 4, cols: 12 },
        tags: ['grid', 'cliff', 'navigation'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right'],
          },
          observationSpace: {
            type: 'box',
            shape: [2],
            low: [0, 0],
            high: [3, 11],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        {
          id: 'fall_cliff',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'cliff_region',
          },
          amount: -100.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -1.0 },
      ],
      episode: {
        maxSteps: 100,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'cliff_region',
          },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [0, 0, 0] }],
        },
      },
    },
  },
  {
    name: 'Key & Door Grid',
    description:
      'Agent must pick up a key, then open a door, then reach the goal. Tests temporal credit assignment.',
    category: 'grid',
    tags: ['grid', 'navigation', 'sparse_reward'],
    meta: {
      difficulty: 'intermediate',
      taskFamily: 'grid_navigation',
      primaryUseCases: ['sparse_reward', 'temporal_credit'],
      supportedAlgos: ['dqn', 'ppo', 'a2c'],
      supportsMultiAgent: false,
      mode: 'grid',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 1, col: 1 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_key_1',
          assetId: null,
          assetName: 'Key',
          name: 'Key',
          parentId: null,
          transform: { position: [3, 0, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 3, col: 3 } },
        },
        {
          id: 'entity_door_1',
          assetId: null,
          assetName: 'Door',
          name: 'Door',
          parentId: null,
          transform: { position: [5, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 5, col: 5 } },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 8, col: 8 } },
        },
      ],
      metadata: {
        gridConfig: { rows: 10, cols: 10 },
        tags: ['grid', 'key', 'door'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right'],
          },
          observationSpace: {
            type: 'dict',
            spaces: {
              position: { type: 'box', shape: [2], low: [0, 0], high: [9, 9] },
              hasKey: { type: 'discrete', n: 2 },
            },
          },
        },
      ],
      rewards: [
        {
          id: 'collect_key',
          trigger: {
            type: 'collision',
            entityId: 'entity_agent_1',
            regionId: 'entity_key_1',
          },
          amount: 5.0,
        },
        {
          id: 'open_door',
          trigger: {
            type: 'event',
            eventName: 'door_opened',
            entityId: 'entity_agent_1',
          },
          amount: 5.0,
        },
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
      ],
      episode: {
        maxSteps: 500,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [1, 0, 1] }],
        },
      },
    },
  },
  {
    name: 'Maze Generator',
    description: 'Randomly generated maze for exploration and planning tasks. Uses DFS algorithm.',
    category: 'grid',
    tags: ['grid', 'maze', 'exploration'],
    meta: {
      difficulty: 'intermediate',
      taskFamily: 'grid_navigation',
      primaryUseCases: ['exploration', 'planning'],
      supportedAlgos: ['dqn', 'ppo', 'a3c'],
      supportsMultiAgent: false,
      mode: 'grid',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 1, col: 1 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [18, 0, 18], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 18, col: 18 } },
        },
        // Sample maze walls (simplified - in production, this would be generated)
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `entity_wall_${i + 1}`,
          assetId: null,
          assetName: 'Wall',
          name: `Wall ${i + 1}`,
          parentId: null,
          transform: {
            position: [5 + (i % 5), 0, 5 + Math.floor(i / 5)],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          components: { gridCell: { row: 5 + Math.floor(i / 5), col: 5 + (i % 5) } },
        })),
      ],
      metadata: {
        gridConfig: { rows: 20, cols: 20 },
        tags: ['grid', 'maze'],
        mazeConfig: {
          algorithm: 'dfs',
          seed: 42,
          density: 0.3,
        },
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right'],
          },
          observationSpace: {
            type: 'box',
            shape: [2],
            low: [0, 0],
            high: [19, 19],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.01 },
      ],
      episode: {
        maxSteps: 1000,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          { type: 'max_steps', maxSteps: 1000 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [1, 0, 1] }],
        },
      },
    },
  },
  {
    name: 'Multi-Agent Grid (Cooperative)',
    description:
      'Multiple agents working together to reach a shared goal. Tests cooperative multi-agent RL.',
    category: 'grid',
    tags: ['grid', 'multi_agent', 'cooperative'],
    meta: {
      difficulty: 'intermediate',
      taskFamily: 'multi_agent',
      primaryUseCases: ['multi_agent', 'cooperation'],
      supportedAlgos: ['maddpg', 'coma', 'qmix'],
      supportsMultiAgent: true,
      mode: 'grid',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent 1',
          parentId: null,
          transform: { position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 1, col: 1 },
            rlAgent: { agentId: 'agent_1', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_agent_2',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent 2',
          parentId: null,
          transform: { position: [1, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            gridCell: { row: 1, col: 8 },
            rlAgent: { agentId: 'agent_2', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Shared Goal',
          parentId: null,
          transform: { position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: { gridCell: { row: 8, col: 8 } },
        },
      ],
      metadata: {
        gridConfig: { rows: 10, cols: 10 },
        tags: ['grid', 'multi_agent', 'cooperative'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'agent_1',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right', 'stay'],
          },
          observationSpace: {
            type: 'box',
            shape: [4], // [self_x, self_y, goal_x, goal_y]
            low: [0, 0, 0, 0],
            high: [9, 9, 9, 9],
          },
        },
        {
          agentId: 'agent_2',
          entityId: 'entity_agent_2',
          role: 'learning_agent',
          actionSpace: {
            type: 'discrete',
            actions: ['move_up', 'move_down', 'move_left', 'move_right', 'stay'],
          },
          observationSpace: {
            type: 'box',
            shape: [4],
            low: [0, 0, 0, 0],
            high: [9, 9, 9, 9],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        {
          id: 'reach_goal_2',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_2',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.1 },
      ],
      episode: {
        maxSteps: 300,
        terminationConditions: [
          {
            type: 'all_agents_in_region',
            entityIds: ['entity_agent_1', 'entity_agent_2'],
            regionId: 'entity_goal_1',
          },
          { type: 'max_steps', maxSteps: 300 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [
            { entityId: 'entity_agent_1', position: [1, 0, 1] },
            { entityId: 'entity_agent_2', position: [1, 0, 8] },
          ],
        },
      },
    },
  },
  {
    name: '2D Continuous Navigation',
    description:
      'Continuous 2D space with obstacles. Agent uses continuous actions (velocity) to navigate to goal.',
    category: 'continuous',
    tags: ['2d', 'continuous', 'navigation', 'obstacles'],
    meta: {
      difficulty: 'intermediate',
      taskFamily: 'continuous_navigation',
      primaryUseCases: ['continuous_control', 'path_planning'],
      supportedAlgos: ['ppo', 'sac', 'td3', 'ddpg'],
      supportsMultiAgent: false,
      mode: '2d',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [-8, 0, -8], rotation: [0, 0, 0], scale: [0.5, 0.5, 0.5] },
          components: {
            physics: { enabled: true, bodyType: 'dynamic', mass: 1 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [8, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static', trigger: true },
          },
        },
        {
          id: 'entity_obstacle_1',
          assetId: null,
          assetName: 'Wall',
          name: 'Obstacle 1',
          parentId: null,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [2, 2, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static' },
          },
        },
        {
          id: 'entity_obstacle_2',
          assetId: null,
          assetName: 'Wall',
          name: 'Obstacle 2',
          parentId: null,
          transform: { position: [3, 0, -3], rotation: [0, 0, 0], scale: [1.5, 1.5, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static' },
          },
        },
      ],
      metadata: {
        worldBounds: { min: [-10, -10], max: [10, 10] },
        tags: ['2d', 'continuous', 'navigation'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'continuous',
            shape: [2], // [vx, vy]
            low: [-1, -1],
            high: [1, 1],
          },
          observationSpace: {
            type: 'box',
            shape: [4], // [x, y, goal_x, goal_y]
            low: [-10, -10, -10, -10],
            high: [10, 10, 10, 10],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.01 },
        {
          id: 'collision_penalty',
          trigger: {
            type: 'collision',
            entityId: 'entity_agent_1',
          },
          amount: -0.5,
        },
      ],
      episode: {
        maxSteps: 500,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          { type: 'max_steps', maxSteps: 500 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [-8, 0, -8] }],
        },
      },
    },
  },
  {
    name: '3D Navigation',
    description:
      '3D environment with agent navigating through obstacles to reach goal. Tests 3D spatial reasoning.',
    category: '3d',
    tags: ['3d', 'navigation', 'spatial'],
    meta: {
      difficulty: 'advanced',
      taskFamily: '3d_navigation',
      primaryUseCases: ['3d_control', 'spatial_reasoning'],
      supportedAlgos: ['ppo', 'sac', 'td3'],
      supportsMultiAgent: false,
      mode: '3d',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_agent_1',
          assetId: null,
          assetName: 'Agent',
          name: 'Agent',
          parentId: null,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [0.5, 1, 0.5] },
          components: {
            physics: { enabled: true, bodyType: 'dynamic', mass: 1 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [10, 0, 10], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static', trigger: true },
          },
        },
        {
          id: 'entity_obstacle_1',
          assetId: null,
          assetName: 'Wall',
          name: 'Obstacle 1',
          parentId: null,
          transform: { position: [5, 0, 5], rotation: [0, 0, 0], scale: [2, 2, 2] },
          components: {
            physics: { enabled: true, bodyType: 'static' },
          },
        },
      ],
      metadata: {
        worldBounds: { min: [-10, -5, -10], max: [10, 5, 10] },
        tags: ['3d', 'navigation'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_agent_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'continuous',
            shape: [3], // [vx, vy, vz]
            low: [-1, -1, -1],
            high: [1, 1, 1],
          },
          observationSpace: {
            type: 'box',
            shape: [6], // [x, y, z, goal_x, goal_y, goal_z]
            low: [-10, -5, -10, -10, -5, -10],
            high: [10, 5, 10, 10, 5, 10],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.01 },
      ],
      episode: {
        maxSteps: 1000,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_agent_1',
            regionId: 'entity_goal_1',
          },
          { type: 'max_steps', maxSteps: 1000 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_agent_1', position: [0, 0, 0] }],
        },
      },
    },
  },
  {
    name: 'Driving Simulator',
    description:
      'Simple driving environment with road, obstacles, and goal. Agent controls vehicle with steering and acceleration.',
    category: 'driving',
    tags: ['driving', 'vehicle', 'continuous', '2d'],
    meta: {
      difficulty: 'intermediate',
      taskFamily: 'driving',
      primaryUseCases: ['vehicle_control', 'continuous_control'],
      supportedAlgos: ['ppo', 'sac', 'td3'],
      supportsMultiAgent: false,
      mode: '2d',
    },
    sceneGraph: {
      entities: [
        {
          id: 'entity_vehicle_1',
          assetId: null,
          assetName: 'Agent', // Will use agent asset for now
          name: 'Vehicle',
          parentId: null,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 0.5, 1] },
          components: {
            physics: { enabled: true, bodyType: 'dynamic', mass: 1000 },
            rlAgent: { agentId: 'player_agent', role: 'learning_agent' },
            vehicle: { maxSpeed: 5, maxSteering: 0.3 },
          },
        },
        {
          id: 'entity_goal_1',
          assetId: null,
          assetName: 'Goal',
          name: 'Goal',
          parentId: null,
          transform: { position: [20, 0, 0], rotation: [0, 0, 0], scale: [2, 2, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static', trigger: true },
          },
        },
        {
          id: 'entity_obstacle_1',
          assetId: null,
          assetName: 'Wall',
          name: 'Obstacle 1',
          parentId: null,
          transform: { position: [10, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static' },
          },
        },
        {
          id: 'entity_obstacle_2',
          assetId: null,
          assetName: 'Wall',
          name: 'Obstacle 2',
          parentId: null,
          transform: { position: [10, -3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: {
            physics: { enabled: true, bodyType: 'static' },
          },
        },
      ],
      metadata: {
        worldBounds: { min: [-5, -10, -5], max: [25, 10, 5] },
        tags: ['driving', 'vehicle', '2d'],
      },
    },
    rlConfig: {
      agents: [
        {
          agentId: 'player_agent',
          entityId: 'entity_vehicle_1',
          role: 'learning_agent',
          actionSpace: {
            type: 'continuous',
            shape: [2], // [acceleration, steering]
            low: [-1, -1],
            high: [1, 1],
          },
          observationSpace: {
            type: 'box',
            shape: [5], // [x, y, heading, goal_x, goal_y]
            low: [-5, -10, -3.14, -5, -10],
            high: [25, 10, 3.14, 25, 10],
          },
        },
      ],
      rewards: [
        {
          id: 'reach_goal',
          trigger: {
            type: 'enter_region',
            entityId: 'entity_vehicle_1',
            regionId: 'entity_goal_1',
          },
          amount: 10.0,
        },
        { id: 'step_penalty', trigger: { type: 'step' }, amount: -0.01 },
        {
          id: 'collision_penalty',
          trigger: {
            type: 'collision',
            entityId: 'entity_vehicle_1',
          },
          amount: -1.0,
        },
        {
          id: 'progress_reward',
          trigger: {
            type: 'distance_to_goal',
            entityId: 'entity_vehicle_1',
            regionId: 'entity_goal_1',
          },
          amount: 0.1, // Shaped reward for getting closer
        },
      ],
      episode: {
        maxSteps: 1000,
        terminationConditions: [
          {
            type: 'enter_region',
            entityId: 'entity_vehicle_1',
            regionId: 'entity_goal_1',
          },
          {
            type: 'collision',
            entityId: 'entity_vehicle_1',
          },
          { type: 'max_steps', maxSteps: 1000 },
        ],
        reset: {
          type: 'fixed_spawns',
          spawns: [{ entityId: 'entity_vehicle_1', position: [0, 0, 0] }],
        },
      },
    },
  },
]

/**
 * Helper: Resolve asset IDs by name
 */
async function resolveAssetIds(ctx: any, entities: any[]) {
  const resolved = []
  for (const entity of entities) {
    if (entity.assetName) {
      // Find asset by name
      const asset = await ctx.db
        .query('assets')
        .filter((q: any) => q.eq(q.field('name'), entity.assetName))
        .first()
      if (asset) {
        resolved.push({ ...entity, assetId: asset._id })
      } else {
        // Keep assetId as null if not found
        resolved.push(entity)
      }
    } else {
      resolved.push(entity)
    }
  }
  return resolved
}

/**
 * Get or create system user for seeding
 */
async function getOrCreateSystemUser(ctx: any): Promise<Id<'users'>> {
  const systemEmail = 'system@rl-studio.local'

  const existing = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', systemEmail))
    .first()

  if (existing) {
    return existing._id
  }

  const systemUserId = await ctx.db.insert('users', {
    authProviderId: `system:${Date.now()}`,
    email: systemEmail,
    displayName: 'RL Studio System',
    plan: 'free',
  })

  return systemUserId
}

/**
 * Seed all Phase 1 templates
 * Creates scenes, scene versions, and templates
 * Templates are created as PUBLIC and GLOBAL (available to all users)
 */
export const seedTemplates = mutation({
  args: {
    projectId: v.optional(v.union(v.id('environments'), v.null())), // Optional: if not provided, creates a global project
    createdBy: v.optional(v.union(v.id('users'), v.null())), // Optional: uses system user if not provided
  },
  handler: async (ctx, args) => {
    // Use system user if not provided (handle both undefined and null)
    const createdBy =
      args.createdBy !== undefined && args.createdBy !== null
        ? args.createdBy
        : await getOrCreateSystemUser(ctx)

    // projectId is now optional - undefined = global template scenes (like assets)
    // Convert null to undefined for database schema compatibility
    const projectId =
      args.projectId !== undefined && args.projectId !== null ? args.projectId : undefined

    const results = []

    for (const templateData of TEMPLATES) {
      try {
        // Check if template already exists
        const existing = await ctx.db
          .query('templates')
          .filter((q: any) => q.eq(q.field('name'), templateData.name))
          .first()

        if (existing) {
          results.push({
            action: 'skipped',
            name: templateData.name,
            id: existing._id,
          })
          continue
        }

        // Resolve asset IDs in entities
        const resolvedEntities = await resolveAssetIds(ctx, templateData.sceneGraph.entities)

        // Create scene (global if projectId is undefined)
        const sceneId = await ctx.db.insert('scenes', {
          projectId: projectId, // undefined = global template scene
          name: `${templateData.name} (Template)`,
          description: templateData.description,
          mode: templateData.meta.mode || 'grid',
          environmentSettings: {},
          activeVersionId: undefined,
          createdBy: createdBy,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })

        // Create scene version
        const versionId = await ctx.db.insert('sceneVersions', {
          sceneId: sceneId,
          versionNumber: 1,
          sceneGraph: {
            ...templateData.sceneGraph,
            entities: resolvedEntities,
          },
          rlConfig: templateData.rlConfig,
          createdBy: createdBy,
          createdAt: Date.now(),
        })

        // Set active version
        await ctx.db.patch(sceneId, {
          activeVersionId: versionId,
        })

        // Create template
        const templateId = await ctx.db.insert('templates', {
          name: templateData.name,
          description: templateData.description,
          sceneVersionId: versionId,
          category: templateData.category,
          tags: templateData.tags,
          meta: templateData.meta,
          isPublic: true,
          createdBy: createdBy,
          createdAt: Date.now(),
        })

        results.push({
          action: 'created',
          name: templateData.name,
          templateId,
          sceneId,
          versionId,
        })
      } catch (error: any) {
        results.push({
          action: 'error',
          name: templateData.name,
          error: error.message,
        })
      }
    }

    return results
  },
})
