// GridCanvas - Universal grid renderer using EnvSpec/ObjectSpec
import { useState, useEffect, useRef } from 'react'
import { EnvSpec, ObjectSpec, Vec2, ObjectType } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { AssetPalette, assetToObjectType, getAssetColor } from './AssetPalette'
import { useSelection } from '~/lib/selectionManager.js'
import { Asset } from '~/lib/assetClient'

interface GridCanvasProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
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

export function GridCanvas({ envSpec, sceneGraph, onSpecChange, rolloutState }: GridCanvasProps) {
  const { selection, selectObject, selectAgent } = useSelection()
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [assets, setAssets] = useState<Asset[]>([]) // Initialize as empty array
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
    if (!envSpec.objects || !Array.isArray(envSpec.objects)) {
      return null
    }
    return envSpec.objects.find((obj) => {
      if (!obj || !obj.position || !Array.isArray(obj.position)) return false
      const [objX, objY] = obj.position
      return Math.floor(objX) === Math.floor(worldPos[0]) && 
             Math.floor(objY) === Math.floor(worldPos[1])
    }) || null
  }

  // Get agent at grid position (use rollout state if available, otherwise use envSpec)
  const getAgentAt = (gridX: number, gridY: number) => {
    const worldPos = gridToWorld(gridX, gridY)
    let agentsToCheck: Array<{ id: string; position: Vec2 }> = []
    
    if (rolloutState?.agents && Array.isArray(rolloutState.agents)) {
      agentsToCheck = rolloutState.agents
    } else if (envSpec.agents && Array.isArray(envSpec.agents)) {
      agentsToCheck = envSpec.agents.map(a => ({ id: a.id, position: a.position }))
    }
    
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

    // Place new object or agent using selected asset or hardcoded tool
    const worldPos = gridToWorld(gridX, gridY)

    // Use selected tool (from hardcoded palette) or asset
    let objectType: ObjectType | 'agent' | null = null
    if (selectedTool) {
      objectType = selectedTool
    } else if (selectedAsset) {
      objectType = assetToObjectType(selectedAsset) as ObjectType
    }

    if (!objectType) return

    if (objectType === 'agent') {
      // Remove existing agent if placing new one
      if (envSpec.agents && Array.isArray(envSpec.agents) && envSpec.agents.length > 0) {
        sceneGraph.removeAgent(envSpec.agents[0].id)
      }
      sceneGraph.addAgent('Agent', worldPos, { type: 'grid-step' })
    } else {
      sceneGraph.addObject(
        objectType,
        worldPos,
        { type: 'rect', width: cellSize, height: cellSize },
        selectedAsset ? { assetId: selectedAsset._id } : {} // Store asset reference if available
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

  // Get color for object/agent from assets or hardcoded palette
  const getColorForObject = (object: ObjectSpec | null, agent: any): string => {
    if (object) {
      // Try to find asset by assetId stored in properties
      if (object.properties?.assetId && assets && assets.length > 0) {
        const asset = assets.find(a => a._id === object.properties.assetId)
        if (asset) {
          const hexColor = asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
          // Convert hex to inline style (we'll use inline style for dynamic colors)
          return '' // Return empty string, we'll use inline style
        }
      }
      // Fallback: find asset by type
      if (assets && assets.length > 0) {
        const asset = assets.find(a => {
          const objectType = assetToObjectType(a)
          return objectType === object.type
        })
        if (asset) {
          const hexColor = asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
          return '' // Return empty string, we'll use inline style
        }
      }
      // Final fallback: use hardcoded colors
      const tool = TOOL_PALETTE.find(t => t.type === object.type)
      if (tool) {
        return '' // Use inline style for hardcoded colors
      }
      return 'bg-gray-400'
    }
    if (agent) {
      // Find agent asset
      if (assets && assets.length > 0) {
        const agentAsset = assets.find(a => {
          const objectType = assetToObjectType(a)
          return objectType === 'agent'
        })
        if (agentAsset) {
          const hexColor = agentAsset.meta?.paletteColor || agentAsset.visualProfile?.color || '#4a90e2'
          return '' // Return empty string, we'll use inline style
        }
      }
      // Fallback to hardcoded agent color
      return '' // Use inline style
    }
    return 'bg-white'
  }

  // Get hex color for object/agent from assets or hardcoded palette
  const getHexColorForObject = (object: ObjectSpec | null, agent: any): string => {
    if (object) {
      // Try to find asset by assetId stored in properties
      if (object.properties?.assetId && assets && assets.length > 0) {
        const asset = assets.find(a => a._id === object.properties.assetId)
        if (asset) {
          return asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
        }
      }
      // Fallback: find asset by type
      if (assets && assets.length > 0) {
        const asset = assets.find(a => {
          const objectType = assetToObjectType(a)
          return objectType === object.type
        })
        if (asset) {
          return asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
        }
      }
      // Final fallback: use hardcoded colors
      const tool = TOOL_PALETTE.find(t => t.type === object.type)
      if (tool) {
        return tool.color
      }
      return '#9ca3af'
    }
    if (agent) {
      // Find agent asset
      if (assets && assets.length > 0) {
        const agentAsset = assets.find(a => {
          const objectType = assetToObjectType(a)
          return objectType === 'agent'
        })
        if (agentAsset) {
          return agentAsset.meta?.paletteColor || agentAsset.visualProfile?.color || '#4a90e2'
        }
      }
      // Fallback to hardcoded agent color
      return '#4a90e2'
    }
    return '#ffffff'
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

        const color = getColorForObject(object, agent)
        const hexColor = getHexColorForObject(object, agent)
        const useInlineStyle = color === '' && hexColor !== '#ffffff'

        cells.push(
          <button
            key={`${x}-${y}`}
            onClick={() => handleCellClick(x, y)}
            onContextMenu={(e) => handleCellRightClick(e, x, y)}
            className={`w-10 h-10 border border-gray-300 ${color || 'bg-white'} hover:opacity-80 transition-opacity ${
              isSelected ? 'ring-2 ring-primary ring-offset-1' : ''
            }`}
            style={useInlineStyle ? { backgroundColor: hexColor } : undefined}
            title={`${x}, ${y}${object ? ` - ${object.type}` : ''}${agent ? ` - ${agent.name}` : ''}`}
          />
        )
      }
    }

    return cells
  }

  // Load assets when component mounts
  useEffect(() => {
    async function loadAssets() {
      try {
        const { listAssets } = await import('~/lib/assetClient')
        const loadedAssets = await listAssets({ mode: 'grid' })
        if (loadedAssets && Array.isArray(loadedAssets)) {
          const primaryAssets = loadedAssets
            .filter((asset) => asset && asset.meta?.palette === 'primary')
            .sort((a, b) => a.name.localeCompare(b.name))
          setAssets(primaryAssets)
        } else {
          setAssets([])
        }
      } catch (err) {
        console.warn('Failed to load assets:', err)
        setAssets([]) // Ensure assets is always an array
      }
    }
    loadAssets()
  }, [])

  const [selectedTool, setSelectedTool] = useState<ObjectType | 'agent' | null>(null)

  // When asset is selected, update selectedTool for backward compatibility
  useEffect(() => {
    if (selectedAsset) {
      const objectType = assetToObjectType(selectedAsset) as ObjectType
      if (objectType) {
        setSelectedTool(objectType)
      }
    }
  }, [selectedAsset])

  return (
    <div className="h-full flex flex-col">
      {/* Asset Palette from Backend */}
      <AssetPalette
        mode="grid"
        selectedAssetId={selectedAsset?._id}
        onSelectAsset={(asset) => {
          setSelectedAsset(asset)
          if (asset) {
            const objectType = assetToObjectType(asset) as ObjectType
            if (objectType) {
              setSelectedTool(objectType)
            }
          } else {
            setSelectedTool(null)
          }
        }}
        className="bg-card"
      />

      {/* Fallback Hardcoded Tool Palette (temporary) */}
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
        Grid: {width} × {height} | Objects: {envSpec.objects && Array.isArray(envSpec.objects) ? envSpec.objects.length : 0} | Agents: {envSpec.agents && Array.isArray(envSpec.agents) ? envSpec.agents.length : 0}
      </div>
    </div>
  )
}

