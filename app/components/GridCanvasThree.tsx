// GridCanvasThree - Beautiful 3D grid renderer using Three.js + React Three Fiber
import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Bloom, Vignette, EffectComposer } from '@react-three/postprocessing'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'
import * as THREE from 'three'

interface GridCanvasThreeProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
}

const OBJECT_COLORS: Record<ObjectType, [number, number, number]> = {
  wall: [0.2, 0.2, 0.2],
  agent: [0.23, 0.51, 0.96], // Blue
  goal: [0.06, 0.72, 0.51], // Green
  obstacle: [0.38, 0.38, 0.38],
  region: [0.99, 0.94, 0.54],
  checkpoint: [0.66, 0.33, 0.96],
  trap: [0.94, 0.27, 0.27],
  key: [0.92, 0.70, 0.02],
  door: [0.97, 0.45, 0.09],
  custom: [0.61, 0.64, 0.64],
}

const OBJECT_EMISSIVE: Record<ObjectType, [number, number, number]> = {
  wall: [0, 0, 0],
  agent: [0.1, 0.2, 0.4],
  goal: [0.2, 0.5, 0.3],
  obstacle: [0, 0, 0],
  region: [0.3, 0.3, 0.1],
  checkpoint: [0.3, 0.1, 0.4],
  trap: [0.4, 0.1, 0.1],
  key: [0.4, 0.3, 0.1],
  door: [0.4, 0.2, 0.1],
  custom: [0.1, 0.1, 0.1],
}

