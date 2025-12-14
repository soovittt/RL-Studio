// GridCanvasThree - Beautiful 3D grid renderer using Three.js + React Three Fiber
import { useState, useMemo, useEffect, useRef, memo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import { Bloom, Vignette, EffectComposer } from '@react-three/postprocessing'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { useSelection } from '~/lib/selectionManager.js'
import { AssetPalette, assetToObjectType, getAssetColor } from './AssetPalette'
import { AssetSelector } from './AssetSelector'
import type { Asset } from '~/lib/assetClient'
import * as THREE from 'three'
import { renderEntity, getDefaultRender2D } from '~/lib/procedural/gridRenderer'
import { GridTransform, Render2D } from '~/lib/components/gridComponents'

interface GridCanvasThreeProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
  selectedAssetId?: string
  onAssetSelect?: (asset: Asset | null) => void
}

interface SceneContentProps {
  envSpec: EnvSpec
  rolloutState?: { agents: Array<{ id: string; position: Vec2 }> }
  onCellClick: (x: number, y: number, event?: { clientX: number; clientY: number }) => void
  onCellRightClick: (e: any, x: number, y: number) => void
  selectedObjectId?: string
  selectedAgentId?: string
  assets: Asset[]
}

// Hardcoded tool palette (fallback when assets aren't available)
const TOOL_PALETTE: Array<{ type: ObjectType | 'agent'; label: string; color: string }> = [
  { type: 'agent', label: 'Agent', color: '#4a90e2' },
  { type: 'wall', label: 'Wall', color: '#1b263b' },
  { type: 'goal', label: 'Goal', color: '#50c878' },
  { type: 'trap', label: 'Trap', color: '#dc143c' },
  { type: 'key', label: 'Key', color: '#ffd700' },
  { type: 'door', label: 'Door', color: '#8b4513' },
  { type: 'checkpoint', label: 'Checkpoint', color: '#9370db' },
  { type: 'obstacle', label: 'Obstacle', color: '#696969' },
]

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
    : [0.5, 0.5, 0.5]
}

