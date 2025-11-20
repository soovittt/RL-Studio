// GridCanvasThree - Beautiful 3D grid renderer using Three.js + React Three Fiber
import { useState, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Bloom, Vignette, EffectComposer } from '@react-three/postprocessing'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'
import { AssetPalette, assetToObjectType, getAssetColor } from './AssetPalette'
import type { Asset } from '~/lib/assetClient'
import * as THREE from 'three'

interface GridCanvasThreeProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
}

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [0.5, 0.5, 0.5]
}

// Grid Cell Component
function GridCell({ 
  x, y, 
  object, 
  agent, 
  isSelected,
  onClick,
  onRightClick,
  assets
}: {
  x: number
  y: number
  object: ObjectSpec | null
  agent: { id: string; position: Vec2 } | null
  isSelected: boolean
  onClick: () => void
  onRightClick: (e: any) => void
  assets: Asset[]
}) {
  // Get color from assets
  let color: [number, number, number] = [0.95, 0.95, 0.95]
  let emissive: [number, number, number] = [0, 0, 0]

  if (object) {
    // Try to find asset by assetId stored in properties
    let asset: Asset | undefined
    if (object.properties?.assetId) {
      asset = assets.find(a => a._id === object.properties.assetId)
    }
    // Fallback: find asset by type
    if (!asset) {
      asset = assets.find(a => {
        const objectType = assetToObjectType(a)
        return objectType === object.type
      })
    }
    if (asset) {
      const hexColor = asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
      color = hexToRgb(hexColor)
      // Emissive based on object type
      if (object.type === 'goal') {
        emissive = [color[0] * 0.5, color[1] * 0.5, color[2] * 0.5]
      }
    } else {
      // Fallback colors
      color = [0.2, 0.2, 0.2]
    }
  } else if (agent) {
    // Find agent asset
    const agentAsset = assets.find(a => {
      const objectType = assetToObjectType(a)
      return objectType === 'agent'
    })
    if (agentAsset) {
      const hexColor = agentAsset.meta?.paletteColor || agentAsset.visualProfile?.color || '#4a90e2'
      color = hexToRgb(hexColor)
      emissive = [color[0] * 0.3, color[1] * 0.3, color[2] * 0.5]
    } else {
      color = [0.23, 0.51, 0.96]
      emissive = [0.1, 0.2, 0.4]
    }
  }

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
  selectedAgentId,
  assets
}: {
  envSpec: EnvSpec
  rolloutState?: { agents: Array<{ id: string; position: Vec2 }> }
  onCellClick: (x: number, y: number) => void
  onCellRightClick: (e: any, x: number, y: number) => void
  selectedObjectId?: string
  selectedAgentId?: string
  assets: Asset[]
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
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null) // Asset from backend
  const [assets, setAssets] = useState<Asset[]>([])

  // Load assets when component mounts
  useEffect(() => {
    async function loadAssets() {
      try {
        const { listAssets } = await import('~/lib/assetClient')
        const loadedAssets = await listAssets({ mode: 'grid' })
        const primaryAssets = loadedAssets
          .filter((asset) => asset.meta?.palette === 'primary')
          .sort((a, b) => a.name.localeCompare(b.name))
        setAssets(primaryAssets)
      } catch (err) {
        console.warn('Failed to load assets:', err)
      }
    }
    loadAssets()
  }, [])

  // When asset is selected
  const handleAssetSelect = (asset: Asset | null) => {
    setSelectedAsset(asset)
  }

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

    // Place new object/agent using selected asset
    if (!selectedAsset) return

    const worldPos = gridToWorld(gridX, gridY)
    const objectType = assetToObjectType(selectedAsset) as ObjectType

    if (objectType === 'agent') {
      // Remove existing agent if placing new one
      const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
      if (agents.length > 0) {
        sceneGraph.removeAgent(agents[0].id)
      }
      sceneGraph.addAgent('Agent', worldPos, { type: 'grid-step' })
    } else if (objectType) {
      sceneGraph.addObject(
        objectType,
        worldPos,
        { type: 'rect', width: cellSize, height: cellSize },
        { assetId: selectedAsset._id } // Store asset reference
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

  return (
    <div className="h-full flex flex-col">
      {/* Asset Palette from Backend */}
      <AssetPalette
        mode="grid"
        selectedAssetId={selectedAsset?._id}
        onSelectAsset={handleAssetSelect}
        className="bg-card"
      />

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
            assets={assets}
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

