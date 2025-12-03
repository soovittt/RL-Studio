// ContinuousCanvas - Universal continuous 2D renderer using EnvSpec/ObjectSpec
import { useState, useRef, useEffect } from 'react'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'

interface ContinuousCanvasProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
}

const OBJECT_COLORS: Record<ObjectType, string> = {
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

const OBJECT_RADIUS: Record<ObjectType, number> = {
  wall: 8,
  agent: 8,
  goal: 6,
  obstacle: 12,
  region: 0, // Regions are drawn differently
  checkpoint: 6,
  trap: 6,
  key: 5,
  door: 8,
  custom: 6,
}

export function ContinuousCanvas({ envSpec, sceneGraph, onSpecChange }: ContinuousCanvasProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedTool, setSelectedTool] = useState<ObjectType>('agent')
  const [isDragging, setIsDragging] = useState(false)
  const [dragTarget, setDragTarget] = useState<ObjectSpec | null>(null)
  const [dragAgent, setDragAgent] = useState<string | null>(null)

  const world = envSpec.world
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

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = (worldX: number, worldY: number): [number, number] => {
    const [xMin, xMax] = bounds[0]
    const [yMin, yMax] = bounds[1]
    const x = ((worldX - xMin) / (xMax - xMin)) * canvasWidth
    const y = canvasHeight - ((worldY - yMin) / (yMax - yMin)) * canvasHeight
    return [x, y]
  }

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = (canvasX: number, canvasY: number): Vec2 => {
    const [xMin, xMax] = bounds[0]
    const [yMin, yMax] = bounds[1]
    const worldX = (canvasX / canvasWidth) * (xMax - xMin) + xMin
    const worldY = ((canvasHeight - canvasY) / canvasHeight) * (yMax - yMin) + yMin
    return [worldX, worldY]
  }

  // Get object at canvas position
  const getObjectAt = (canvasX: number, canvasY: number): ObjectSpec | null => {
    const threshold = 15
    for (const obj of envSpec.objects) {
      const [objX, objY] = obj.position
      const [px, py] = worldToCanvas(objX, objY)
      const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2)
      const radius = obj.size.type === 'circle' ? obj.size.radius : OBJECT_RADIUS[obj.type] || 8
      if (dist < Math.max(threshold, radius)) {
        return obj
      }
    }
    return null
  }

  // Get agent at canvas position
  const getAgentAt = (canvasX: number, canvasY: number) => {
    const threshold = 15
    for (const agent of envSpec.agents) {
      const [agentX, agentY] = agent.position
      const [px, py] = worldToCanvas(agentX, agentY)
      const dist = Math.sqrt((canvasX - px) ** 2 + (canvasY - py) ** 2)
      if (dist < threshold) {
        return agent
      }
    }
    return null
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const worldPos = canvasToWorld(x, y)

    const existingObject = getObjectAt(x, y)
    const existingAgent = getAgentAt(x, y)

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
    if (selectedTool === 'agent') {
      // Remove existing agent if placing new one
      if (envSpec.agents.length > 0) {
        sceneGraph.removeAgent(envSpec.agents[0].id)
      }
      sceneGraph.addAgent('Agent', worldPos, { type: 'continuous-velocity', maxSpeed: 1 })
    } else {
      const radius = OBJECT_RADIUS[selectedTool] || 8
      sceneGraph.addObject(selectedTool, worldPos, { type: 'circle', radius }, {})
    }

    onSpecChange(sceneGraph.getSpec())
  }

  const handleCanvasRightClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const existingObject = getObjectAt(x, y)
    const existingAgent = getAgentAt(x, y)

    if (existingObject) {
      sceneGraph.removeObject(existingObject.id)
      onSpecChange(sceneGraph.getSpec())
    } else if (existingAgent) {
      sceneGraph.removeAgent(existingAgent.id)
      onSpecChange(sceneGraph.getSpec())
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const object = getObjectAt(x, y)
    const agent = getAgentAt(x, y)

    if (object) {
      setIsDragging(true)
      setDragTarget(object)
      selectObject(object.id)
    } else if (agent) {
      setIsDragging(true)
      setDragAgent(agent.id)
      selectAgent(agent.id)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const worldPos = canvasToWorld(x, y)

    if (dragTarget) {
      sceneGraph.updateObject(dragTarget.id, { position: worldPos })
      onSpecChange(sceneGraph.getSpec())
    } else if (dragAgent) {
      sceneGraph.updateAgent(dragAgent, { position: worldPos })
      onSpecChange(sceneGraph.getSpec())
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragTarget(null)
    setDragAgent(null)
  }

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    const gridSize = 50
    for (let i = 0; i <= canvasWidth; i += gridSize) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, canvasHeight)
      ctx.stroke()
    }
    for (let i = 0; i <= canvasHeight; i += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(canvasWidth, i)
      ctx.stroke()
    }

    // Draw bounds
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight)

    // Draw objects
    envSpec.objects.forEach((obj) => {
      const [px, py] = worldToCanvas(obj.position[0], obj.position[1])
      const color = OBJECT_COLORS[obj.type] || '#9ca3af'
      const radius = obj.size.type === 'circle' ? obj.size.radius : OBJECT_RADIUS[obj.type] || 8
      const isSelected = selection.selectedObjectId === obj.id

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, 2 * Math.PI)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3
        ctx.stroke()
      } else if (obj.type === 'obstacle' || obj.type === 'wall') {
        ctx.strokeStyle = '#374151'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // Draw agents
    envSpec.agents.forEach((agent) => {
      const [px, py] = worldToCanvas(agent.position[0], agent.position[1])
      const color = OBJECT_COLORS.agent
      const radius = OBJECT_RADIUS.agent
      const isSelected = selection.selectedAgentId === agent.id

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, 2 * Math.PI)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3
        ctx.stroke()
      }
    })
  }, [envSpec.objects, envSpec.agents, bounds, selection])

  return (
    <div className="h-full flex flex-col">
      {/* Tool Palette */}
      <div className="p-2 border-b border-border flex gap-2 flex-wrap">
        {(['agent', 'goal', 'obstacle', 'trap', 'checkpoint'] as ObjectType[]).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedTool(type)}
            className={`px-3 py-1 rounded text-sm border ${
              selectedTool === type
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:bg-muted'
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded mr-2"
              style={{ backgroundColor: OBJECT_COLORS[type] }}
            />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4">
        <div className="border border-border rounded-lg bg-white p-4 inline-block">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onClick={handleCanvasClick}
            onContextMenu={handleCanvasRightClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair border border-gray-300"
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-2 text-sm text-muted-foreground border-t border-border">
        <p>Click to place objects, right-click to remove</p>
        <p>Drag objects to move them</p>
        <p>
          Bounds: [{bounds[0][0].toFixed(1)}, {bounds[0][1].toFixed(1)}] × [
          {bounds[1][0].toFixed(1)}, {bounds[1][1].toFixed(1)}]
        </p>
        <p>
          Objects: {envSpec.objects.length} | Agents: {envSpec.agents.length}
        </p>
      </div>
    </div>
  )
}
