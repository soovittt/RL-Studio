// Simple gridworld simulator for test rollouts

export interface GridState {
  grid: string[][]
  agentPos: [number, number]
  step: number
  reward: number
  done: boolean
  info: {
    events: string[]
  }
}

export interface RolloutStep {
  state: GridState
  action: string
  reward: number
  done: boolean
}

export interface RolloutResult {
  steps: RolloutStep[]
  totalReward: number
  episodeLength: number
  success: boolean
}

// Find agent position in grid
function findAgent(grid: string[][]): [number, number] | null {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col] === 'agent') {
        return [row, col]
      }
    }
  }
  return null
}

// Get cell type at position
function getCellType(grid: string[][], row: number, col: number): string {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) {
    return 'wall' // Out of bounds = wall
  }
  return grid[row][col] || 'empty'
}

// Calculate reward based on reward rules
function calculateReward(
  cellType: string,
  rewardRules: Array<{ condition: { type: string }; value: number }>,
  isStep: boolean = false
): number {
  let reward = 0

  // Apply step penalty
  if (isStep) {
    const stepRule = rewardRules.find((r) => r.condition.type === 'step')
    if (stepRule) {
      reward += stepRule.value
    }
  }

  // Apply cell-specific rewards
  const cellRule = rewardRules.find((r) => r.condition.type === cellType)
  if (cellRule) {
    reward += cellRule.value
  }

  return reward
}

// Apply action to grid state
function applyAction(
  grid: string[][],
  agentPos: [number, number],
  action: string
): { newPos: [number, number]; cellType: string; hitWall: boolean } {
  const [row, col] = agentPos
  let newRow = row
  let newCol = col
  let hitWall = false

  switch (action) {
    case 'up':
      newRow = row - 1
      break
    case 'down':
      newRow = row + 1
      break
    case 'left':
      newCol = col - 1
      break
    case 'right':
      newCol = col + 1
      break
    case 'stay':
      return { newPos: [row, col], cellType: getCellType(grid, row, col), hitWall: false }
    default:
      return { newPos: [row, col], cellType: getCellType(grid, row, col), hitWall: false }
  }

  const newCellType = getCellType(grid, newRow, newCol)

  // Check if hit wall
  if (newCellType === 'wall') {
    hitWall = true
    return { newPos: [row, col], cellType: getCellType(grid, row, col), hitWall: true }
  }

  return { newPos: [newRow, newCol], cellType: newCellType, hitWall: false }
}

// Create initial state
export function createInitialState(grid: string[][]): GridState {
  const agentPos = findAgent(grid)
  if (!agentPos) {
    // If no agent, place at (0, 0)
    const newGrid = grid.map((r) => [...r])
    newGrid[0][0] = 'agent'
    return {
      grid: newGrid,
      agentPos: [0, 0],
      step: 0,
      reward: 0,
      done: false,
      info: { events: ['Episode started'] },
    }
  }

  return {
    grid: grid.map((r) => [...r]),
    agentPos,
    step: 0,
    reward: 0,
    done: false,
    info: { events: ['Episode started'] },
  }
}

// Step the environment
export function stepEnvironment(
  state: GridState,
  action: string,
  rewardRules: Array<{ condition: { type: string }; value: number }>,
  maxSteps: number
): GridState {
  if (state.done) {
    return state
  }

  const newStep = state.step + 1
  const { newPos, cellType, hitWall } = applyAction(state.grid, state.agentPos, action)

  // Create new grid with agent moved
  const newGrid = state.grid.map((r) => [...r])
  // Remove agent from old position
  newGrid[state.agentPos[0]][state.agentPos[1]] = 'empty'
  // Place agent at new position (unless it's goal/trap, which we'll handle)
  newGrid[newPos[0]][newPos[1]] = 'agent'

  // Calculate reward
  const stepReward = calculateReward(cellType, rewardRules, true)
  const newReward = state.reward + stepReward

  // Check termination
  let done = false
  const events = [...state.info.events]

  if (cellType === 'goal') {
    done = true
    events.push(`Reached goal at step ${newStep}!`)
  } else if (cellType === 'trap') {
    done = true
    events.push(`Hit trap at step ${newStep}!`)
  } else if (newStep >= maxSteps) {
    done = true
    events.push(`Max steps (${maxSteps}) reached`)
  } else if (hitWall) {
    events.push(`Hit wall at step ${newStep}`)
  } else {
    events.push(`Moved ${action} to (${newPos[0]}, ${newPos[1]})`)
  }

  return {
    grid: newGrid,
    agentPos: newPos,
    step: newStep,
    reward: newReward,
    done,
    info: { events },
  }
}

// Random action policy
function randomAction(actions: string[]): string {
  return actions[Math.floor(Math.random() * actions.length)]
}

// Greedy policy (towards goal)
function greedyAction(state: GridState, actions: string[]): string {
  // Find goal position
  let goalPos: [number, number] | null = null
  for (let row = 0; row < state.grid.length; row++) {
    for (let col = 0; col < state.grid[row].length; col++) {
      if (state.grid[row][col] === 'goal') {
        goalPos = [row, col]
        break
      }
    }
    if (goalPos) break
  }

  if (!goalPos) {
    return randomAction(actions)
  }

  const [agentRow, agentCol] = state.agentPos
  const [goalRow, goalCol] = goalPos

  // Choose action that moves towards goal
  const rowDiff = goalRow - agentRow
  const colDiff = goalCol - agentCol

  if (Math.abs(rowDiff) > Math.abs(colDiff)) {
    return rowDiff > 0 ? 'down' : 'up'
  } else {
    return colDiff > 0 ? 'right' : 'left'
  }
}

// Run a single rollout
export function runRollout(
  grid: string[][],
  rewardRules: Array<{ condition: { type: string }; value: number }>,
  maxSteps: number = 100,
  policy: 'random' | 'greedy' = 'random'
): RolloutResult {
  const actions = ['up', 'down', 'left', 'right']
  let state = createInitialState(grid)
  const steps: RolloutStep[] = []

  while (!state.done && state.step < maxSteps) {
    // Select action
    const action = policy === 'greedy' ? greedyAction(state, actions) : randomAction(actions)

    // Step environment
    const prevReward = state.reward
    state = stepEnvironment(state, action, rewardRules, maxSteps)
    const stepReward = state.reward - prevReward

    steps.push({
      state: {
        ...state,
        grid: state.grid.map((r) => [...r]), // Deep copy
      },
      action,
      reward: stepReward,
      done: state.done,
    })
  }

  const success = state.info.events.some((e) => e.includes('Reached goal'))

  return {
    steps,
    totalReward: state.reward,
    episodeLength: state.step,
    success,
  }
}

// Run multiple rollouts and return statistics
export function runMultipleRollouts(
  grid: string[][],
  rewardRules: Array<{ condition: { type: string }; value: number }>,
  maxSteps: number = 100,
  numEpisodes: number = 10,
  policy: 'random' | 'greedy' = 'random'
): {
  results: RolloutResult[]
  stats: {
    avgReward: number
    avgLength: number
    successRate: number
  }
} {
  const results: RolloutResult[] = []

  for (let i = 0; i < numEpisodes; i++) {
    results.push(runRollout(grid, rewardRules, maxSteps, policy))
  }

  const avgReward = results.reduce((sum, r) => sum + r.totalReward, 0) / results.length
  const avgLength = results.reduce((sum, r) => sum + r.episodeLength, 0) / results.length
  const successRate = results.filter((r) => r.success).length / results.length

  return {
    results,
    stats: {
      avgReward,
      avgLength,
      successRate,
    },
  }
}
