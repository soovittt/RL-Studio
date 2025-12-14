// Universal EnvSpec Data Model
// This is the single source of truth for ALL environment types

export type EnvType = 'grid' | 'continuous2d' | 'custom2d'

export type Vec2 = [number, number]

export type SizeSpec =
  | { type: 'point' }
  | { type: 'circle'; radius: number }
  | { type: 'rect'; width: number; height: number }
  | { type: 'polygon'; points: Vec2[] }

export type ObjectType =
  | 'wall'
  | 'agent'
  | 'goal'
  | 'obstacle'
  | 'region'
  | 'checkpoint'
  | 'trap'
  | 'key'
  | 'door'
  | 'custom'

export type PhysicsSpec = {
  enabled: boolean
  gravity?: Vec2
  friction?: number
  collisionEnabled?: boolean
}

export type GeometrySpec = {
  walkableRegions?: Vec2[][]
  nonWalkableRegions?: Vec2[][]
}

export type WorldSpec = {
  coordinateSystem: 'grid' | 'cartesian'
  width: number
  height: number
  cellSize?: number // Only for grid
  physics: PhysicsSpec
  geometry?: GeometrySpec
}

export type CollisionSpec = {
  enabled: boolean
  shape: 'circle' | 'rect' | 'polygon'
  size: SizeSpec
}

export type ObjectSpec = {
  id: string
  type: ObjectType
  position: Vec2
  rotation?: number
  size: SizeSpec
  collision: CollisionSpec
  properties: Record<string, any>
}

export type DynamicsSpec =
  | { type: 'grid-step' }
  | { type: 'continuous-velocity'; maxSpeed: number }
  | { type: 'car-like'; maxSpeed: number; turnRate: number }
  | { type: 'custom'; script: string }

export type SensorSpec = {
  id: string
  type: 'vision' | 'proximity' | 'lidar' | 'custom'
  range?: number
  fov?: number
  properties: Record<string, any>
}

export type AgentSpec = {
  id: string
  name: string
  position: Vec2
  rotation?: number
  dynamics: DynamicsSpec
  sensors: SensorSpec[]
}

export type ActionSpaceSpec =
  | { type: 'discrete'; actions: string[] }
  | { type: 'continuous'; dimensions: number; range: [number, number] }

export type StateComponent = {
  name: string
  type: 'position' | 'velocity' | 'image' | 'custom'
  dimensions: number[]
}

export type StateSpaceSpec = {
  type: 'vector' | 'image' | 'custom'
  dimensions: number[]
  components?: StateComponent[]
}

export type ConditionSpec =
  | { type: 'agent_at_position'; agentId: string; position: Vec2; tolerance?: number }
  | { type: 'agent_at_object'; agentId: string; objectId: string }
  | { type: 'collision'; a: string; b: string }
  | { type: 'timeout'; steps: number }
  | { type: 'inside_region'; agentId: string; regionId: string }
  | { type: 'step' }
  | { type: 'reach_goal' }
  | { type: 'hit_trap' }
  | { type: 'collect_key' }
  | { type: 'custom'; script: string }

export type RewardRule = {
  id: string
  condition: ConditionSpec
  reward: number
  shaping?: boolean
}

export type TerminationRule = {
  id: string
  condition: ConditionSpec
}

export type EventRule = {
  id: string
  condition: ConditionSpec
  action: string // e.g., 'spawn_object', 'modify_property'
  params: Record<string, any>
}

export type RuleSet = {
  rewards: RewardRule[]
  terminations: TerminationRule[]
  events: EventRule[]
}

export type VisualSpec = {
  renderer: 'grid' | 'continuous2d' | 'custom'
  backgroundColor?: string
  gridColor?: string
  objectColors?: Record<string, string>
  overlays?: string[]
}

export type MetadataSpec = {
  tags: string[]
  notes?: string
  author?: string
  version?: string
}

export type EnvSpec = {
  id: string
  name: string
  envType: EnvType
  world: WorldSpec
  objects: ObjectSpec[]
  agents: AgentSpec[]
  actionSpace: ActionSpaceSpec
  stateSpace: StateSpaceSpec
  rules: RuleSet
  visuals: VisualSpec
  metadata: MetadataSpec
}

// Helper functions
export function createDefaultEnvSpec(envType: EnvType, name: string = ''): EnvSpec {
  const baseWorld: WorldSpec = {
    coordinateSystem: envType === 'grid' ? 'grid' : 'cartesian',
    width: envType === 'grid' ? 10 : 20,
    height: envType === 'grid' ? 10 : 20,
    cellSize: envType === 'grid' ? 1 : undefined,
    physics: {
      enabled: envType !== 'grid',
      collisionEnabled: true,
    },
  }

  return {
    id: `env_${Date.now()}`,
    name: name || 'Untitled Environment',
    envType,
    world: baseWorld,
    objects: [],
    agents: [],
    actionSpace:
      envType === 'grid'
        ? { type: 'discrete', actions: ['up', 'down', 'left', 'right'] }
        : { type: 'continuous', dimensions: 2, range: [-1, 1] },
    stateSpace: {
      type: 'vector',
      dimensions: envType === 'grid' ? [2] : [2],
      components: [{ name: 'position', type: 'position', dimensions: [2] }],
    },
    rules: {
      rewards: [],
      terminations: [],
      events: [],
    },
    visuals: {
      renderer: envType === 'grid' ? 'grid' : 'continuous2d',
    },
    metadata: {
      tags: [],
    },
  }
}
