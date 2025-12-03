/**
 * Converter: sceneGraph + rlConfig -> EnvSpec
 * Converts the new scene builder format back to universal EnvSpec format
 * This allows backward compatibility with existing frontend components
 */

import { EnvSpec, ObjectSpec, AgentSpec } from './envSpec'

export interface SceneGraphData {
  entities: Array<{
    id: string
    assetId?: string | null
    name?: string | null
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

export interface RLConfigData {
  agents: Array<{
    agentId: string
    entityId: string
    role: 'learning_agent' | 'scripted' | 'human'
    actionSpace: {
      type: string
      actions?: string[]
      shape?: number[]
      low?: number[]
      high?: number[]
      spaces?: Record<string, any>
    }
    observationSpace: {
      type: string
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
      type: string
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
      type: string
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
 * Convert sceneGraph + rlConfig to EnvSpec format
 */
export function sceneGraphToEnvSpec(
  sceneGraph: SceneGraphData,
  rlConfig: RLConfigData,
  sceneName: string = 'Untitled Environment'
): EnvSpec {
  const mode = sceneGraph.metadata?.mode || sceneGraph.metadata?.gridConfig ? 'grid' : 'continuous'
  const gridConfig = sceneGraph.metadata?.gridConfig

  // Determine world dimensions
  let worldWidth = 10
  let worldHeight = 10

  if (gridConfig) {
    worldWidth = gridConfig.cols || 10
    worldHeight = gridConfig.rows || 10
  } else {
    // Calculate from entity positions for continuous mode
    const positions = sceneGraph.entities.map((e) => e.transform.position)
    if (positions.length > 0) {
      const xs = positions.map((p) => p[0])
      const ys = positions.map((p) => p[1])
      worldWidth = Math.max(10, Math.ceil(Math.max(...xs) - Math.min(...xs)) + 2)
      worldHeight = Math.max(10, Math.ceil(Math.max(...ys) - Math.min(...ys)) + 2)
    }
  }

  // Convert entities to objects
  const objects: ObjectSpec[] = []
  const agentEntities = new Set<string>()

  // First, identify agent entities from RL config
  rlConfig.agents.forEach((agent) => {
    agentEntities.add(agent.entityId)
  })

  sceneGraph.entities.forEach((entity) => {
    const isAgent = agentEntities.has(entity.id)

    // Skip agent entities (they're handled separately)
    if (isAgent) return

    // Determine object type from asset or components
    let objectType = 'obstacle' // default
    if (entity.assetId) {
      // Try to infer from asset ID
      const assetIdStr = String(entity.assetId).toLowerCase()
      if (assetIdStr.includes('wall')) objectType = 'wall'
      else if (assetIdStr.includes('goal')) objectType = 'goal'
      else if (assetIdStr.includes('trap')) objectType = 'trap'
      else if (assetIdStr.includes('key')) objectType = 'key'
      else if (assetIdStr.includes('door')) objectType = 'door'
      else if (assetIdStr.includes('checkpoint')) objectType = 'checkpoint'
      else if (assetIdStr.includes('obstacle')) objectType = 'obstacle'
    } else if (entity.name) {
      const nameStr = entity.name.toLowerCase()
      if (nameStr.includes('wall')) objectType = 'wall'
      else if (nameStr.includes('goal')) objectType = 'goal'
      else if (nameStr.includes('trap')) objectType = 'trap'
      else if (nameStr.includes('key')) objectType = 'key'
      else if (nameStr.includes('door')) objectType = 'door'
      else if (nameStr.includes('checkpoint')) objectType = 'checkpoint'
    }

    // Get position from GridTransform component or transform
    let position: [number, number] = [0, 0]
    if (entity.components?.GridTransform) {
      // Grid mode: use row/col from GridTransform
      const { row, col } = entity.components.GridTransform
      position = [col, row]
    } else if (entity.components?.gridCell) {
      // Legacy: support old gridCell component
      const { row, col } = entity.components.gridCell
      position = [col, row]
    } else {
      // Continuous mode: use transform position
      position = [entity.transform.position[0], entity.transform.position[1] || 0]
    }

    const object: ObjectSpec = {
      id: entity.id,
      type: objectType as any,
      position,
      size: {
        type: 'rect',
        width: entity.transform.scale[0] || 1,
        height: entity.transform.scale[1] || 1,
      },
    }

    // Add collision info from Collision2D component
    if (entity.components?.Collision2D) {
      object.collision = {
        enabled:
          entity.components.Collision2D.isSolid || entity.components.Collision2D.isTrigger || false,
        shape: 'rect',
        size: { type: 'rect', width: 1, height: 1 },
      }
    } else if (entity.components?.physics) {
      // Legacy: support old physics component
      object.collision = {
        enabled: entity.components.physics.enabled !== false,
        shape: 'rect',
        size: { type: 'rect', width: 1, height: 1 },
      }
    }

    // Add visual info from Render2D component
    if (entity.components?.Render2D) {
      object.properties = {
        ...object.properties,
        color: entity.components.Render2D.color,
        shape: entity.components.Render2D.shape,
      }
    } else if (entity.components?.render) {
      // Legacy: support old render component
      object.properties = {
        ...object.properties,
        color: entity.components.render.colorOverride,
      }
    }

    objects.push(object)
  })

  // Convert agents
  const agents: AgentSpec[] = rlConfig.agents.map((agent) => {
    const entity = sceneGraph.entities.find((e) => e.id === agent.entityId)
    if (!entity) {
      throw new Error(`Agent entity ${agent.entityId} not found in scene graph`)
    }

    let position: [number, number] = [0, 0]
    if (entity.components?.GridTransform) {
      // Grid mode: use row/col from GridTransform
      const { row, col } = entity.components.GridTransform
      position = [col, row]
    } else if (entity.components?.gridCell) {
      // Legacy: support old gridCell component
      const { row, col } = entity.components.gridCell
      position = [col, row]
    } else {
      position = [entity.transform.position[0], entity.transform.position[1] || 0]
    }

    return {
      id: agent.agentId,
      name: entity.name || agent.agentId,
      position,
      actionSpace: convertActionSpace(agent.actionSpace),
      observationSpace: convertObservationSpace(agent.observationSpace),
    }
  })

  // Convert rewards
  const rewards = rlConfig.rewards.map((reward) => ({
    id: reward.id,
    condition: {
      type: reward.trigger.type,
      entityId: reward.trigger.entityId,
      regionId: reward.trigger.regionId,
      eventName: reward.trigger.eventName,
      ...reward.trigger.condition,
    },
    reward: reward.amount,
    shaping: reward.shaping,
  }))

  // Convert termination conditions
  const terminations = rlConfig.episode.terminationConditions.map((term) => ({
    type: term.type,
    condition: {
      entityId: term.entityId,
      regionId: term.regionId,
      eventName: term.eventName,
      maxSteps: term.maxSteps,
      ...term.condition,
    },
  }))

  // Build EnvSpec
  const envSpec: EnvSpec = {
    id: sceneGraph.metadata?.sceneId || `scene-${Date.now()}`,
    name: sceneName,
    type: mode,
    world: {
      type: mode,
      width: worldWidth,
      height: worldHeight,
      coordinateSystem: mode,
      bounds:
        mode === 'grid'
          ? [
              [0, worldWidth - 1],
              [0, worldHeight - 1],
            ]
          : [
              [-worldWidth / 2, worldWidth / 2],
              [-worldHeight / 2, worldHeight / 2],
            ],
    },
    objects,
    agents,
    rules: {
      rewards,
      terminations,
    },
    episode: {
      maxSteps: rlConfig.episode.maxSteps,
      reset: rlConfig.episode.reset,
    },
    metadata: {
      tags: sceneGraph.metadata?.tags || [],
      notes: sceneGraph.metadata?.description,
    },
  }

  return envSpec
}

/**
 * Convert action space from RL config format to EnvSpec format
 */
function convertActionSpace(actionSpace: RLConfigData['agents'][0]['actionSpace']): any {
  if (actionSpace.type === 'discrete') {
    return {
      type: 'discrete',
      actions: actionSpace.actions || [],
    }
  } else if (actionSpace.type === 'continuous') {
    return {
      type: 'continuous',
      shape: actionSpace.shape || [2],
      low: actionSpace.low || [-1, -1],
      high: actionSpace.high || [1, 1],
    }
  } else {
    // For other types, return as-is
    return actionSpace
  }
}

/**
 * Convert observation space from RL config format to EnvSpec format
 */
function convertObservationSpace(obsSpace: RLConfigData['agents'][0]['observationSpace']): any {
  if (obsSpace.type === 'box') {
    return {
      type: 'box',
      shape: obsSpace.shape || [2],
      low: obsSpace.low || [0, 0],
      high: obsSpace.high || [1, 1],
    }
  } else if (obsSpace.type === 'discrete') {
    return {
      type: 'discrete',
      n: obsSpace.n || 10,
    }
  } else {
    // For dict or other types, return as-is
    return obsSpace
  }
}
