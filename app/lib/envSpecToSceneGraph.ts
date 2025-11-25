/**
 * Converter: EnvSpec -> sceneGraph + rlConfig
 * Converts the universal EnvSpec format to the new scene builder format
 * Uses component-based architecture (GridTransform, Render2D, Collision2D, etc.)
 */

import { EnvSpec, ObjectSpec, AgentSpec } from './envSpec'
import { getDefaultRender2D } from './procedural/gridRenderer'

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

  // Convert objects to entities with component-based architecture
  envSpec.objects.forEach((obj: ObjectSpec) => {
    const isGrid = envSpec.world.coordinateSystem === 'grid'
    const row = isGrid ? Math.floor(obj.position[1] || 0) : 0
    const col = isGrid ? Math.floor(obj.position[0]) : 0

    // Determine render properties from object type
    const defaultRender = getDefaultRender2D(`asset_${obj.type}`)
    const render2D = {
      shape: defaultRender.shape,
      size: defaultRender.size,
      color: obj.properties?.color || defaultRender.color,
      opacity: defaultRender.opacity ?? 1.0,
    }

    // Determine collision properties
    const isSolid = obj.collision?.enabled && (obj.type === 'wall' || obj.type === 'obstacle')
    
    entities.push({
      id: obj.id,
      assetId: `asset_${obj.type}`, // Map to asset ID (will need asset lookup)
      name: obj.type,
      parentId: null,
      transform: {
        position: [obj.position[0], obj.position[1] || 0, 0],
        rotation: [0, 0, obj.rotation || 0],
        scale: [1, 1, 1],
      },
      components: {
        // Grid-specific: GridTransform component
        ...(isGrid && {
          GridTransform: {
            row,
            col,
            layer: 0,
          },
        }),
        // Render2D component for procedural rendering
        Render2D: render2D,
        // Collision2D component
        Collision2D: {
          isSolid,
          isTrigger: obj.collision?.enabled && !isSolid,
        },
        // Additional components based on object type
        ...(obj.type === 'key' && {
          Pickable: {
            itemId: obj.id,
            onPickup: [],
          },
        }),
        ...(obj.type === 'door' && {
          Door: {
            doorId: obj.id,
            isOpen: false,
            requiresKey: obj.properties?.requiresKey,
          },
        }),
        ...(obj.type === 'goal' && {
          TriggerZone: {
            onEnter: ['reward:+10', 'endEpisode'],
            once: true,
          },
        }),
        ...(obj.type === 'trap' && {
          TriggerZone: {
            onEnter: ['penalty:-1'],
            once: false,
          },
        }),
      },
    })
  })

  // Convert agents to entities with component-based architecture
  envSpec.agents.forEach((agent: AgentSpec) => {
    const isGrid = envSpec.world.coordinateSystem === 'grid'
    const row = isGrid ? Math.floor(agent.position[1] || 0) : 0
    const col = isGrid ? Math.floor(agent.position[0]) : 0

    // Determine action space
    const actionSpace = envSpec.actionSpace?.type === 'discrete'
      ? 'grid_moves_4'
      : envSpec.actionSpace?.type === 'continuous'
      ? 'custom'
      : 'grid_moves_4'

    // Default agent render (circle, blue)
    const render2D = {
      shape: 'circle' as const,
      radius: 0.4,
      color: '#4a90e2',
      opacity: 1.0,
    }

    entities.push({
      id: agent.id,
      assetId: 'asset_agent_human', // Default to human agent
      name: agent.name || 'Agent',
      parentId: null,
      transform: {
        position: [agent.position[0], agent.position[1] || 0, 0],
        rotation: [0, 0, agent.rotation || 0],
        scale: [1, 1, 1],
      },
      components: {
        // Grid-specific: GridTransform component
        ...(isGrid && {
          GridTransform: {
            row,
            col,
            layer: 1, // Agents on top of tiles
          },
        }),
        // Render2D component for procedural rendering
        Render2D: render2D,
        // Collision2D component
        Collision2D: {
          isSolid: true,
        },
        // GridMovement component
        ...(isGrid && {
          GridMovement: {
            allowDiagonal: false,
            canFly: false,
            speed: 1.0,
          },
        }),
        // Agent component for RL
        Agent: {
          observation: {
            radius: 2,
            type: 'partial' as const,
          },
          actionSpace,
          customActions: actionSpace === 'custom' ? envSpec.actionSpace?.actions : undefined,
        },
        // Inventory component (for key-door puzzles)
        Inventory: {
          items: [],
        },
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

