// Universal Simulator - Works with EnvSpec for all environment types
import { EnvSpec, ConditionSpec, RewardRule, TerminationRule, Vec2, ObjectSpec, AgentSpec } from './envSpec'

export interface SimulatorState {
  agents: Array<{ id: string; position: Vec2; rotation?: number }>
  objects: Array<{ id: string; position: Vec2; rotation?: number; type?: string }>
  step: number
  totalReward: number
  done: boolean
  info: {
    events: string[]
    rewards: Array<{ ruleId: string; value: number; reason: string }>
  }
}

export interface SimulatorStep {
  state: SimulatorState
  action: string | number[]
  reward: number
  done: boolean
}

export interface SimulatorResult {
  steps: SimulatorStep[]
  totalReward: number
  episodeLength: number
  success: boolean
  terminationReason?: string
}

// Check if a condition is satisfied
function evaluateCondition(
  condition: ConditionSpec,
  state: SimulatorState,
  envSpec: EnvSpec
): boolean {
  switch (condition.type) {
    case 'agent_at_position': {
      const agent = state.agents.find((a) => a.id === condition.agentId)
      if (!agent) return false
      const [ax, ay] = agent.position
      const [px, py] = condition.position
      const tolerance = condition.tolerance || 0.5
      const dist = Math.sqrt((ax - px) ** 2 + (ay - py) ** 2)
      return dist <= tolerance
    }

    case 'agent_at_object': {
      const agent = state.agents.find((a) => a.id === condition.agentId)
      const object = state.objects.find((o) => o.id === condition.objectId)
      if (!agent || !object) return false
      const [ax, ay] = agent.position
      const [ox, oy] = object.position
      const dist = Math.sqrt((ax - ox) ** 2 + (ay - oy) ** 2)
      // Check collision based on object size
      const objSpec = envSpec.objects.find((o) => o.id === condition.objectId)
      if (objSpec?.size.type === 'circle') {
        return dist <= objSpec.size.radius + 0.5
      }
      return dist <= 0.5
    }

    case 'collision': {
      const a = state.agents.find((ag) => ag.id === condition.a) || 
                state.objects.find((o) => o.id === condition.a)
      const b = state.agents.find((ag) => ag.id === condition.b) || 
                state.objects.find((o) => o.id === condition.b)
      if (!a || !b) return false
      const [ax, ay] = a.position
      const [bx, by] = b.position
      const dist = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
      return dist < 1.0 // Collision threshold
    }

    case 'timeout':
      return state.step >= condition.steps

    case 'inside_region': {
      const agent = state.agents.find((a) => a.id === condition.agentId)
      const region = state.objects.find((o) => o.id === condition.regionId)
      if (!agent || !region) return false
      // Simple rectangular region check (can be extended for polygons)
      const [ax, ay] = agent.position
      const [rx, ry] = region.position
      const regionObj = envSpec.objects.find((o) => o.id === condition.regionId)
      if (regionObj?.size.type === 'rect') {
        const { width, height } = regionObj.size
        return (
          ax >= rx - width / 2 &&
          ax <= rx + width / 2 &&
          ay >= ry - height / 2 &&
          ay <= ry + height / 2
        )
      }
      // Default: circle region
      const radius = regionObj?.size.type === 'circle' ? regionObj.size.radius : 5
      const dist = Math.sqrt((ax - rx) ** 2 + (ay - ry) ** 2)
      return dist <= radius
    }

    case 'custom':
      try {
        // Evaluate custom script (simplified - in production, use a sandbox)
        const script = condition.script || 'return false'
        // This is a simplified version - in production, use a proper sandbox
        return false // For safety, disable custom scripts in preview
      } catch {
        return false
      }

    default:
      return false
  }
}

// Calculate reward for current state - only uses explicit reward rules
function calculateReward(
  state: SimulatorState,
  envSpec: EnvSpec
): Array<{ ruleId: string; value: number; reason: string }> {
  const rewards: Array<{ ruleId: string; value: number; reason: string }> = []
  
  // Only evaluate explicit reward rules - no hardcoded defaults
  for (const rule of envSpec.rules.rewards) {
    if (evaluateCondition(rule.condition, state, envSpec)) {
      rewards.push({
        ruleId: rule.id,
        value: rule.reward,
        reason: formatCondition(rule.condition),
      })
    }
  }

  return rewards
}