// Grid Cell Component
function GridCell({ 
  x, y, 
  object, 
  agent, 
  isSelected,
  onClick,
  onRightClick 
}: {
  x: number
  y: number
  object: ObjectSpec | null
  agent: { id: string; position: Vec2 } | null
  isSelected: boolean
  onClick: () => void
  onRightClick: (e: any) => void
}) {
  const color = object 
    ? OBJECT_COLORS[object.type]
    : agent 
      ? OBJECT_COLORS.agent
      : [0.95, 0.95, 0.95]

  const emissive = object 
    ? OBJECT_EMISSIVE[object.type]
    : agent
      ? OBJECT_EMISSIVE.agent
      : [0, 0, 0]

  const handleClick = (e: any) => {
    e.stopPropagation()
    onClick()
  }

  const handleRightClick = (e: any) => {
    e.stopPropagation()
    if (e.nativeEvent) {
      e.nativeEvent.preventDefault()
    }
    onRightClick(e)
  }

  return (
    <mesh
      position={[x, 0, y]}
      onClick={handleClick}
      onContextMenu={handleRightClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <boxGeometry args={[0.9, 0.1, 0.9]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={object?.type === 'goal' || agent ? 0.5 : 0}
        metalness={agent ? 0.8 : 0.2}
        roughness={agent ? 0.2 : 0.6}
      />
      {isSelected && (
        <mesh position={[0, 0.06, 0]}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {(object?.type === 'goal' || agent) && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={1}
          />
        </mesh>
      )}
    </mesh>
  )
}

// Scene Content
function SceneContent({ 
  envSpec, 
  rolloutState,
  onCellClick,
  onCellRightClick,
  selectedObjectId,
  selectedAgentId 
}: {
  envSpec: EnvSpec
  rolloutState?: { agents: Array<{ id: string; position: Vec2 }> }
  onCellClick: (x: number, y: number) => void
  onCellRightClick: (e: any, x: number, y: number) => void
  selectedObjectId?: string
  selectedAgentId?: string
}) {
  const world = envSpec.world
  const width = world.width
  const height = world.height
  const cellSize = world.cellSize || 1

  const cells = useMemo(() => {
    if (!envSpec) {
      return []
    }
    
    const objects = Array.isArray(envSpec.objects) ? envSpec.objects : []
    const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
    
    // Convert grid position to world coordinates
    const gridToWorld = (gridX: number, gridY: number): Vec2 => {
      return [gridX * cellSize, gridY * cellSize]
    }

    // Get object at grid position
    const getObjectAt = (gridX: number, gridY: number): ObjectSpec | null => {
      const worldPos = gridToWorld(gridX, gridY)
      return objects.find((obj) => {
        if (!obj || !obj.position || !Array.isArray(obj.position)) return false
        const [objX, objY] = obj.position
        return Math.floor(objX) === Math.floor(worldPos[0]) && 
               Math.floor(objY) === Math.floor(worldPos[1])
      }) || null
    }

    // Get agent at grid position
    const getAgentAt = (gridX: number, gridY: number) => {
      const worldPos = gridToWorld(gridX, gridY)
      let agentsToCheck: Array<{ id: string; position: Vec2 }> = []
      
      if (rolloutState?.agents && Array.isArray(rolloutState.agents)) {
        agentsToCheck = rolloutState.agents
      } else if (Array.isArray(agents)) {
        agentsToCheck = agents.map(a => ({ id: a.id, position: a.position }))
      }
      
      for (const agent of agentsToCheck) {
        if (!agent || !agent.position || !Array.isArray(agent.position)) continue
        const [agentX, agentY] = agent.position
        
        // Convert agent world position to grid coordinates
        const agentGridX = Math.round(agentX / cellSize)  // Use round instead of floor for better matching
        const agentGridY = Math.round(agentY / cellSize)
        
        // Exact grid match
        if (agentGridX === gridX && agentGridY === gridY) {
          return agent
        }
        
        // Tolerance check (for floating point precision)
        const cellWorldX = worldPos[0]
        const cellWorldY = worldPos[1]
        const tolerance = cellSize * 0.6  // Increased tolerance
        if (Math.abs(agentX - cellWorldX) < tolerance && 
            Math.abs(agentY - cellWorldY) < tolerance) {
          return agent
        }
      }
      
      return null
    }
    
    const result: JSX.Element[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const object = getObjectAt(x, y)
        const agent = getAgentAt(x, y)
        const isSelected = 
          (object && selectedObjectId === object.id) ||
          (agent && selectedAgentId === agent.id)

        result.push(
          <GridCell
            key={`${x}-${y}`}
            x={x - width / 2}
            y={y - height / 2}
            object={object}
            agent={agent}
            isSelected={isSelected}
            onClick={() => onCellClick(x, y)}
            onRightClick={(e) => onCellRightClick(e, x, y)}
          />
        )
      }
    }
    return result
  }, [envSpec, rolloutState, selectedObjectId, selectedAgentId, width, height, cellSize, onCellClick, onCellRightClick])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ffffff" />

      {/* Grid helper */}
      <Grid
        args={[width, height]}
        cellColor="#e2e8f0"
        sectionColor="#cbd5e1"
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Grid cells */}
      {cells}

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[width * 2, height * 2]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </>
  )
}

