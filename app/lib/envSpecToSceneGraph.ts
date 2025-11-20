/**
 * Converter: EnvSpec -> sceneGraph + rlConfig
 * Converts the universal EnvSpec format to the new scene builder format
 */

import { EnvSpec, ObjectSpec, AgentSpec } from './envSpec'

export interface ConvertedSceneGraph {
  entities: Array<{
    id: string
    assetId?: string
    name?: string
    parentId?: string | null
    transform: {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
    }
    components: Record<string, any>
  }>
  metadata: Record<string, any>
}

export interface ConvertedRLConfig {
  agents: Array<{
    agentId: string
    entityId: string
    role: 'learning_agent' | 'scripted' | 'human'
    actionSpace: {
      type: 'discrete' | 'continuous' | 'multi_discrete' | 'multi_binary' | 'dict'
      actions?: string[]
      shape?: number[]
      low?: number[]
      high?: number[]
      spaces?: Record<string, any>
    }
    observationSpace: {
      type: 'box' | 'discrete' | 'multi_discrete' | 'multi_binary' | 'dict'
      shape?: number[]
      low?: number[]
      high?: number[]
      n?: number
      spaces?: Record<string, any>
    }
  }>
  rewards: Array<{
    id: string
    trigger: {
      type: 'enter_region' | 'exit_region' | 'collision' | 'event' | 'step' | 'custom'
      entityId?: string
      regionId?: string
      eventName?: string
      condition?: Record<string, any>
    }
    amount: number
    shaping?: Record<string, any>
  }>
  episode: {
    maxSteps: number
    terminationConditions: Array<{
      type: 'enter_region' | 'exit_region' | 'collision' | 'event' | 'max_steps' | 'custom'
      entityId?: string
      regionId?: string
      eventName?: string
      maxSteps?: number
      condition?: Record<string, any>
    }>
    reset: {
      type: string
      spawns?: Array<{
        entityId: string
        position: [number, number, number]
        rotation?: [number, number, number]
      }>
      [key: string]: any
    }
  }
}

/**
 * Convert EnvSpec to sceneGraph format
 */