// Grid Cell Component - Memoized for performance
const GridCell = memo(function GridCell({
  x,
  y,
  object,
  agent,
  isSelected,
  onClick,
  onRightClick,
  assets = [],
}: {
  x: number
  y: number
  object: ObjectSpec | null
  agent: { id: string; position: Vec2 } | null
  isSelected: boolean
  onClick: (event?: { clientX: number; clientY: number }) => void
  onRightClick: (e: any) => void
  assets?: Asset[]
}) {
  // Get color from assets
  let color: [number, number, number] = [0.95, 0.95, 0.95]
  let emissive: [number, number, number] = [0, 0, 0]

  if (object) {
    // Try to find asset by assetId stored in properties
    let asset: Asset | undefined
    if (object.properties?.assetId && assets && Array.isArray(assets) && assets.length > 0) {
      asset = assets.find((a) => a._id === object.properties.assetId)
    }
    // Fallback: find asset by type
    if (!asset && assets && Array.isArray(assets) && assets.length > 0) {
      asset = assets.find((a) => {
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
    const agentAsset =
      assets && Array.isArray(assets) && assets.length > 0
        ? assets.find((a) => {
            const objectType = assetToObjectType(a)
            return objectType === 'agent'
          })
        : undefined
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
    // Pass event coordinates for tooltip positioning
    // React Three Fiber events have different structure
    const event = e.nativeEvent || (e.domEvent ? e.domEvent : e)
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      onClick(event)
    } else {
      // Fallback: try to get coordinates from the event
      onClick()
    }
  }

  const handleRightClick = (e: any) => {
    e.stopPropagation()
    if (e.nativeEvent) {
      e.nativeEvent.preventDefault()
    }
    onRightClick(e)
  }

  // Determine 3D shape based on object type
  const get3DShape = () => {
    if (agent) {
      // Agent: Cylinder with sphere on top
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.4, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.3}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.6, 0]} castShadow>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={0.5}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
        </group>
      )
    }

    if (object) {
      const objectType = object.type

      if (objectType === 'wall') {
        // Wall: Tall 3D box
        return (
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.9, 1.0, 0.9]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
          </mesh>
        )
      }

      if (objectType === 'goal') {
        // Goal: Cylinder with glowing top
        return (
          <group>
            <mesh position={[0, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.4, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={0.8}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
              <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.5} />
            </mesh>
          </group>
        )
      }

      if (objectType === 'key' || objectType === 'pickup') {
        // Key/Pickup: Small 3D shape on pedestal
        return (
          <group>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1, 8]} />
              <meshStandardMaterial color="#666" />
            </mesh>
            <mesh position={[0, 0.2, 0]} castShadow>
              <torusGeometry args={[0.15, 0.05, 8, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                emissiveIntensity={0.6}
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          </group>
        )
      }

      if (objectType === 'door') {
        // Door: Tall box with frame
        return (
          <group>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[0.85, 1.0, 0.1]} />
              <meshStandardMaterial color={color} metalness={0.4} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[0.9, 1.05, 0.05]} />
              <meshStandardMaterial color="#4a3728" />
            </mesh>
          </group>
        )
      }

      if (objectType === 'trap' || objectType === 'hazard') {
        // Trap/Hazard: Spiky shape
        return (
          <group>
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.3, 0.2, 8]} />
              <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, 0.25, 0]}>
              <coneGeometry args={[0.2, 0.15, 8]} />
              <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} />
            </mesh>
          </group>
        )
      }

      // Default: Low box for other objects
      return (
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.8, 0.3, 0.8]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={objectType === 'checkpoint' ? 0.5 : 0}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>
      )
    }

    // Empty cell: just floor
    return null
  }

  return (
    <group
      position={[x, 0, y]}
      onClick={(e) => {
        // Get DOM event from React Three Fiber event
        const domEvent = e.nativeEvent || (e as any).domEvent
        if (domEvent) {
          handleClick(domEvent)
        } else {
          handleClick()
        }
      }}
      onContextMenu={handleRightClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      {/* Floor tile (always present) - visible grid cell */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial
          color={object || agent ? [0.85, 0.85, 0.85] : [0.92, 0.92, 0.92]}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* Visible grid cell borders - raised edges */}
      <group position={[0, 0.06, 0]}>
        {/* Top edge */}
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[1, 0.02, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        {/* Bottom edge */}
        <mesh position={[0, 0, -0.5]}>
          <boxGeometry args={[1, 0.02, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        {/* Left edge */}
        <mesh position={[-0.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1, 0.02, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        {/* Right edge */}
        <mesh position={[0.5, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1, 0.02, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>

      {/* 3D object/agent */}
      {get3DShape()}

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshStandardMaterial
            color="#3b82f6"
            emissive="#3b82f6"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  )
})

// Scene Content - Memoized for performance
function SceneContentInner({
  envSpec,
  rolloutState,
  onCellClick,
  onCellRightClick,
  selectedObjectId,
  selectedAgentId,
  assets,
}: {
  envSpec: EnvSpec
  rolloutState?: { agents: Array<{ id: string; position: Vec2 }> }
  onCellClick: (x: number, y: number, event?: { clientX: number; clientY: number }) => void
  onCellRightClick: (e: any, x: number, y: number) => void
  selectedObjectId?: string
  selectedAgentId?: string
  assets: Asset[]
}) {
  const world = envSpec.world
  const width = world.width
  const height = world.height
  const cellSize = world.cellSize || 1

  // Debug: Log when dimensions change
  useEffect(() => {
    console.log('📐 Grid dimensions changed:', { width, height, cellSize })
  }, [width, height, cellSize])

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
      return (
        objects.find((obj) => {
          if (!obj || !obj.position || !Array.isArray(obj.position)) return false
          const [objX, objY] = obj.position
          return (
            Math.floor(objX) === Math.floor(worldPos[0]) &&
            Math.floor(objY) === Math.floor(worldPos[1])
          )
        }) || null
      )
    }

    // Get agent at grid position
    const getAgentAt = (gridX: number, gridY: number) => {
      const worldPos = gridToWorld(gridX, gridY)
      let agentsToCheck: Array<{ id: string; position: Vec2 }> = []

      if (rolloutState?.agents && Array.isArray(rolloutState.agents)) {
        agentsToCheck = rolloutState.agents
      } else if (Array.isArray(agents)) {
        agentsToCheck = agents.map((a) => ({ id: a.id, position: a.position }))
      }

      for (const agent of agentsToCheck) {
        if (!agent || !agent.position || !Array.isArray(agent.position)) continue
        const [agentX, agentY] = agent.position

        // Convert agent world position to grid coordinates
        const agentGridX = Math.round(agentX / cellSize) // Use round instead of floor for better matching
        const agentGridY = Math.round(agentY / cellSize)

        // Exact grid match
        if (agentGridX === gridX && agentGridY === gridY) {
          return agent
        }

        // Tolerance check (for floating point precision)
        const cellWorldX = worldPos[0]
        const cellWorldY = worldPos[1]
        const tolerance = cellSize * 0.6 // Increased tolerance
        if (
          Math.abs(agentX - cellWorldX) < tolerance &&
          Math.abs(agentY - cellWorldY) < tolerance
        ) {
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
          (object && selectedObjectId === object.id) || (agent && selectedAgentId === agent.id)

        // Center cells: cell at (0,0) should be at (-width/2 + 0.5, -height/2 + 0.5)
        result.push(
          <GridCell
            key={`${x}-${y}`}
            x={x - width / 2 + 0.5}
            y={y - height / 2 + 0.5}
            object={object}
            agent={agent}
            isSelected={isSelected}
            onClick={(event) => onCellClick(x, y, event)}
            onRightClick={(e) => onCellRightClick(e, x, y)}
            assets={assets}
          />
        )
      }
    }
    return result
  }, [
    envSpec,
    rolloutState,
    selectedObjectId,
    selectedAgentId,
    width,
    height,
    cellSize,
    onCellClick,
    onCellRightClick,
    assets,
  ])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.7} color="#ffffff" />

      {/* Manual grid lines - VERY VISIBLE using thick boxes - aligned with cell edges */}
      <group position={[0, 0.06, 0]} key={`grid-lines-${width}-${height}`}>
        {/* Vertical lines - positioned at cell boundaries */}
        {Array.from({ length: width + 1 }, (_, i) => {
          // Lines at: -width/2, -width/2+1, ..., width/2
          const x = i - width / 2
          return (
            <mesh key={`v-${width}-${height}-${i}`} position={[x, 0, 0]}>
              <boxGeometry args={[0.02, 0.02, height]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          )
        })}
        {/* Horizontal lines - positioned at cell boundaries */}
        {Array.from({ length: height + 1 }, (_, i) => {
          // Lines at: -height/2, -height/2+1, ..., height/2
          const z = i - height / 2
          return (
            <mesh key={`h-${width}-${height}-${i}`} position={[0, 0, z]}>
              <boxGeometry args={[width, 0.02, 0.02]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          )
        })}
      </group>

      {/* Grid cells */}
      {cells}

      {/* Ground plane - positioned below grid cells */}
      <mesh 
        key={`ground-${width}-${height}`}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.15, 0]} 
        receiveShadow
      >
        <planeGeometry args={[width + 4, height + 4]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </>
  )
}

// Remove memo to ensure updates work - key-based remounting handles performance
const SceneContent = SceneContentInner

export function GridCanvasThree({
  envSpec,
  sceneGraph,
  onSpecChange,
  rolloutState,
  selectedAssetId,
  onAssetSelect,
}: GridCanvasThreeProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  // Declare assets state first before using it
  const [assets, setAssets] = useState<Asset[]>([])
  // Use external selectedAssetId if provided (from LayersPanel), otherwise use local state
  const [localSelectedAsset, setLocalSelectedAsset] = useState<Asset | null>(null)
  const selectedAsset = selectedAssetId
    ? assets.find((a) => a._id === selectedAssetId) || null
    : localSelectedAsset
  const [selectedTool, setSelectedTool] = useState<ObjectType | 'agent' | null>(null)
  const [showAssetSelector, setShowAssetSelector] = useState(false)

  // Tooltip state for object info and delete button
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    object?: ObjectSpec
    agent?: { id: string; position: Vec2 }
  }>({ visible: false, x: 0, y: 0 })

  // Use ref to persist asset selection across re-renders
  const selectedAssetRef = useRef<Asset | null>(null)
  const selectedToolRef = useRef<ObjectType | 'agent' | null>(null)

  // Sync refs with state
  useEffect(() => {
    selectedAssetRef.current = selectedAsset
    selectedToolRef.current = selectedTool
  }, [selectedAsset, selectedTool])

  // Debug: Track component mount/unmount
  useEffect(() => {
    console.log('🟢 GridCanvasThree MOUNTED')
    return () => {
      console.log('🔴 GridCanvasThree UNMOUNTED - THIS IS THE PROBLEM!')
    }
  }, [])

  // Load assets when component mounts
  useEffect(() => {
    async function loadAssets() {
      try {
        const { listAssets } = await import('~/lib/assetClient')
        const loadedAssets = await listAssets({ mode: 'grid' })

        console.log('🔍 GridCanvasThree: Loaded assets:', loadedAssets)

        // Ensure loadedAssets is an array
        if (!Array.isArray(loadedAssets)) {
          console.warn('⚠️ GridCanvasThree: Assets not loaded as array:', loadedAssets)
          setAssets([])
          return
        }

        console.log(`📦 GridCanvasThree: Total assets: ${loadedAssets.length}`)

        // Show all grid assets - be very lenient
        const gridAssets = loadedAssets
          .filter((asset) => {
            if (!asset) return false
            // If no meta, still include it (might be valid)
            if (!asset.meta) {
              console.log('⚠️ GridCanvasThree: Asset without meta:', asset.name)
              return true // Include it anyway
            }
            const tags = Array.isArray(asset.meta.tags) ? asset.meta.tags : []
            const assetMode = asset.meta.mode || ''
            // Very lenient: include if has grid tag, grid mode, OR no mode restriction
            const result = tags.includes('grid') || assetMode === 'grid' || !assetMode
            if (!result) {
              console.log(
                `⏭️ GridCanvasThree: Skipping ${asset.name} - tags: ${tags.join(', ')}, mode: ${assetMode}`
              )
            }
            return result
          })
          .sort((a, b) => a.name.localeCompare(b.name))

        console.log(`✅ GridCanvasThree: Filtered to ${gridAssets.length} grid assets`)
        console.log(
          '📋 GridCanvasThree: Assets:',
          gridAssets.map((a) => a.name)
        )

        setAssets(gridAssets)
      } catch (err) {
        console.error('❌ GridCanvasThree: Failed to load assets:', err)
        setAssets([]) // Set empty array on error
      }
    }
    loadAssets()
  }, [])

  // When asset is selected
  const handleAssetSelect = (asset: Asset | null) => {
    if (onAssetSelect) {
      onAssetSelect(asset)
    } else {
      setLocalSelectedAsset(asset)
    }
    if (asset) {
      const objectType = assetToObjectType(asset) as ObjectType
      if (objectType) {
        setSelectedTool(objectType)
      }
    } else {
      setSelectedTool(null)
    }
  }

  const world = envSpec.world
  const width = world.width
  const height = world.height
  const cellSize = world.cellSize || 1

  // Debug: Log when envSpec world dimensions change
  useEffect(() => {
    console.log('🔍 GridCanvasThree - World dimensions:', { 
      width, 
      height, 
      cellSize,
      worldWidth: world.width,
      worldHeight: world.height
    })
  }, [width, height, cellSize, world.width, world.height])

  // Convert grid position to world coordinates
  const gridToWorld = (gridX: number, gridY: number): Vec2 => {
    return [gridX * cellSize, gridY * cellSize]
  }

  // Get object at grid position
  const getObjectAt = (gridX: number, gridY: number): ObjectSpec | null => {
    const worldPos = gridToWorld(gridX, gridY)
    const objects = Array.isArray(envSpec.objects) ? envSpec.objects : []
    return (
      objects.find((obj) => {
        if (!obj || !obj.position || !Array.isArray(obj.position)) return false
        const [objX, objY] = obj.position
        return (
          Math.floor(objX) === Math.floor(worldPos[0]) &&
          Math.floor(objY) === Math.floor(worldPos[1])
        )
      }) || null
    )
  }

  // Get agent at grid position
  const getAgentAt = (gridX: number, gridY: number) => {
    const worldPos = gridToWorld(gridX, gridY)
    let agentsToCheck: Array<{ id: string; position: Vec2 }> = []

    if (rolloutState?.agents && Array.isArray(rolloutState.agents)) {
      agentsToCheck = rolloutState.agents
    } else {
      const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
      agentsToCheck = agents.map((a) => ({ id: a.id, position: a.position }))
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
      const tolerance = cellSize * 0.6 // Increased tolerance
      if (Math.abs(agentX - cellWorldX) < tolerance && Math.abs(agentY - cellWorldY) < tolerance) {
        return agent
      }
    }

    return null
  }

  const handleCellClick = (
    gridX: number,
    gridY: number,
    event?: { clientX: number; clientY: number }
  ) => {
    if (rolloutState) return // Prevent editing during rollout

    const existingObject = getObjectAt(gridX, gridY)
    const existingAgent = getAgentAt(gridX, gridY)

    // If clicking on existing object/agent, show tooltip with info and delete button
    if (existingObject) {
      selectObject(existingObject.id)
      // Show tooltip at click position
      if (event) {
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          object: existingObject,
        })
      }
      return
    }

    if (existingAgent) {
      selectAgent(existingAgent.id)
      // Show tooltip at click position
      if (event) {
        setTooltip({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          agent: existingAgent,
        })
      }
      return
    }

    // Hide tooltip when clicking empty cell
    setTooltip({ visible: false, x: 0, y: 0 })

    // Place new object or agent using selected asset or hardcoded tool
    const worldPos = gridToWorld(gridX, gridY)

    console.log(
      '🎯 handleCellClick - selectedAsset:',
      selectedAsset?.name,
      'selectedTool:',
      selectedTool
    )

    // Use selected tool (from hardcoded palette) or asset
    // Use refs to ensure we have the latest values even if state hasn't updated yet
    const currentSelectedTool = selectedToolRef.current || selectedTool
    const currentSelectedAsset = selectedAssetRef.current || selectedAsset

    let objectType: ObjectType | 'agent' | null = null
    if (currentSelectedTool) {
      objectType = currentSelectedTool
      console.log('✅ Using selectedTool:', currentSelectedTool)
    } else if (currentSelectedAsset) {
      objectType = assetToObjectType(currentSelectedAsset) as ObjectType
      console.log(
        '✅ Using selectedAsset, converted to objectType:',
        objectType,
        'asset:',
        currentSelectedAsset.name
      )
    }

    if (!objectType) {
      // No asset/tool selected - open asset selector to help user
      console.warn(
        '⚠️ No objectType available - selectedAsset:',
        selectedAsset?.name,
        'selectedTool:',
        selectedTool
      )
      if (!selectedAsset && !selectedTool) {
        console.log('📂 Opening asset selector...')
        setShowAssetSelector(true)
      }
      return
    }

    if (objectType === 'agent') {
      // Remove existing agent if placing new one
      const agents = Array.isArray(envSpec.agents) ? envSpec.agents : []
      if (agents.length > 0) {
        sceneGraph.removeAgent(agents[0].id)
      }
      sceneGraph.addAgent('Agent', worldPos, { type: 'grid-step' })
      // Asset selection persists - user can place multiple agents
      console.log('✅ Placed agent, selectedAsset still:', selectedAsset?.name)
    } else if (objectType) {
      sceneGraph.addObject(
        objectType,
        worldPos,
        { type: 'rect', width: cellSize, height: cellSize },
        currentSelectedAsset ? { assetId: currentSelectedAsset._id } : {} // Store asset reference if available
      )
      // Asset selection persists - user can place multiple objects
      console.log(
        '✅ Placed object, selectedAsset still:',
        currentSelectedAsset?.name,
        'state:',
        selectedAsset?.name
      )
    }

    onSpecChange(sceneGraph.getSpec())
    // CRITICAL: selectedAsset and selectedTool remain set - user can keep placing multiple instances!
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

  // Handle delete from tooltip
  const handleDelete = () => {
    if (tooltip.object) {
      sceneGraph.removeObject(tooltip.object.id)
      onSpecChange(sceneGraph.getSpec())
      setTooltip({ visible: false, x: 0, y: 0 })
    } else if (tooltip.agent) {
      sceneGraph.removeAgent(tooltip.agent.id)
      onSpecChange(sceneGraph.getSpec())
      setTooltip({ visible: false, x: 0, y: 0 })
    }
  }

  // Close tooltip when clicking outside or pressing Escape
  useEffect(() => {
    if (!tooltip.visible) return

    const handleClickOutside = (e: MouseEvent) => {
      const tooltipElement = document.querySelector('[data-tooltip]')
      if (tooltipElement && !tooltipElement.contains(e.target as Node)) {
        setTooltip({ visible: false, x: 0, y: 0 })
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTooltip({ visible: false, x: 0, y: 0 })
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [tooltip.visible])

  // Debug: Log state on every render
  useEffect(() => {
    console.log(
      '🔄 GridCanvasThree render - selectedAsset:',
      selectedAsset?.name,
      'selectedTool:',
      selectedTool,
      'showAssetSelector:',
      showAssetSelector,
      'assets.length:',
      assets.length
    )
  })

  // CRITICAL: Ensure button is always visible - add explicit check
  const buttonShouldBeVisible = true // Always true - button should never disappear

  // Ensure button is always rendered - never conditionally hide it
  const renderAssetButton = () => {
    console.log('🎨 Rendering asset button - selectedAsset:', selectedAsset?.name)
    return (
      <button
        onClick={() => {
          console.log(
            '🖱️ Asset button clicked, current selectedAsset:',
            selectedAsset?.name,
            'ref:',
            selectedAssetRef.current?.name
          )
          setShowAssetSelector(true)
        }}
        className={`px-4 py-2 rounded text-sm border transition-all flex items-center gap-2 ${
          selectedAsset
            ? 'border-primary bg-primary text-primary-foreground shadow-md'
            : 'border-border hover:bg-muted'
        }`}
        title={
          selectedAsset
            ? `Selected: ${selectedAsset.name} - Click to change or place more`
            : 'Select an asset to place'
        }
        style={{
          minWidth: '120px',
          visibility: 'visible',
          opacity: 1,
          display: 'flex',
          position: 'relative',
          zIndex: 1001,
          pointerEvents: 'auto',
        }}
      >
        {selectedAsset ? (
          <>
            <span
              className="inline-block w-3 h-3 rounded"
              style={{
                backgroundColor:
                  selectedAsset.meta?.paletteColor ||
                  selectedAsset.visualProfile?.color ||
                  '#9ca3af',
              }}
            />
            <span>{selectedAsset.name}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Select Asset</span>
          </>
        )}
      </button>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Minimal status bar - asset selection is now in Layers panel */}
      {selectedAsset && (
        <div className="p-1.5 border-b border-border bg-card text-xs text-muted-foreground flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded"
            style={{
              backgroundColor:
                selectedAsset.meta?.paletteColor || selectedAsset.visualProfile?.color || '#9ca3af',
            }}
          />
          <span>Selected: {selectedAsset.name} - Click empty cells to place</span>
        </div>
      )}

      {/* Fallback Hardcoded Tool Palette (temporary - only show if no assets available) */}
      {assets.length === 0 && (
        <div className="p-2 border-b border-border flex gap-2 flex-wrap bg-card">
          {TOOL_PALETTE.map((tool) => (
            <button
              key={tool.type}
              onClick={() => {
                setSelectedTool(tool.type)
                setSelectedAsset(null) // Clear asset selection when using hardcoded tool
              }}
              className={`px-3 py-1 rounded text-sm border transition-all ${
                selectedTool === tool.type
                  ? 'border-primary bg-primary text-primary-foreground shadow-md'
                  : 'border-border hover:bg-muted'
              }`}
              title={tool.label}
            >
              <span
                className="inline-block w-3 h-3 rounded mr-2"
                style={{ backgroundColor: tool.color }}
              />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Asset Selector Modal */}
      {showAssetSelector && (
        <AssetSelector
          mode="grid"
          selectedAssetId={selectedAsset?._id}
          onSelect={(asset) => {
            handleAssetSelect(asset)
            setShowAssetSelector(false)
          }}
          onClose={() => setShowAssetSelector(false)}
        />
      )}

      {/* 3D Canvas */}
      <div
        className="flex-1 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        style={{ zIndex: 1 }}
      >
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}
        >
          <PerspectiveCamera
            makeDefault
            position={[
              Math.max(width, height) * 0.8,
              Math.max(width, height) * 0.8,
              Math.max(width, height) * 0.8,
            ]}
            fov={50}
          />

          <SceneContent
            key={`grid-${width}-${height}`}
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
        Grid: {width} × {height} | Objects: {envSpec.objects.length} | Agents:{' '}
        {envSpec.agents.length}
      </div>

      {/* Object Tooltip - Shows info and delete button when clicking on objects */}
      {tooltip.visible && (tooltip.object || tooltip.agent) && (
        <div
          data-tooltip
          className="fixed z-50 bg-background border-2 border-border rounded-lg shadow-2xl p-4 min-w-[200px] pointer-events-auto backdrop-blur-none"
          style={{
            left: `${tooltip.x + 15}px`,
            top: `${tooltip.y - 10}px`,
            transform: 'translateY(-100%)',
            maxWidth: '250px',
            backgroundColor: 'hsl(var(--background))',
            opacity: 1,
          }}
        >
          <div className="space-y-2">
            {/* Object/Agent Info */}
            <div className="space-y-1">
              <div className="font-semibold text-sm">
                {tooltip.object ? (
                  <span className="capitalize">{tooltip.object.type}</span>
                ) : (
                  <>Agent</>
                )}
              </div>
              {tooltip.object && tooltip.object.position && (
                <div className="text-xs text-muted-foreground">
                  Position: ({Math.round(tooltip.object.position[0])},{' '}
                  {Math.round(tooltip.object.position[1])})
                </div>
              )}
              {tooltip.agent && tooltip.agent.position && (
                <div className="text-xs text-muted-foreground">
                  Position: ({Math.round(tooltip.agent.position[0])},{' '}
                  {Math.round(tooltip.agent.position[1])})
                </div>
              )}
            </div>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="w-full px-3 py-1.5 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
