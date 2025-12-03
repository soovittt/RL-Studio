import { useMemo, memo } from 'react'
import { EnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'

interface TrainingVisualizationProps {
  envSpec: EnvSpec
  agentPosition?: [number, number]
  agentId?: string
  readonly?: boolean
}

export const TrainingVisualization = memo(function TrainingVisualization({
  envSpec,
  agentPosition,
  agentId,
  readonly = true,
}: TrainingVisualizationProps) {
  // Create a modified envSpec with the agent's current position
  const displaySpec = useMemo(() => {
    if (!agentPosition || !agentId) return envSpec

    return {
      ...envSpec,
      agents: envSpec.agents.map((agent) =>
        agent.id === agentId ? { ...agent, position: agentPosition } : agent
      ),
    }
  }, [envSpec, agentPosition, agentId])

  const sceneGraph = useMemo(() => {
    return new SceneGraphManager(displaySpec)
  }, [displaySpec])

  // Render grid environment
  if (displaySpec.envType === 'grid') {
    const world = displaySpec.world
    const width = world.width
    const height = world.height
    const cellSize = world.cellSize || 1

    const OBJECT_COLORS: Record<string, string> = {
      wall: 'bg-gray-800',
      agent: 'bg-blue-500',
      goal: 'bg-green-500',
      obstacle: 'bg-gray-600',
      region: 'bg-yellow-200',
      checkpoint: 'bg-purple-500',
      trap: 'bg-red-500',
      key: 'bg-yellow-500',
      door: 'bg-orange-500',
      custom: 'bg-gray-400',
    }

    const gridToWorld = (gridX: number, gridY: number) => [gridX * cellSize, gridY * cellSize]
    const worldToGrid = (worldX: number, worldY: number) => [
      Math.floor(worldX / cellSize),
      Math.floor(worldY / cellSize),
    ]

    const getObjectAt = (gridX: number, gridY: number) => {
      const worldPos = gridToWorld(gridX, gridY)
      return (
        displaySpec.objects.find((obj) => {
          const [objX, objY] = obj.position
          return (
            Math.floor(objX) === Math.floor(worldPos[0]) &&
            Math.floor(objY) === Math.floor(worldPos[1])
          )
        }) || null
      )
    }

    const getAgentAt = (gridX: number, gridY: number) => {
      const worldPos = gridToWorld(gridX, gridY)
      return (
        displaySpec.agents.find((agent) => {
          const [agentX, agentY] = agent.position
          return (
            Math.floor(agentX) === Math.floor(worldPos[0]) &&
            Math.floor(agentY) === Math.floor(worldPos[1])
          )
        }) || null
      )
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 p-4 overflow-auto">
        <div className="inline-block border border-border rounded-lg p-4 bg-white">
          <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
            {Array.from({ length: height }).map((_, y) =>
              Array.from({ length: width }).map((_, x) => {
                const object = getObjectAt(x, y)
                const agent = getAgentAt(x, y)
                const cellType = object?.type || agent ? 'agent' : 'empty'
                const color = object
                  ? OBJECT_COLORS[object.type] || 'bg-gray-400'
                  : agent
                    ? OBJECT_COLORS.agent
                    : 'bg-white'

                return (
                  <div key={`${x}-${y}`} className={`w-10 h-10 border border-gray-300 ${color}`} />
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render continuous environment
  if (displaySpec.envType === 'continuous2d') {
    const world = displaySpec.world
    const bounds =
      world.coordinateSystem === 'cartesian'
        ? [
            [-world.width / 2, world.width / 2],
            [-world.height / 2, world.height / 2],
          ]
        : [
            [0, world.width],
            [0, world.height],
          ]

    const canvasWidth = 600
    const canvasHeight = 600

    const worldToCanvas = (worldX: number, worldY: number): [number, number] => {
      const [xMin, xMax] = bounds[0]
      const [yMin, yMax] = bounds[1]
      const x = ((worldX - xMin) / (xMax - xMin)) * canvasWidth
      const y = canvasHeight - ((worldY - yMin) / (yMax - yMin)) * canvasHeight
      return [x, y]
    }

    const OBJECT_COLORS: Record<string, string> = {
      wall: '#6b7280',
      agent: '#3b82f6',
      goal: '#10b981',
      obstacle: '#6b7280',
      region: '#fef08a',
      checkpoint: '#a855f7',
      trap: '#ef4444',
      key: '#eab308',
      door: '#f97316',
      custom: '#9ca3af',
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 p-4">
        <div className="border border-border rounded-lg bg-white">
          <svg width={canvasWidth} height={canvasHeight} className="block">
            {/* Grid */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={canvasWidth} height={canvasHeight} fill="url(#grid)" />

            {/* Bounds */}
            <rect
              x="0"
              y="0"
              width={canvasWidth}
              height={canvasHeight}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
            />

            {/* Objects */}
            {displaySpec.objects.map((obj) => {
              const [px, py] = worldToCanvas(obj.position[0], obj.position[1])
              const color = OBJECT_COLORS[obj.type] || '#9ca3af'
              const radius = obj.size.type === 'circle' ? obj.size.radius : 8

              return (
                <circle
                  key={obj.id}
                  cx={px}
                  cy={py}
                  r={radius}
                  fill={color}
                  stroke={obj.type === 'obstacle' || obj.type === 'wall' ? '#374151' : 'none'}
                  strokeWidth={obj.type === 'obstacle' || obj.type === 'wall' ? 2 : 0}
                />
              )
            })}

            {/* Agents */}
            {displaySpec.agents.map((agent) => {
              const [px, py] = worldToCanvas(agent.position[0], agent.position[1])
              return (
                <circle
                  key={agent.id}
                  cx={px}
                  cy={py}
                  r={8}
                  fill={OBJECT_COLORS.agent}
                  stroke="#1e40af"
                  strokeWidth="3"
                />
              )
            })}
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-12 text-muted-foreground">
      Visualization for {envSpec.envType} environment coming soon
    </div>
  )
})