export function envSpecToSceneGraph(envSpec: EnvSpec): ConvertedSceneGraph {
  const entities: ConvertedSceneGraph['entities'] = []

  // Convert objects to entities
  envSpec.objects.forEach((obj: ObjectSpec) => {
    entities.push({
      id: obj.id,
      assetId: `asset_${obj.type}`, // Map to asset ID (will need asset lookup)
      name: obj.type,
      parentId: null,
      transform: {
        position: [obj.position[0], obj.position[1] || 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      components: {
        // Map object properties to components
        physics: {
          enabled: obj.collision?.enabled || false,
          bodyType: obj.collision?.enabled ? 'static' : 'none',
        },
        render: {
          visible: true,
          colorOverride: null,
        },
        // Grid-specific component
        ...(envSpec.world.coordinateSystem === 'grid' && {
          gridCell: {
            row: Math.floor(obj.position[1] || 0),
            col: Math.floor(obj.position[0]),
          },
        }),
      },
    })
  })

  // Convert agents to entities
  envSpec.agents.forEach((agent: AgentSpec) => {
    entities.push({
      id: agent.id,
      assetId: 'asset_agent', // Map to agent asset
      name: agent.name || 'Agent',
      parentId: null,
      transform: {
        position: [agent.position[0], agent.position[1] || 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      components: {
        physics: {
          enabled: true,
          bodyType: 'dynamic',
          mass: 1,
        },
        render: {
          visible: true,
        },
        rlAgent: {
          agentId: agent.id,
          role: 'learning_agent',
        },
        // Grid-specific component
        ...(envSpec.world.coordinateSystem === 'grid' && {
          gridCell: {
            row: Math.floor(agent.position[1] || 0),
            col: Math.floor(agent.position[0]),
          },
        }),
      },
    })
  })

  // Build metadata
  const metadata: Record<string, any> = {
    tags: envSpec.metadata?.tags || [],
  }

  // Add grid config if grid mode
  if (envSpec.world.coordinateSystem === 'grid') {
    metadata.gridConfig = {
      rows: envSpec.world.height,
      cols: envSpec.world.width,
    }
  }

  return {
    entities,
    metadata,
  }
}

/**
 * Convert EnvSpec to rlConfig format
 */
export function envSpecToRLConfig(envSpec: EnvSpec): ConvertedRLConfig {
  // Convert agents
  const agents = envSpec.agents.map((agent: AgentSpec) => {
    // Convert action space
    let actionSpace: ConvertedRLConfig['agents'][0]['actionSpace']
    if (envSpec.actionSpace?.type === 'discrete') {
      actionSpace = {
        type: 'discrete',
        actions: envSpec.actionSpace.actions || ['move_up', 'move_down', 'move_left', 'move_right'],
      }
    } else if (envSpec.actionSpace?.type === 'continuous') {
      actionSpace = {
        type: 'continuous',
        shape: [envSpec.actionSpace.dimensions || 2],
        low: Array(envSpec.actionSpace.dimensions || 2).fill(-1),
        high: Array(envSpec.actionSpace.dimensions || 2).fill(1),
      }
    } else {
      // Default discrete
      actionSpace = {
        type: 'discrete',
        actions: ['move_up', 'move_down', 'move_left', 'move_right'],
      }
    }

    // Convert observation space
    let observationSpace: ConvertedRLConfig['agents'][0]['observationSpace']
    if (envSpec.world.coordinateSystem === 'grid') {
      observationSpace = {
        type: 'box',
        shape: [2], // [x, y] position
        low: [0, 0],
        high: [envSpec.world.width - 1, envSpec.world.height - 1],
      }
    } else {
      observationSpace = {
        type: 'box',
        shape: [2], // [x, y] position
        low: [-Infinity, -Infinity],
        high: [Infinity, Infinity],
      }
    }

    return {
      agentId: agent.id,
      entityId: agent.id,
      role: 'learning_agent' as const,
      actionSpace,
      observationSpace,
    }
  })

  // Convert rewards
  const rewards = envSpec.rules.rewards.map((rule) => {
    // Convert reward condition to trigger
    let trigger: ConvertedRLConfig['rewards'][0]['trigger']
    
    if (rule.condition.type === 'reach_goal') {
      // Find goal entity
      const goalEntity = envSpec.objects.find((obj) => obj.type === 'goal')
      trigger = {
        type: 'enter_region',
        entityId: envSpec.agents[0]?.id,
        regionId: goalEntity?.id,
      }
    } else if (rule.condition.type === 'step') {
      trigger = {
        type: 'step',
      }
    } else {
      trigger = {
        type: 'custom',
        condition: rule.condition,
      }
    }

    return {
      id: rule.id,
      trigger,
      amount: rule.value,
    }
  })

  // Convert termination conditions
  const terminationConditions = envSpec.rules.terminations.map((rule) => {
    if (rule.condition.type === 'reach_goal') {
      const goalEntity = envSpec.objects.find((obj) => obj.type === 'goal')
      return {
        type: 'enter_region' as const,
        entityId: envSpec.agents[0]?.id,
        regionId: goalEntity?.id,
      }
    } else if (rule.condition.type === 'max_steps') {
      return {
        type: 'max_steps' as const,
        maxSteps: rule.condition.maxSteps || 500,
      }
    } else {
      return {
        type: 'custom' as const,
        condition: rule.condition,
      }
    }
  })

  // Build episode config
  const episode = {
    maxSteps: envSpec.episode?.maxSteps || 500,
    terminationConditions,
    reset: {
      type: 'fixed_spawns',
      spawns: envSpec.agents.map((agent) => ({
        entityId: agent.id,
        position: [agent.position[0], agent.position[1] || 0, 0] as [number, number, number],
      })),
    },
  }

  return {
    agents,
    rewards,
    episode,
  }
}