export function GridCanvasThree({ envSpec, sceneGraph, onSpecChange, rolloutState }: GridCanvasThreeProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  const [selectedTool, setSelectedTool] = useState<ObjectType>('wall')

  const world = envSpec.world
  const width = world.width
  const height = world.height
  const cellSize = world.cellSize || 1

  // Convert grid position to world coordinates
  const gridToWorld = (gridX: number, gridY: number): Vec2 => {
    return [gridX * cellSize, gridY * cellSize]
  }

  // Get object at grid position
  const getObjectAt = (gridX: number, gridY: number): ObjectSpec | null => {
    const worldPos = gridToWorld(gridX, gridY)
    const objects = Array.isArray(envSpec.objects) ? envSpec.objects : []
    return objects.find((obj) => {
      if (!obj || !obj.position || !Array.isArray(obj.position)) return false
      const [objX, objY] = obj.position
      return Math.floor(objX) === Math.floor(worldPos[0]) && 
             Math.floor(objY) === Math.floor(worldPos[1])
    }) || null
  }

  // Get agent at grid position
  const getAgentAt = (gridX: number, gridY: number) => {
    const worldPos = gridToWorld(gridX, gridY)
    let agentsToCheck: Array<{ id: string; position: Vec2 }> = []
    
    if (rolloutState?.agents && Array.isArray(rolloutState.agents)) {
      agentsToCheck = rolloutState.agents
    } else {
      const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
      agentsToCheck = agents.map(a => ({ id: a.id, position: a.position }))
    }
    
    for (const agent of agentsToCheck) {
      if (!agent || !agent.position || !Array.isArray(agent.position)) continue
      const [agentX, agentY] = agent.position
      
      // Convert agent world position to grid coordinates (use round for better matching)
      const agentGridX = Math.round(agentX / cellSize)
      const agentGridY = Math.round(agentY / cellSize)
      
      // Exact grid match
      if (agentGridX === gridX && agentGridY === gridY) {
        return agent
      }
      
      // Tolerance check (for floating point precision)
      const cellWorldX = worldPos[0]
      const cellWorldY = worldPos[1]
      const tolerance = cellSize * 0.6  // Increased tolerance
      if (Math.abs(agentX - cellWorldX) < tolerance && 
          Math.abs(agentY - cellWorldY) < tolerance) {
        return agent
      }
    }
    
    return null
  }

  const handleCellClick = (gridX: number, gridY: number) => {
    if (rolloutState) return // Prevent editing during rollout

    const existingObject = getObjectAt(gridX, gridY)
    const existingAgent = getAgentAt(gridX, gridY)

    if (existingObject) {
      selectObject(existingObject.id)
      return
    }

    if (existingAgent) {
      selectAgent(existingAgent.id)
      return
    }

    // Place new object/agent
    const worldPos = gridToWorld(gridX, gridY)

    if (selectedTool === 'agent') {
      // Remove existing agent if placing new one
      const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
      if (agents.length > 0) {
        sceneGraph.removeAgent(agents[0].id)
      }
      // Use the same method as original GridCanvas
      sceneGraph.addAgent('Agent', worldPos, { type: 'grid-step' })
    } else {
      // Use the same method as original GridCanvas
      sceneGraph.addObject(
        selectedTool,
        worldPos,
        { type: 'rect', width: cellSize, height: cellSize },
        {}
      )
    }

    onSpecChange(sceneGraph.getSpec())
  }

  const handleCellRightClick = (e: any, gridX: number, gridY: number) => {
    if (e?.nativeEvent) {
      e.nativeEvent.preventDefault()
    }
    if (rolloutState) return

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

  const OBJECT_COLORS_TAILWIND: Record<ObjectType, string> = {
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

  return (
    <div className="h-full flex flex-col">
      {/* Tool Palette */}
      <div className="p-2 border-b border-border flex gap-2 flex-wrap bg-card">
        {Object.entries(OBJECT_COLORS_TAILWIND).map(([type, color]) => (
          <button
            key={type}
            onClick={() => setSelectedTool(type as ObjectType)}
            className={`px-3 py-1 rounded text-sm border transition-all ${
              selectedTool === type
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:bg-muted'
            }`}
          >
            <span className={`inline-block w-3 h-3 ${color} rounded mr-2`} />
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <PerspectiveCamera
            makeDefault
            position={[Math.max(width, height) * 0.8, Math.max(width, height) * 0.8, Math.max(width, height) * 0.8]}
            fov={50}
          />
          
          <SceneContent
            envSpec={envSpec}
            rolloutState={rolloutState}
            onCellClick={handleCellClick}
            onCellRightClick={handleCellRightClick}
            selectedObjectId={selection.selectedObjectId}
            selectedAgentId={selection.selectedAgentId}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
            target={[0, 0, 0]}
          />

          <EffectComposer>
            <Bloom intensity={0.3} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
            <Vignette eskil={false} offset={0.1} darkness={0.3} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Info */}
      <div className="p-2 text-sm text-muted-foreground border-t border-border bg-card">
        Grid: {width} × {height} | Objects: {envSpec.objects.length} | Agents: {envSpec.agents.length}
      </div>
    </div>
  )
}