// Check termination conditions
function checkTermination(
  state: SimulatorState,
  envSpec: EnvSpec
): { terminated: boolean; reason?: string } {
  // First check explicit termination rules
  for (const rule of envSpec.rules.terminations) {
    if (rule.condition.type === 'timeout') continue
    if (evaluateCondition(rule.condition, state, envSpec)) {
      return { terminated: true, reason: rule.condition.type }
    }
  }
  
  // Auto-detect goal reaching: if agent is at any goal object, terminate
  if (state.agents.length > 0 && state.objects.length > 0) {
    const agent = state.agents[0]
    const [ax, ay] = agent.position
    
    // Check all goal objects from envSpec
    const goals = envSpec.objects.filter((obj) => obj.type === 'goal')
    
    for (const goal of goals) {
      const [gx, gy] = goal.position
      const distance = Math.sqrt((ax - gx) ** 2 + (ay - gy) ** 2)
      if (distance <= 0.5) {  // Within 0.5 units
        return { terminated: true, reason: 'goal_reached' }
      }
    }
  }
  
  return { terminated: false }
}

// Apply action to state
function applyAction(
  state: SimulatorState,
  action: string | number[] | Record<string, string | number[]>,
  envSpec: EnvSpec
): SimulatorState {
  const newState: SimulatorState = {
    ...state,
    agents: state.agents.map((a) => ({ ...a })),
    objects: state.objects.map((o) => ({ ...o })),
    step: state.step + 1,
    info: {
      events: [...state.info.events],
      rewards: [],
    },
  }

  // Handle multi-agent actions
  if (typeof action === 'object' && !Array.isArray(action)) {
    // Multi-agent: action is a dictionary mapping agent ID to action
    for (const agent of newState.agents) {
      const agentAction = action[agent.id]
      if (!agentAction) continue
      
      if (typeof agentAction === 'string') {
        applyDiscreteActionToAgent(agent, agentAction, newState, envSpec)
      } else if (Array.isArray(agentAction)) {
        applyContinuousActionToAgent(agent, agentAction, newState, envSpec)
      }
    }
    return newState
  }

  // Handle single-agent actions (backward compatibility)
  // Handle discrete actions
  if (typeof action === 'string') {
    const agent = newState.agents[0]
    if (!agent) return newState

    const [x, y] = agent.position
    let newX = x
    let newY = y

    switch (action) {
      case 'up':
        // In grid: up means decrease Y (move up in visual grid where Y=0 is top)
        // In world: up means increase Y (move up in coordinate system)
        newY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        break
      case 'down':
        newY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        break
      case 'left':
        newX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        break
      case 'right':
        newX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        break
      case 'stay':
        break
      default:
        break
    }

    // Check bounds
    const bounds = envSpec.world.coordinateSystem === 'grid'
      ? [[0, envSpec.world.width], [0, envSpec.world.height]]
      : [[-envSpec.world.width / 2, envSpec.world.width / 2], 
         [-envSpec.world.height / 2, envSpec.world.height / 2]]

    newX = Math.max(bounds[0][0], Math.min(bounds[0][1], newX))
    newY = Math.max(bounds[1][0], Math.min(bounds[1][1], newY))
    
    // Snap to grid cells for grid environments (ensures agent stays visible)
    if (envSpec.world.coordinateSystem === 'grid') {
      newX = Math.round(newX)
      newY = Math.round(newY)
    }

    // Check collisions with walls/obstacles
    let hitObstacle = false
    for (const obj of newState.objects) {
      if (obj.id === agent.id) continue
      const objSpec = envSpec.objects.find((o) => o.id === obj.id)
      if (!objSpec || (objSpec.type !== 'wall' && objSpec.type !== 'obstacle')) continue

      const [ox, oy] = obj.position
      const dist = Math.sqrt((newX - ox) ** 2 + (newY - oy) ** 2)
      
      if (objSpec.size.type === 'circle') {
        if (dist < objSpec.size.radius + 0.5) {
          hitObstacle = true
          break
        }
      } else if (objSpec.size.type === 'rect') {
        const { width, height } = objSpec.size
        if (
          newX >= ox - width / 2 &&
          newX <= ox + width / 2 &&
          newY >= oy - height / 2 &&
          newY <= oy + height / 2
        ) {
          hitObstacle = true
          break
        }
      }
    }

    if (!hitObstacle) {
      agent.position = [newX, newY]
      newState.info.events.push(`Moved ${action} to (${newX.toFixed(1)}, ${newY.toFixed(1)})`)
    } else {
      newState.info.events.push(`Hit obstacle, stayed at (${x.toFixed(1)}, ${y.toFixed(1)})`)
    }
  } else {
    // Handle continuous actions
    const agent = newState.agents[0]
    if (!agent || action.length < 2) return newState

    const [dx, dy] = action
    const [x, y] = agent.position
    const maxSpeed = 0.1
    const newX = x + dx * maxSpeed
    const newY = y + dy * maxSpeed

    // Check bounds and collisions (similar to discrete)
    const bounds = [[-envSpec.world.width / 2, envSpec.world.width / 2], 
                    [-envSpec.world.height / 2, envSpec.world.height / 2]]
    agent.position = [
      Math.max(bounds[0][0], Math.min(bounds[0][1], newX)),
      Math.max(bounds[1][0], Math.min(bounds[1][1], newY)),
    ]
    newState.info.events.push(`Moved to (${agent.position[0].toFixed(1)}, ${agent.position[1].toFixed(1)})`)
  }

  return newState
}

