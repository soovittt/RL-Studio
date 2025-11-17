// SceneGraph Manager - Pure JavaScript model for managing EnvSpec
import { EnvSpec, ObjectSpec, AgentSpec, Vec2, ObjectType } from './envSpec'

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class SceneGraphManager {
  private envSpec: EnvSpec

  constructor(envSpec: EnvSpec) {
    this.envSpec = { ...envSpec }
  }

  // Get current spec
  getSpec(): EnvSpec {
    return { ...this.envSpec }
  }

  // Object management
  addObject(
    type: ObjectType,
    position: Vec2,
    size: any = { type: 'point' },
    properties: Record<string, any> = {}
  ): string {
    const id = uuidv4()
    const object: ObjectSpec = {
      id,
      type,
      position,
      size,
      collision: {
        enabled: type !== 'region',
        shape: size.type === 'circle' ? 'circle' : size.type === 'rect' ? 'rect' : 'polygon',
        size,
      },
      properties,
    }
    this.envSpec.objects.push(object)
    return id
  }

  removeObject(objectId: string): boolean {
    const index = this.envSpec.objects.findIndex((o) => o.id === objectId)
    if (index >= 0) {
      this.envSpec.objects.splice(index, 1)
      return true
    }
    return false
  }

  updateObject(objectId: string, updates: Partial<ObjectSpec>): boolean {
    const object = this.envSpec.objects.find((o) => o.id === objectId)
    if (object) {
      Object.assign(object, updates)
      return true
    }
    return false
  }

  getObject(objectId: string): ObjectSpec | undefined {
    return this.envSpec.objects.find((o) => o.id === objectId)
  }

  getObjectsByType(type: ObjectType): ObjectSpec[] {
    return this.envSpec.objects.filter((o) => o.type === type)
  }

  // Agent management
  addAgent(
    name: string,
    position: Vec2,
    dynamics: any = { type: 'grid-step' },
    sensors: any[] = []
  ): string {
    const id = uuidv4()
    const agent: AgentSpec = {
      id,
      name,
      position,
      dynamics,
      sensors,
    }
    this.envSpec.agents.push(agent)
    return id
  }

  removeAgent(agentId: string): boolean {
    const index = this.envSpec.agents.findIndex((a) => a.id === agentId)
    if (index >= 0) {
      this.envSpec.agents.splice(index, 1)
      return true
    }
    return false
  }

  updateAgent(agentId: string, updates: Partial<AgentSpec>): boolean {
    const agent = this.envSpec.agents.find((a) => a.id === agentId)
    if (agent) {
      Object.assign(agent, updates)
      return true
    }
    return false
  }

  getAgent(agentId: string): AgentSpec | undefined {
    return this.envSpec.agents.find((a) => a.id === agentId)
  }

  // World management
  updateWorld(updates: Partial<typeof this.envSpec.world>): void {
    Object.assign(this.envSpec.world, updates)
  }

  // Rule management
  addRewardRule(condition: any, reward: number, shaping: boolean = false): string {
    const id = uuidv4()
    this.envSpec.rules.rewards.push({
      id,
      condition,
      reward,
      shaping,
    })
    return id
  }

  removeRewardRule(ruleId: string): boolean {
    const index = this.envSpec.rules.rewards.findIndex((r) => r.id === ruleId)
    if (index >= 0) {
      this.envSpec.rules.rewards.splice(index, 1)
      return true
    }
    return false
  }

  addTerminationRule(condition: any): string {
    const id = uuidv4()
    this.envSpec.rules.terminations.push({
      id,
      condition,
    })
    return id
  }

  removeTerminationRule(ruleId: string): boolean {
    const index = this.envSpec.rules.terminations.findIndex((r) => r.id === ruleId)
    if (index >= 0) {
      this.envSpec.rules.terminations.splice(index, 1)
      return true
    }
    return false
  }

  // Action/State space management
  updateActionSpace(actionSpace: any): void {
    this.envSpec.actionSpace = actionSpace
  }

  updateStateSpace(stateSpace: any): void {
    this.envSpec.stateSpace = stateSpace
  }

  // Serialization
  toJSON(): string {
    return JSON.stringify(this.envSpec, null, 2)
  }

  static fromJSON(json: string): SceneGraphManager {
    const spec = JSON.parse(json) as EnvSpec
    return new SceneGraphManager(spec)
  }

  // Migration helper: convert old format to new universal format
  static migrateFromLegacy(legacy: any): EnvSpec {
    const envType: EnvType = legacy.type === 'continuous' ? 'continuous2d' : 'grid'
    
    const world: any = {
      coordinateSystem: envType === 'grid' ? 'grid' : 'cartesian',
      width: legacy.spec?.grid?.[0]?.length || legacy.stateSpace?.shape?.[0] || 10,
      height: legacy.spec?.grid?.length || legacy.stateSpace?.shape?.[1] || 10,
      cellSize: envType === 'grid' ? 1 : undefined,
      physics: {
        enabled: envType !== 'grid',
        collisionEnabled: true,
      },
    }

    // Convert grid cells to objects
    const objects: ObjectSpec[] = []
    if (legacy.spec?.grid || legacy.visuals?.grid) {
      const grid = legacy.spec?.grid || legacy.visuals?.grid || []
      grid.forEach((row: string[], r: number) => {
        row.forEach((cell: string, c: number) => {
          if (cell !== 'empty') {
            const objectType: ObjectType = cell === 'wall' ? 'wall' :
              cell === 'goal' ? 'goal' :
              cell === 'trap' ? 'trap' :
              cell === 'key' ? 'key' :
              'obstacle'
            
            objects.push({
              id: uuidv4(),
              type: objectType,
              position: [c, r],
              size: { type: 'point' },
              collision: {
                enabled: objectType === 'wall' || objectType === 'obstacle',
                shape: 'rect',
                size: { type: 'rect', width: 1, height: 1 },
              },
              properties: {},
            })
          }
        })
      })
    }

    // Convert agents
    const agents: AgentSpec[] = (legacy.agents || []).map((a: any) => ({
      id: a.id || uuidv4(),
      name: a.name || 'Agent',
      position: a.position || [0, 0],
      dynamics: { type: envType === 'grid' ? 'grid-step' : 'continuous-velocity', maxSpeed: 1 },
      sensors: [],
    }))

    // Convert reward rules
    const rewards = (legacy.reward?.rules || []).map((r: any) => ({
      id: uuidv4(),
      condition: r.condition || { type: 'custom', script: '' },
      reward: r.value || 0,
      shaping: false,
    }))

    return {
      id: legacy._id || `env_${Date.now()}`,
      name: legacy.name || 'Untitled',
      envType,
      world,
      objects,
      agents,
      actionSpace: legacy.actionSpace || {
        type: 'discrete',
        actions: ['up', 'down', 'left', 'right'],
      },
      stateSpace: {
        type: 'vector',
        dimensions: [2],
        components: [{ name: 'position', type: 'position', dimensions: [2] }],
      },
      rules: {
        rewards,
        terminations: legacy.episode?.termination?.map((t: any) => ({
          id: uuidv4(),
          condition: t,
        })) || [],
        events: [],
      },
      visuals: {
        renderer: envType === 'grid' ? 'grid' : 'continuous2d',
      },
      metadata: {
        tags: legacy.metadata?.tags || [],
        notes: legacy.metadata?.notes,
      },
    }
  }
}

