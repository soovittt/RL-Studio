// GridCanvas - Universal grid renderer using EnvSpec/ObjectSpec
import { useState, useEffect, useRef } from 'react'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'

interface GridCanvasProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
}

const OBJECT_COLORS: Record<ObjectType, string> = {
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

export function GridCanvas({ envSpec, sceneGraph, onSpecChange, rolloutState }: GridCanvasProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  const [selectedTool, setSelectedTool] = useState<ObjectType>('wall')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Vec2 | null>(null)

  const world = envSpec.world
  const width = world.width
  const height = world.height
  const cellSize = world.cellSize || 1

  // Convert grid position to world coordinates
  const gridToWorld = (gridX: number, gridY: number): Vec2 => {
    return [gridX * cellSize, gridY * cellSize]
  }

  // Convert world coordinates to grid position
  const worldToGrid = (worldX: number, worldY: number): Vec2 => {
    return [Math.floor(worldX / cellSize), Math.floor(worldY / cellSize)]
  }

  // Get object at grid position
  const getObjectAt = (gridX: number, gridY: number): ObjectSpec | null => {
    const worldPos = gridToWorld(gridX, gridY)
    return envSpec.objects.find((obj) => {
      const [objX, objY] = obj.position
      return Math.floor(objX) === Math.floor(worldPos[0]) && 
             Math.floor(objY) === Math.floor(worldPos[1])
    }) || null
  }

  // Get agent at grid position (use rollout state if available, otherwise use envSpec)
  const getAgentAt = (gridX: number, gridY: number) => {
    const worldPos = gridToWorld(gridX, gridY)
    const agentsToCheck = rolloutState?.agents || envSpec.agents.map(a => ({ id: a.id, position: a.position }))
    
    // For each agent, check if it's in this grid cell
    for (const agent of agentsToCheck) {
      const [agentX, agentY] = agent.position
      
      // Convert agent world position to grid coordinates
      const agentGridX = Math.floor(agentX / cellSize)
      const agentGridY = Math.floor(agentY / cellSize)
      
      // Check if this agent is in the current grid cell
      if (agentGridX === gridX && agentGridY === gridY) {
        return agent
      }
      
      // Also check with tolerance for floating point precision issues
      const cellWorldX = worldPos[0]
      const cellWorldY = worldPos[1]
      const tolerance = cellSize * 0.5
      if (Math.abs(agentX - cellWorldX) < tolerance && 
          Math.abs(agentY - cellWorldY) < tolerance) {
        return agent
      }
    }
    
    return null
  }

  const handleCellClick = (gridX: number, gridY: number) => {
    // Check if clicking on existing object/agent
    const existingObject = getObjectAt(gridX, gridY)
    const existingAgent = getAgentAt(gridX, gridY)

    if (existingObject) {
      // Select existing object
      selectObject(existingObject.id)
      return
    }

    if (existingAgent) {
      // Select existing agent
      selectAgent(existingAgent.id)
      return
    }

    // Place new object or agent
    const worldPos = gridToWorld(gridX, gridY)

    if (selectedTool === 'agent') {
      // Remove existing agent if placing new one
      if (envSpec.agents.length > 0) {
        sceneGraph.removeAgent(envSpec.agents[0].id)
      }
      sceneGraph.addAgent('Agent', worldPos, { type: 'grid-step' })
    } else {
      sceneGraph.addObject(
        selectedTool,
        worldPos,
        { type: 'rect', width: cellSize, height: cellSize },
        {}
      )
    }

    onSpecChange(sceneGraph.getSpec())
  }

  const handleCellRightClick = (e: React.MouseEvent, gridX: number, gridY: number) => {
    e.preventDefault()
    const existingObject = getObjectAt(gridX, gridY)
    const existingAgent = getAgentAt(gridX, gridY)

    if (existingObject) {
      sceneGraph.removeObject(existingObject.id)
      onSpecChange(sceneGraph.getSpec())
    } else if (existingAgent) {
      sceneGraph.removeAgent(existingAgent.id)
      onSpecChange(sceneGraph.getSpec())
    }
  }

  // Render grid cells
  const renderGrid = () => {
    const cells: JSX.Element[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const object = getObjectAt(x, y)
        const agent = getAgentAt(x, y)
        const isSelected = 
          (object && selection.selectedObjectId === object.id) ||
          (agent && selection.selectedAgentId === agent.id)

        const cellType = object?.type || agent ? 'agent' : 'empty'
        const color = object 
          ? OBJECT_COLORS[object.type] 
          : agent 
            ? OBJECT_COLORS.agent 
            : 'bg-white'

        cells.push(
          <button
            key={`${x}-${y}`}
            onClick={() => handleCellClick(x, y)}
            onContextMenu={(e) => handleCellRightClick(e, x, y)}
            className={`w-10 h-10 border border-gray-300 ${color} hover:opacity-80 transition-opacity ${
              isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
            }`}
            title={`${x}, ${y}${object ? ` - ${object.type}` : ''}${agent ? ` - ${agent.name}` : ''}`}
          />
        )
      }
    }

    return cells
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tool Palette */}
      <div className="p-2 border-b border-border flex gap-2 flex-wrap">
        {Object.entries(OBJECT_COLORS).map(([type, color]) => (
          <button
            key={type}
            onClick={() => setSelectedTool(type as ObjectType)}
            className={`px-3 py-1 rounded text-sm border ${
              selectedTool === type
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            }`}
          >
            <span className={`inline-block w-3 h-3 ${color} rounded mr-2`} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-auto p-4">
        <div className="inline-block border border-border rounded-lg p-4 bg-white">
          <div 
            className="grid gap-0" 
            style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
          >
            {renderGrid()}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 text-sm text-muted-foreground border-t border-border">
        Grid: {width} × {height} | Objects: {envSpec.objects.length} | Agents: {envSpec.agents.length}
      </div>
    </div>
  )
}

