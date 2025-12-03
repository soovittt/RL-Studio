// ContinuousCanvasThree - Beautiful 3D continuous renderer using Three.js + React Three Fiber
import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import { Bloom, Vignette, EffectComposer } from '@react-three/postprocessing'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'
import * as THREE from 'three'

interface ContinuousCanvasThreeProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
}

const OBJECT_COLORS: Record<ObjectType, [number, number, number]> = {
  wall: [0.2, 0.2, 0.2],
  agent: [0.23, 0.51, 0.96],
  goal: [0.06, 0.72, 0.51],
  obstacle: [0.38, 0.38, 0.38],
  region: [0.99, 0.94, 0.54],
  checkpoint: [0.66, 0.33, 0.96],
  trap: [0.94, 0.27, 0.27],
  key: [0.92, 0.7, 0.02],
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

// Object Component
function ObjectMesh({
  object,
  isSelected,
  onClick,
  onRightClick,
}: {
  object: ObjectSpec
  isSelected: boolean
  onClick: () => void
  onRightClick: (e: React.MouseEvent) => void
}) {
  const color = OBJECT_COLORS[object.type]
  const emissive = OBJECT_EMISSIVE[object.type]
  const [x, y] = object.position
  const radius =
    object.size.type === 'circle'
      ? object.size.radius
      : object.size.type === 'rect'
        ? Math.max(object.size.width, object.size.height) / 2
        : 0.5

  return (
    <group position={[x, 0, y]}>
      <mesh
        onClick={onClick}
        onContextMenu={onRightClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        {object.size.type === 'circle' ? (
          <cylinderGeometry args={[radius, radius, 0.2, 32]} />
        ) : object.size.type === 'rect' ? (
          <boxGeometry args={[object.size.width, 0.2, object.size.height]} />
        ) : (
          <sphereGeometry args={[radius, 16, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={object.type === 'goal' ? 0.8 : 0.3}
          metalness={object.type === 'agent' ? 0.8 : 0.3}
          roughness={object.type === 'agent' ? 0.2 : 0.6}
        />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.2, 0]}>
          <ringGeometry args={[radius * 1.2, radius * 1.3, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {(object.type === 'goal' || object.type === 'agent') && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[radius * 0.3, 16, 16]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  )
}

// Agent Component
function AgentMesh({
  agent,
  isSelected,
  onClick,
  onRightClick,
}: {
  agent: { id: string; position: Vec2 }
  isSelected: boolean
  onClick: () => void
  onRightClick: (e: React.MouseEvent) => void
}) {
  const [x, y] = agent.position
  const color = OBJECT_COLORS.agent
  const emissive = OBJECT_EMISSIVE.agent

  return (
    <group position={[x, 0, y]}>
      <mesh
        onClick={onClick}
        onContextMenu={onRightClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.4, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.6}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.3, 0]}>
          <ringGeometry args={[0.7, 0.8, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.2} />
      </mesh>
    </group>
  )
}

// Scene Content
function SceneContent({
  envSpec,
  rolloutState,
  onObjectClick,
  onObjectRightClick,
  onAgentClick,
  onAgentRightClick,
  selectedObjectId,
  selectedAgentId,
}: {
  envSpec: EnvSpec
  rolloutState?: { agents: Array<{ id: string; position: Vec2 }> }
  onObjectClick: (obj: ObjectSpec) => void
  onObjectRightClick: (e: React.MouseEvent, obj: ObjectSpec) => void
  onAgentClick: (agentId: string) => void
  onAgentRightClick: (e: React.MouseEvent, agentId: string) => void
  selectedObjectId?: string
  selectedAgentId?: string
}) {
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

  const agents =
    rolloutState?.agents ||
    (Array.isArray(envSpec.agents)
      ? envSpec.agents.map((a) => ({ id: a.id, position: a.position }))
      : [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#ffffff" />

      {/* Grid helper */}
      <Grid
        args={[world.width, world.height]}
        cellColor="#e2e8f0"
        sectionColor="#cbd5e1"
        cellThickness={0.5}
        sectionThickness={1}
        fadeDistance={25}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, -0.05, 0]}
      />

      {/* Objects */}
      {Array.isArray(envSpec.objects) &&
        envSpec.objects.map((obj) => (
          <ObjectMesh
            key={obj.id}
            object={obj}
            isSelected={selectedObjectId === obj.id}
            onClick={() => onObjectClick(obj)}
            onRightClick={(e) => onObjectRightClick(e, obj)}
          />
        ))}

      {/* Agents */}
      {Array.isArray(agents) &&
        agents.map((agent) => (
          <AgentMesh
            key={agent.id}
            agent={agent}
            isSelected={selectedAgentId === agent.id}
            onClick={() => onAgentClick(agent.id)}
            onRightClick={(e) => onAgentRightClick(e, agent.id)}
          />
        ))}

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[world.width * 2, world.height * 2]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </>
  )
}

export function ContinuousCanvasThree({
  envSpec,
  sceneGraph,
  onSpecChange,
  rolloutState,
}: ContinuousCanvasThreeProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  const [selectedTool, setSelectedTool] = useState<ObjectType>('agent')

  const world = envSpec.world
  const maxDim = Math.max(world.width, world.height)

  const handleObjectClick = (obj: ObjectSpec) => {
    if (rolloutState) return
    selectObject(obj.id)
  }

  const handleObjectRightClick = (e: React.MouseEvent, obj: ObjectSpec) => {
    e.preventDefault()
    if (rolloutState) return
    sceneGraph.removeObject(obj.id)
    onSpecChange(sceneGraph.getSpec())
  }

  const handleAgentClick = (agentId: string) => {
    if (rolloutState) return
    selectAgent(agentId)
  }

  const handleAgentRightClick = (e: React.MouseEvent, agentId: string) => {
    e.preventDefault()
    if (rolloutState) return
    sceneGraph.removeAgent(agentId)
    onSpecChange(sceneGraph.getSpec())
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    // TODO: Implement click-to-place functionality
    // This would require raycasting to convert screen coordinates to world coordinates
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
          onClick={handleCanvasClick}
        >
          <PerspectiveCamera
            makeDefault
            position={[maxDim * 0.8, maxDim * 0.8, maxDim * 0.8]}
            fov={50}
          />

          <SceneContent
            envSpec={envSpec}
            rolloutState={rolloutState}
            onObjectClick={handleObjectClick}
            onObjectRightClick={handleObjectRightClick}
            onAgentClick={handleAgentClick}
            onAgentRightClick={handleAgentRightClick}
            selectedObjectId={selection.selectedObjectId}
            selectedAgentId={selection.selectedAgentId}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={maxDim * 2}
            target={[world.width / 2, 0, world.height / 2]}
          />

          <EffectComposer>
            <Bloom intensity={0.3} luminanceThreshold={0.9} luminanceSmoothing={0.9} />
            <Vignette eskil={false} offset={0.1} darkness={0.3} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Info */}
      <div className="p-2 text-sm text-muted-foreground border-t border-border bg-card">
        World: {world.width} × {world.height} | Objects: {envSpec.objects.length} | Agents:{' '}
        {envSpec.agents.length}
      </div>
    </div>
  )
}