// Select action based on policy - returns actions for all agents
function selectAction(
  state: SimulatorState,
  envSpec: EnvSpec,
  policy: 'random' | 'greedy'
): string | number[] | Record<string, string | number[]> {
  if (envSpec.actionSpace.type === 'discrete') {
    const actions = envSpec.actionSpace.actions || ['up', 'down', 'left', 'right']
    
    // Multi-agent support: return actions for all agents
    if (state.agents.length > 1) {
      const agentActions: Record<string, string> = {}
      for (const agent of state.agents) {
        if (policy === 'random') {
          agentActions[agent.id] = actions[Math.floor(Math.random() * actions.length)]
        } else {
          agentActions[agent.id] = selectGreedyActionForAgent(agent, state, envSpec, actions)
        }
      }
      return agentActions
    }
    
    // Single agent (backward compatibility)
    if (policy === 'random') {
      return actions[Math.floor(Math.random() * actions.length)]
    } else {
      // Greedy with obstacle avoidance: move towards nearest goal, avoiding obstacles
      const agent = state.agents[0]
      if (!agent) return actions[0]

      // Find goals from envSpec (source of truth)
      const goalSpecs = envSpec.objects.filter((obj) => obj.type === 'goal')
      
      if (goalSpecs.length === 0) {
        // No goals defined, use random
        return actions[Math.floor(Math.random() * actions.length)]
      }

      // Find the nearest goal
      const [ax, ay] = agent.position
      let nearestGoal = goalSpecs[0]
      let minDist = Infinity

      for (const goalSpec of goalSpecs) {
        const [gx, gy] = goalSpec.position
        const dist = Math.sqrt((gx - ax) ** 2 + (gy - ay) ** 2)
        if (dist < minDist) {
          minDist = dist
          nearestGoal = goalSpec
        }
      }

      const [gx, gy] = nearestGoal.position
      const dx = gx - ax
      const dy = envSpec.world.coordinateSystem === 'grid' ? (ay - gy) : (gy - ay)

      // Helper to check if a position would hit an obstacle
      const wouldHitObstacle = (newX: number, newY: number): boolean => {
        // Check bounds first
        const bounds = envSpec.world.coordinateSystem === 'grid'
          ? [[0, envSpec.world.width], [0, envSpec.world.height]]
          : [[-envSpec.world.width / 2, envSpec.world.width / 2], 
             [-envSpec.world.height / 2, envSpec.world.height / 2]]
        if (newX < bounds[0][0] || newX >= bounds[0][1] || newY < bounds[1][0] || newY >= bounds[1][1]) {
          return true
        }
        
        // Check obstacles
        for (const obj of state.objects) {
          const objSpec = envSpec.objects.find((o) => o.id === obj.id)
          if (!objSpec || (objSpec.type !== 'wall' && objSpec.type !== 'obstacle')) continue
          
          const [ox, oy] = obj.position
          
          // For grid, check if same cell
          if (envSpec.world.coordinateSystem === 'grid') {
            if (Math.abs(newX - ox) < 0.5 && Math.abs(newY - oy) < 0.5) {
              return true
            }
          } else {
            const dist = Math.sqrt((newX - ox) ** 2 + (newY - oy) ** 2)
            if (objSpec.size.type === 'circle') {
              if (dist < objSpec.size.radius + 0.5) return true
            } else if (objSpec.size.type === 'rect') {
              const { width, height } = objSpec.size
              if (
                newX >= ox - width / 2 &&
                newX <= ox + width / 2 &&
                newY >= oy - height / 2 &&
                newY <= oy + height / 2
              ) {
                return true
              }
            } else {
              if (dist < 0.5) return true
            }
          }
        }
        return false
      }

      // Calculate preferred direction
      let preferredAction: string
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Move horizontally first
        if (Math.abs(dx) < 0.1) {
          preferredAction = dy > 0 ? 'up' : 'down'
        } else {
          preferredAction = dx > 0 ? 'right' : 'left'
        }
      } else {
        // Move vertically first
        if (Math.abs(dy) < 0.1) {
          preferredAction = dx > 0 ? 'right' : 'left'
        } else {
          preferredAction = dy > 0 ? 'up' : 'down'
        }
      }

      // Check if preferred action would hit obstacle
      let newX = ax
      let newY = ay
      const stepSize = envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
      
      if (preferredAction === 'up') {
        newY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
      } else if (preferredAction === 'down') {
        newY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
      } else if (preferredAction === 'left') {
        newX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
      } else if (preferredAction === 'right') {
        newX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
      }

      // Check bounds
      const bounds = envSpec.world.coordinateSystem === 'grid'
        ? [[0, envSpec.world.width], [0, envSpec.world.height]]
        : [[-envSpec.world.width / 2, envSpec.world.width / 2], 
           [-envSpec.world.height / 2, envSpec.world.height / 2]]
      newX = Math.max(bounds[0][0], Math.min(bounds[0][1], newX))
      newY = Math.max(bounds[1][0], Math.min(bounds[1][1], newY))
      
      if (envSpec.world.coordinateSystem === 'grid') {
        newX = Math.round(newX)
        newY = Math.round(newY)
      }

      if (!wouldHitObstacle(newX, newY)) {
        return preferredAction
      }

      // Get recent positions to avoid oscillation
      const recentPositions: Array<[number, number]> = []
      const recentEvents = state.info.events.slice(-5) // Last 5 events
      for (const event of recentEvents) {
        if (event.includes('Moved') && event.includes('to')) {
          try {
            const posMatch = event.match(/\(([\d.]+),\s*([\d.]+)\)/)
            if (posMatch) {
              const x = parseFloat(posMatch[1])
              const y = parseFloat(posMatch[2])
              recentPositions.push([x, y])
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Preferred direction blocked, try alternatives (perpendicular first)
      const alternatives: string[] = []
      if (preferredAction === 'up' || preferredAction === 'down') {
        // Was trying vertical, try horizontal
        alternatives.push(dx > 0 ? 'right' : 'left', dx > 0 ? 'left' : 'right')
      } else {
        // Was trying horizontal, try vertical
        alternatives.push(dy > 0 ? 'up' : 'down', dy > 0 ? 'down' : 'up')
      }

      // Try alternatives, avoiding recent positions
      for (const altAction of alternatives) {
        newX = ax
        newY = ay
        
        if (altAction === 'up') {
          newY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        } else if (altAction === 'down') {
          newY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        } else if (altAction === 'left') {
          newX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        } else if (altAction === 'right') {
          newX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        }

        newX = Math.max(bounds[0][0], Math.min(bounds[0][1], newX))
        newY = Math.max(bounds[1][0], Math.min(bounds[1][1], newY))
        
        if (envSpec.world.coordinateSystem === 'grid') {
          newX = Math.round(newX)
          newY = Math.round(newY)
        }

        // Avoid oscillating - don't go to position we just visited
        if (recentPositions.length > 0) {
          const justVisited = recentPositions.slice(-2).some(([px, py]) => 
            Math.abs(newX - px) < 0.1 && Math.abs(newY - py) < 0.1
          )
          if (justVisited) {
            continue
          }
        }

        if (!wouldHitObstacle(newX, newY)) {
          return altAction
        }
      }

      // All preferred directions blocked, try any valid direction (avoiding recent positions)
      for (const action of actions) {
        newX = ax
        newY = ay
        
        if (action === 'up') {
          newY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        } else if (action === 'down') {
          newY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
        } else if (action === 'left') {
          newX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        } else if (action === 'right') {
          newX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
        }

        newX = Math.max(bounds[0][0], Math.min(bounds[0][1], newX))
        newY = Math.max(bounds[1][0], Math.min(bounds[1][1], newY))
        
        if (envSpec.world.coordinateSystem === 'grid') {
          newX = Math.round(newX)
          newY = Math.round(newY)
        }

        // Avoid oscillating
        if (recentPositions.length > 0) {
          const justVisited = recentPositions.slice(-2).some(([px, py]) => 
            Math.abs(newX - px) < 0.1 && Math.abs(newY - py) < 0.1
          )
          if (justVisited) {
            continue
          }
        }

        if (!wouldHitObstacle(newX, newY)) {
          return action
        }
      }

      // All directions blocked, return preferred anyway (will hit obstacle but at least tries)
      return preferredAction
    }
  } else {
    // Continuous action space
    // Multi-agent support
    if (state.agents.length > 1) {
      const agentActions: Record<string, number[]> = {}
      for (const agent of state.agents) {
        if (policy === 'random') {
          agentActions[agent.id] = [Math.random() * 2 - 1, Math.random() * 2 - 1]
        } else {
          agentActions[agent.id] = selectGreedyContinuousActionForAgent(agent, state, envSpec)
        }
      }
      return agentActions
    }
    
    // Single agent (backward compatibility)
    if (policy === 'random') {
      return [Math.random() * 2 - 1, Math.random() * 2 - 1]
    } else {
      // Greedy: move towards nearest goal
      const agent = state.agents[0]
      if (!agent) return [0, 0]

      const goals = state.objects.filter((o) => {
        const objSpec = envSpec.objects.find((obj) => obj.id === o.id)
        return objSpec?.type === 'goal'
      })

      if (goals.length === 0) return [0, 0]

      const [gx, gy] = goals[0].position
      const [ax, ay] = agent.position
      const dx = gx - ax
      const dy = gy - ay
      const dist = Math.sqrt(dx ** 2 + dy ** 2)
      if (dist < 0.1) return [0, 0]
      return [dx / dist, dy / dist]
    }
  }
}

// Helper: Select greedy action for a specific agent
function selectGreedyActionForAgent(
  agent: { id: string; position: Vec2 },
  state: SimulatorState,
  envSpec: EnvSpec,
  actions: string[]
): string {
  // Find goals from envSpec (source of truth)
  const goalSpecs = envSpec.objects.filter((obj) => obj.type === 'goal')
  
  if (goalSpecs.length === 0) {
    return actions[Math.floor(Math.random() * actions.length)]
  }

  // Find the nearest goal
  const [ax, ay] = agent.position
  let nearestGoal = goalSpecs[0]
  let minDist = Infinity

  for (const goalSpec of goalSpecs) {
    const [gx, gy] = goalSpec.position
    const dist = Math.sqrt((gx - ax) ** 2 + (gy - ay) ** 2)
    if (dist < minDist) {
      minDist = dist
      nearestGoal = goalSpec
    }
  }

  const [gx, gy] = nearestGoal.position
  const dx = gx - ax
  const dy = envSpec.world.coordinateSystem === 'grid' ? (ay - gy) : (gy - ay)

  // Helper to check if a position would hit an obstacle
  const wouldHitObstacle = (newX: number, newY: number): boolean => {
    // Check bounds first
    const bounds = envSpec.world.coordinateSystem === 'grid'
      ? [[0, envSpec.world.width], [0, envSpec.world.height]]
      : [[-envSpec.world.width / 2, envSpec.world.width / 2], 
         [-envSpec.world.height / 2, envSpec.world.height / 2]]
    if (newX < bounds[0][0] || newX >= bounds[0][1] || newY < bounds[1][0] || newY >= bounds[1][1]) {
      return true
    }
    
    // Check obstacles and other agents
    for (const obj of state.objects) {
      const objSpec = envSpec.objects.find((o) => o.id === obj.id)
      if (!objSpec || (objSpec.type !== 'wall' && objSpec.type !== 'obstacle')) continue
      
      const [ox, oy] = obj.position
      
      if (envSpec.world.coordinateSystem === 'grid') {
        if (Math.abs(newX - ox) < 0.5 && Math.abs(newY - oy) < 0.5) {
          return true
        }
      } else {
        const dist = Math.sqrt((newX - ox) ** 2 + (newY - oy) ** 2)
        if (objSpec.size.type === 'circle') {
          if (dist < objSpec.size.radius + 0.5) return true
        } else if (objSpec.size.type === 'rect') {
          const { width, height } = objSpec.size
          if (
            newX >= ox - width / 2 &&
            newX <= ox + width / 2 &&
            newY >= oy - height / 2 &&
            newY <= oy + height / 2
          ) {
            return true
          }
        } else {
          if (dist < 0.5) return true
        }
      }
    }
    
    // Check other agents (avoid collisions)
    for (const otherAgent of state.agents) {
      if (otherAgent.id === agent.id) continue
      const [ox, oy] = otherAgent.position
      const dist = Math.sqrt((newX - ox) ** 2 + (newY - oy) ** 2)
      if (dist < 0.5) return true
    }
    
    return false
  }

  // Calculate preferred direction
  let preferredAction: string
  if (Math.abs(dx) >= Math.abs(dy)) {
    preferredAction = Math.abs(dx) < 0.1 ? (dy > 0 ? 'up' : 'down') : (dx > 0 ? 'right' : 'left')
  } else {
    preferredAction = Math.abs(dy) < 0.1 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'up' : 'down')
  }

  // Check if preferred action would hit obstacle
  let newX = ax
  let newY = ay
  const stepSize = envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
  
  if (preferredAction === 'up') {
    newY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
  } else if (preferredAction === 'down') {
    newY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
  } else if (preferredAction === 'left') {
    newX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
  } else if (preferredAction === 'right') {
    newX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
  }

  // Check bounds
  const bounds = envSpec.world.coordinateSystem === 'grid'
    ? [[0, envSpec.world.width], [0, envSpec.world.height]]
    : [[-envSpec.world.width / 2, envSpec.world.width / 2], 
       [-envSpec.world.height / 2, envSpec.world.height / 2]]
  newX = Math.max(bounds[0][0], Math.min(bounds[0][1], newX))
  newY = Math.max(bounds[1][0], Math.min(bounds[1][1], newY))
  
  if (envSpec.world.coordinateSystem === 'grid') {
    newX = Math.round(newX)
    newY = Math.round(newY)
  }

  if (!wouldHitObstacle(newX, newY)) {
    return preferredAction
  }

  // Try alternatives
  const alternatives = preferredAction in ['up', 'down'] 
    ? [dx > 0 ? 'right' : 'left', dx > 0 ? 'left' : 'right']
    : [dy > 0 ? 'up' : 'down', dy > 0 ? 'down' : 'up']

  for (const altAction of alternatives) {
    let altX = ax
    let altY = ay
    if (altAction === 'up') altY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
    else if (altAction === 'down') altY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
    else if (altAction === 'left') altX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
    else if (altAction === 'right') altX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
    
    altX = Math.max(bounds[0][0], Math.min(bounds[0][1], altX))
    altY = Math.max(bounds[1][0], Math.min(bounds[1][1], altY))
    if (envSpec.world.coordinateSystem === 'grid') {
      altX = Math.round(altX)
      altY = Math.round(altY)
    }
    
    if (!wouldHitObstacle(altX, altY)) {
      return altAction
    }
  }

  // Try any valid action
  for (const action of actions) {
    let testX = ax
    let testY = ay
    if (action === 'up') testY += envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
    else if (action === 'down') testY -= envSpec.world.coordinateSystem === 'grid' ? -1 : 0.1
    else if (action === 'left') testX -= envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
    else if (action === 'right') testX += envSpec.world.coordinateSystem === 'grid' ? 1 : 0.1
    
    testX = Math.max(bounds[0][0], Math.min(bounds[0][1], testX))
    testY = Math.max(bounds[1][0], Math.min(bounds[1][1], testY))
    if (envSpec.world.coordinateSystem === 'grid') {
      testX = Math.round(testX)
      testY = Math.round(testY)
    }
    
    if (!wouldHitObstacle(testX, testY)) {
      return action
    }
  }

  return preferredAction
}

// Helper: Select greedy continuous action for a specific agent
function selectGreedyContinuousActionForAgent(
  agent: { id: string; position: Vec2 },
  state: SimulatorState,
  envSpec: EnvSpec
): number[] {
  const [ax, ay] = agent.position
  const goals = envSpec.objects.filter((obj) => obj.type === 'goal')
  
  if (goals.length === 0) {
    return [0, 0]
  }

  // Find nearest goal
  let nearestGoal = goals[0]
  let minDist = Infinity
  for (const goal of goals) {
    const [gx, gy] = goal.position
    const dist = Math.sqrt((gx - ax) ** 2 + (gy - ay) ** 2)
    if (dist < minDist) {
      minDist = dist
      nearestGoal = goal
    }
  }

  const [gx, gy] = nearestGoal.position
  const dx = gx - ax
  const dy = gy - ay
  const dist = Math.sqrt(dx ** 2 + dy ** 2)
  if (dist < 0.1) return [0, 0]
  return [dx / dist, dy / dist]
}

// Format condition for display
function formatCondition(condition: ConditionSpec): string {
  switch (condition.type) {
    case 'agent_at_position':
      return `Agent at (${condition.position[0]}, ${condition.position[1]})`
    case 'agent_at_object':
      return 'Agent at object'
    case 'collision':
      return 'Collision'
    case 'timeout':
      return `After ${condition.steps} steps`
    case 'inside_region':
      return 'Agent inside region'
    case 'custom':
      return 'Custom condition'
    default:
      return 'Unknown condition'
  }
}

// Create initial state from EnvSpec
export function createInitialState(envSpec: EnvSpec): SimulatorState {
  return {
    agents: (envSpec.agents || []).map((a) => ({
      id: a.id,
      position: Array.isArray(a.position) ? [...a.position] as Vec2 : [0, 0] as Vec2,
      rotation: a.rotation || 0,
    })),
    objects: (envSpec.objects || []).map((o) => ({
      id: o.id,
      position: Array.isArray(o.position) ? [...o.position] as Vec2 : [0, 0] as Vec2,
      rotation: o.rotation || 0,
      type: o.type,
    })),
    step: 0,
    totalReward: 0,
    done: false,
    info: {
      events: ['Episode started'],
      rewards: [],
    },
  }
}

// Step the simulator
export function stepSimulator(
  state: SimulatorState,
  action: string | number[],
  envSpec: EnvSpec,
  maxSteps: number
): SimulatorState {
  if (state.done) return state

  // Apply action
  let newState = applyAction(state, action, envSpec)

  // Calculate rewards
  const rewardDetails = calculateReward(newState, envSpec)
  const stepReward = rewardDetails.reduce((sum, r) => sum + r.value, 0)
  newState.totalReward += stepReward
  newState.info.rewards = rewardDetails

  // Check termination
  const termination = checkTermination(newState, envSpec)
  if (termination.terminated) {
    newState.done = true
    newState.info.events.push(`Terminated: ${termination.reason}`)
  }

  // Check max steps (use parameter, not timeout rule)
  if (newState.step >= maxSteps) {
    newState.done = true
    newState.info.events.push(`Max steps (${maxSteps}) reached`)
  }

  return newState
}

// Validate EnvSpec before running rollout
export function validateEnvSpec(envSpec: EnvSpec): { valid: boolean; error?: string } {
  // Check required fields
  if (!envSpec.world) {
    return { valid: false, error: "EnvSpec missing 'world' field" }
  }

  if (!envSpec.world.width || !envSpec.world.height) {
    return { valid: false, error: "World spec must have 'width' and 'height'" }
  }

  if (envSpec.world.width <= 0 || envSpec.world.height <= 0) {
    return { valid: false, error: "World width and height must be positive" }
  }

  // Check agents
  if (!Array.isArray(envSpec.agents) || envSpec.agents.length === 0) {
    return { valid: false, error: "Environment must have at least one agent" }
  }

  // Validate each agent
  for (let i = 0; i < envSpec.agents.length; i++) {
    const agent = envSpec.agents[i]
    if (!Array.isArray(agent.position) || agent.position.length < 2) {
      return { valid: false, error: `Agent ${i} position must be [x, y]` }
    }
    const [x, y] = agent.position
    if (typeof x !== 'number' || typeof y !== 'number') {
      return { valid: false, error: `Agent ${i} position must be numeric` }
    }
    if (envSpec.world.coordinateSystem === 'grid') {
      if (x < 0 || x >= envSpec.world.width || y < 0 || y >= envSpec.world.height) {
        return { valid: false, error: `Agent ${i} position (${x}, ${y}) is out of bounds` }
      }
    }
  }

  // Check action space
  if (!envSpec.actionSpace) {
    return { valid: false, error: "Action space is required" }
  }

  if (envSpec.actionSpace.type === 'discrete') {
    if (!Array.isArray(envSpec.actionSpace.actions) || envSpec.actionSpace.actions.length === 0) {
      return { valid: false, error: "Discrete action space must have non-empty 'actions' list" }
    }
  }

  // Check objects (optional but validate if present)
  if (envSpec.objects) {
    for (let i = 0; i < envSpec.objects.length; i++) {
      const obj = envSpec.objects[i]
      if (Array.isArray(obj.position) && obj.position.length >= 2) {
        const [x, y] = obj.position
        if (typeof x === 'number' && typeof y === 'number') {
          if (envSpec.world.coordinateSystem === 'grid') {
            if (x < 0 || x >= envSpec.world.width || y < 0 || y >= envSpec.world.height) {
              // Objects can be slightly out of bounds, but warn if way out
              if (x < -envSpec.world.width || x > envSpec.world.width * 2 ||
                  y < -envSpec.world.height || y > envSpec.world.height * 2) {
                return { valid: false, error: `Object ${i} position (${x}, ${y}) is way out of bounds` }
              }
            }
          }
        }
      }
    }
  }

  // Validate reward rules - must be defined
  if (!envSpec.rules || !Array.isArray(envSpec.rules.rewards) || envSpec.rules.rewards.length === 0) {
    return { 
      valid: false, 
      error: "No reward rules defined. Please add reward rules in the Rules panel (right sidebar → Rewards tab)" 
    }
  }

  // Validate termination rules - must be defined
  if (!envSpec.rules || !Array.isArray(envSpec.rules.terminations) || envSpec.rules.terminations.length === 0) {
    return { 
      valid: false, 
      error: "No termination rules defined. Please add termination rules in the Rules panel (right sidebar → Terminations tab)" 
    }
  }

  return { valid: true }
}

// Run a single rollout
export function runUniversalRollout(
  envSpec: EnvSpec,
  policy: 'random' | 'greedy' = 'random',
  maxSteps: number = 100
): SimulatorResult {
  // Validate environment first
  const validation = validateEnvSpec(envSpec)
  if (!validation.valid) {
    return {
      steps: [],
      totalReward: 0,
      episodeLength: 0,
      success: false,
      terminationReason: `Validation failed: ${validation.error}`,
    }
  }

  let state = createInitialState(envSpec)
  const steps: SimulatorStep[] = []

  // maxSteps parameter takes precedence (user input from frontend)
  // The frontend already handles priority: user input > timeout rule > default

  while (!state.done && state.step < maxSteps) {
    // Select action
    const action = selectAction(state, envSpec, policy)

    // Step environment (pass maxSteps parameter)
    const prevReward = state.totalReward
    state = stepSimulator(state, action, envSpec, maxSteps)
    const stepReward = state.totalReward - prevReward

    steps.push({
      state: {
        ...state,
        agents: state.agents.map((a) => ({ 
          ...a, 
          position: Array.isArray(a.position) ? [...a.position] as Vec2 : [0, 0] as Vec2 
        })),
        objects: state.objects.map((o) => ({ 
          ...o, 
          position: Array.isArray(o.position) ? [...o.position] as Vec2 : [0, 0] as Vec2 
        })),
        info: {
          ...state.info,
          events: [...state.info.events],
          rewards: [...state.info.rewards],
        },
      },
      action,
      reward: stepReward,
      done: state.done,
    })
  }

  // Check if agent reached goal position
  let success = false
  if (state.agents.length > 0) {
    const agent = state.agents[0]
    const [ax, ay] = agent.position
    
    // Check if agent is at any goal
    const goals = envSpec.objects.filter((obj) => obj.type === 'goal')
    for (const goal of goals) {
      const [gx, gy] = goal.position
      const distance = Math.sqrt((ax - gx) ** 2 + (ay - gy) ** 2)
      if (distance < 0.5) {  // Within 0.5 units of goal
        success = true
        break
      }
    }
  }
  
  // Also check events for goal-related messages
  if (!success) {
    success = state.info.events.some((e) => 
      e.includes('goal') || e.includes('Goal') || e.includes('reached goal')
    )
  }

  return {
    steps,
    totalReward: state.totalReward,
    episodeLength: state.step,
    success,
    terminationReason: state.info.events[state.info.events.length - 1],
  }
}

