import { useState, useEffect } from 'react'
import { EnvSpec, EnvType, ActionSpaceSpec, DynamicsSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { RuleEditor } from './RuleEditor'
import { ValidationPanel } from './ValidationPanel'
import {
  validateActionSpace,
  validateDynamics,
  getRecommendedActionSpace,
  getRecommendedDynamics,
} from '~/lib/actionSpaceValidation'

type EditingMode = 'structure' | 'actions' | 'rewards' | 'episode' | 'code'

interface StudioPropertiesPanelProps {
  envSpec: EnvSpec
  onSpecChange: (spec: EnvSpec) => void
  selectedObjectId?: string
  sceneGraph?: SceneGraphManager
}

export function StudioPropertiesPanel({
  envSpec,
  onSpecChange,
  selectedObjectId,
  sceneGraph,
}: StudioPropertiesPanelProps) {
  const [mode, setMode] = useState<EditingMode>('structure')

  const modes: { id: EditingMode; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'actions', label: 'Actions & Dynamics' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'episode', label: 'Episode' },
    { id: 'code', label: 'Code' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Mode Tabs */}
      <div className="flex border-b border-border">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              mode === m.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode Content */}
      <div className="flex-1 overflow-auto p-4">
        {mode === 'structure' && (
          <StructureMode
            envSpec={envSpec}
            onSpecChange={onSpecChange}
            selectedObjectId={selectedObjectId}
          />
        )}

        {mode === 'actions' && <ActionsMode envSpec={envSpec} onSpecChange={onSpecChange} />}

        {mode === 'rewards' && sceneGraph ? (
          <RuleEditor envSpec={envSpec} sceneGraph={sceneGraph} onSpecChange={onSpecChange} />
        ) : mode === 'rewards' ? (
          <div className="text-xs text-muted-foreground p-4">
            Rule editor requires scene graph. Please refresh the page.
          </div>
        ) : null}

        {mode === 'episode' && <EpisodeMode envSpec={envSpec} onSpecChange={onSpecChange} />}

        {mode === 'code' && <CodeMode envSpec={envSpec} onSpecChange={onSpecChange} />}
      </div>
    </div>
  )
}

function StructureMode({ envSpec, onSpecChange, selectedObjectId }: StudioPropertiesPanelProps) {
  const envType = envSpec?.envType || envSpec?.type || 'grid'
  const [widthInput, setWidthInput] = useState<string>('')
  const [heightInput, setHeightInput] = useState<string>('')
  const [pendingChanges, setPendingChanges] = useState(false)

  // Sync local state with envSpec when it changes externally
  useEffect(() => {
    if (envSpec?.world?.width !== undefined) {
      setWidthInput(String(envSpec.world.width))
    }
  }, [envSpec?.world?.width])

  useEffect(() => {
    if (envSpec?.world?.height !== undefined) {
      setHeightInput(String(envSpec.world.height))
    }
  }, [envSpec?.world?.height])

  // Reset pending changes when envSpec updates
  useEffect(() => {
    setPendingChanges(false)
  }, [envSpec?.world?.width, envSpec?.world?.height])

  const applyGridSizeChanges = () => {
    const width = parseInt(widthInput, 10) || envSpec?.world?.width || 10
    const height = parseInt(heightInput, 10) || envSpec?.world?.height || 10
    const validWidth = Math.max(1, Math.min(100, width))
    const validHeight = Math.max(1, Math.min(100, height))
    
    setWidthInput(String(validWidth))
    setHeightInput(String(validHeight))
    setPendingChanges(false)
    
    onSpecChange({
      ...envSpec,
      world: {
        ...envSpec?.world,
        width: validWidth,
        height: validHeight,
      },
    })
  }

  if (envType === 'grid') {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Grid Size</label>
            {pendingChanges && (
              <button
                onClick={applyGridSizeChanges}
                className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Apply
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="100"
              value={widthInput || envSpec?.world?.width || 10}
              onChange={(e) => {
                const inputValue = e.target.value
                setWidthInput(inputValue) // Update local state immediately
                
                // Check if this is different from current value
                const currentWidth = envSpec?.world?.width || 10
                const newWidth = parseInt(inputValue, 10)
                
                if (!isNaN(newWidth) && newWidth >= 1 && newWidth <= 100 && newWidth !== currentWidth) {
                  setPendingChanges(true)
                  // Update immediately for real-time preview
                  onSpecChange({
                    ...envSpec,
                    world: {
                      ...envSpec?.world,
                      width: newWidth,
                    },
                  })
                } else if (inputValue === '' || isNaN(newWidth)) {
                  setPendingChanges(true)
                }
              }}
              onBlur={(e) => {
                // Validate and clamp on blur
                const width = parseInt(e.target.value, 10)
                if (isNaN(width) || width < 1 || width > 100) {
                  const validWidth = Math.max(1, Math.min(100, width || 10))
                  setWidthInput(String(validWidth))
                  onSpecChange({
                    ...envSpec,
                    world: {
                      ...envSpec?.world,
                      width: validWidth,
                    },
                  })
                }
              }}
              className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Width"
            />
            <input
              type="number"
              min="1"
              max="100"
              value={heightInput || envSpec?.world?.height || 10}
              onChange={(e) => {
                const inputValue = e.target.value
                setHeightInput(inputValue) // Update local state immediately
                
                // Check if this is different from current value
                const currentHeight = envSpec?.world?.height || 10
                const newHeight = parseInt(inputValue, 10)
                
                if (!isNaN(newHeight) && newHeight >= 1 && newHeight <= 100 && newHeight !== currentHeight) {
                  setPendingChanges(true)
                  // Update immediately for real-time preview
                  onSpecChange({
                    ...envSpec,
                    world: {
                      ...envSpec?.world,
                      height: newHeight,
                    },
                  })
                } else if (inputValue === '' || isNaN(newHeight)) {
                  setPendingChanges(true)
                }
              }}
              onBlur={(e) => {
                // Validate and clamp on blur
                const height = parseInt(e.target.value, 10)
                if (isNaN(height) || height < 1 || height > 100) {
                  const validHeight = Math.max(1, Math.min(100, height || 10))
                  setHeightInput(String(validHeight))
                  onSpecChange({
                    ...envSpec,
                    world: {
                      ...envSpec?.world,
                      height: validHeight,
                    },
                  })
                }
              }}
              className="w-full px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Height"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Grid dimensions (1-100 cells)</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cell Types</label>
          <div className="text-xs text-muted-foreground">
            Click cells in the canvas to place objects
          </div>
        </div>
      </div>
    )
  }

  if (envType === 'continuous2d') {
    const bounds = envSpec?.stateSpace?.bounds || [
      [-10, 10],
      [-10, 10],
    ]
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">World Dimensions</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={envSpec?.world?.width || 20}
              onChange={(e) => {
                onSpecChange({
                  ...envSpec,
                  world: {
                    ...envSpec?.world,
                    width: parseFloat(e.target.value) || 20,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Width"
            />
            <input
              type="number"
              step="0.1"
              value={envSpec?.world?.height || 20}
              onChange={(e) => {
                onSpecChange({
                  ...envSpec,
                  world: {
                    ...envSpec?.world,
                    height: parseFloat(e.target.value) || 20,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Height"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bounds (X-axis)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={bounds[0][0]}
              onChange={(e) => {
                const newBounds = [...bounds]
                newBounds[0] = [parseFloat(e.target.value) || -10, bounds[0][1]]
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    bounds: newBounds,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
            />
            <input
              type="number"
              step="0.1"
              value={bounds[0][1]}
              onChange={(e) => {
                const newBounds = [...bounds]
                newBounds[0] = [bounds[0][0], parseFloat(e.target.value) || 10]
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    bounds: newBounds,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Bounds (Y-axis)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={bounds[1][0]}
              onChange={(e) => {
                const newBounds = [...bounds]
                newBounds[1] = [parseFloat(e.target.value) || -10, bounds[1][1]]
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    bounds: newBounds,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
            />
            <input
              type="number"
              step="0.1"
              value={bounds[1][1]}
              onChange={(e) => {
                const newBounds = [...bounds]
                newBounds[1] = [bounds[1][0], parseFloat(e.target.value) || 10]
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    bounds: newBounds,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Objects</label>
          <div className="text-xs text-muted-foreground">
            Click on canvas to place objects, drag to move
          </div>
        </div>
      </div>
    )
  }

  if (envType === 'continuous2d') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">World Dimensions</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={envSpec?.world?.width || 20}
              onChange={(e) => {
                onSpecChange({
                  ...envSpec,
                  world: {
                    ...envSpec?.world,
                    width: parseFloat(e.target.value) || 20,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Width"
            />
            <input
              type="number"
              step="0.1"
              value={envSpec?.world?.height || 20}
              onChange={(e) => {
                onSpecChange({
                  ...envSpec,
                  world: {
                    ...envSpec?.world,
                    height: parseFloat(e.target.value) || 20,
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Height"
            />
          </div>
        </div>
      </div>
    )
  }

  if (envType === 'bandit') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Number of Arms</label>
          <div className="text-xs text-muted-foreground">
            Use the canvas to add and configure arms
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm text-muted-foreground">Structure mode for {envType} coming soon</div>
  )
}

function ActionsMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const envType: EnvType = envSpec?.envType || (envSpec?.world?.coordinateSystem === 'grid' ? 'grid' : 'continuous2d')
  const actionSpace = envSpec?.actionSpace || getRecommendedActionSpace(envType)
  const dynamics = envSpec?.agents?.[0]?.dynamics || getRecommendedDynamics(envType)
  const [useCustom, setUseCustom] = useState(false)

  // Check if current action space matches recommended
  useEffect(() => {
    const recommended = getRecommendedActionSpace(envType)
    const isRecommended =
      actionSpace.type === recommended.type &&
      (recommended.type === 'discrete'
        ? JSON.stringify(actionSpace.actions?.sort()) === JSON.stringify(recommended.actions?.sort())
        : actionSpace.dimensions === recommended.dimensions &&
          JSON.stringify(actionSpace.range) === JSON.stringify(recommended.range))
    setUseCustom(!isRecommended)
  }, [envType, actionSpace])

  // Real-time validation
  const actionSpaceValidation = validateActionSpace(actionSpace, envType, dynamics)
  const dynamicsValidation = validateDynamics(dynamics, actionSpace)

  const handleActionSpaceChange = (newActionSpace: ActionSpaceSpec) => {
    onSpecChange({
      ...envSpec,
      actionSpace: newActionSpace,
    })
  }

  const handleDynamicsChange = (newDynamics: DynamicsSpec) => {
    // Update all agents' dynamics
    const updatedAgents = envSpec.agents.map((agent) => ({
      ...agent,
      dynamics: newDynamics,
    }))
    onSpecChange({
      ...envSpec,
      agents: updatedAgents,
    })
  }

  const handleUseRecommended = () => {
    const recommended = getRecommendedActionSpace(envType)
    const recommendedDynamics = getRecommendedDynamics(envType)
    handleActionSpaceChange(recommended)
    handleDynamicsChange(recommendedDynamics)
    setUseCustom(false)
  }

  return (
    <div className="space-y-4">
      {/* Environment Type Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded">
            {envType === 'grid' ? 'Grid' : envType === 'continuous2d' ? 'Continuous 2D' : envType}
          </span>
        </div>
        {useCustom && (
          <button
            onClick={handleUseRecommended}
            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded border border-border"
          >
            Use Recommended
          </button>
        )}
      </div>

      {/* Action Space Configuration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Action Space</label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="rounded"
            />
            <span>Custom</span>
          </label>
        </div>

        {envType === 'grid' ? (
          <GridActionsConfig
            actionSpace={actionSpace}
            useCustom={useCustom}
            onActionSpaceChange={handleActionSpaceChange}
          />
        ) : envType === 'continuous2d' ? (
          <ContinuousActionsConfig
            actionSpace={actionSpace}
            useCustom={useCustom}
            onActionSpaceChange={handleActionSpaceChange}
          />
        ) : (
          <GenericActionsConfig
            actionSpace={actionSpace}
            onActionSpaceChange={handleActionSpaceChange}
          />
        )}

        <ValidationPanel validation={actionSpaceValidation} title="Action Space" />
      </div>

      {/* Dynamics Configuration */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Dynamics</label>
        <DynamicsConfig
          dynamics={dynamics}
          envType={envType}
          actionSpace={actionSpace}
          onDynamicsChange={handleDynamicsChange}
        />
        <ValidationPanel validation={dynamicsValidation} title="Dynamics" />
      </div>
    </div>
  )
}

// Grid Actions Configuration Component
function GridActionsConfig({
  actionSpace,
  useCustom,
  onActionSpaceChange,
}: {
  actionSpace: ActionSpaceSpec
  useCustom: boolean
  onActionSpaceChange: (actionSpace: ActionSpaceSpec) => void
}) {
  if (!useCustom) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Recommended: Discrete Actions</p>
          <p className="text-xs">
            Actions: {actionSpace.type === 'discrete' ? actionSpace.actions?.join(', ') : 'N/A'}
          </p>
          <p className="text-xs mt-1">Enable "Custom" to modify</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Action Space Type</label>
        <select
          value={actionSpace.type || 'discrete'}
          onChange={(e) => {
            if (e.target.value === 'discrete') {
              onActionSpaceChange({
                type: 'discrete',
                actions: actionSpace.type === 'discrete' ? actionSpace.actions || [] : ['up', 'down', 'left', 'right'],
              })
            } else {
              onActionSpaceChange({
                type: 'continuous',
                dimensions: 2,
                range: [-1, 1],
              })
            }
          }}
          className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
        >
          <option value="discrete">Discrete</option>
          <option value="continuous">Continuous</option>
        </select>
      </div>

      {actionSpace.type === 'discrete' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium">Actions</label>
            <button
              onClick={() => {
                const newActions = [...(actionSpace.actions || []), 'new_action']
                onActionSpaceChange({ ...actionSpace, actions: newActions })
              }}
              className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {actionSpace.actions?.map((action: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => {
                    const newActions = [...(actionSpace.actions || [])]
                    newActions[i] = e.target.value
                    onActionSpaceChange({ ...actionSpace, actions: newActions })
                  }}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                  placeholder="action_name"
                />
                {actionSpace.actions && actionSpace.actions.length > 1 && (
                  <button
                    onClick={() => {
                      const newActions = actionSpace.actions.filter((_, idx) => idx !== i)
                      onActionSpaceChange({ ...actionSpace, actions: newActions })
                    }}
                    className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {actionSpace.type === 'continuous' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1">Dimensions</label>
            <input
              type="number"
              min="1"
              max="10"
              value={actionSpace.dimensions || 2}
              onChange={(e) => {
                const dims = parseInt(e.target.value, 10) || 2
                onActionSpaceChange({
                  ...actionSpace,
                  dimensions: dims,
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[0] ?? -1}
                onChange={(e) => {
                  const min = parseFloat(e.target.value) || -1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [min, actionSpace.range?.[1] ?? 1],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
                placeholder="Min"
              />
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[1] ?? 1}
                onChange={(e) => {
                  const max = parseFloat(e.target.value) || 1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [actionSpace.range?.[0] ?? -1, max],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
                placeholder="Max"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Continuous Actions Configuration Component
function ContinuousActionsConfig({
  actionSpace,
  useCustom,
  onActionSpaceChange,
}: {
  actionSpace: ActionSpaceSpec
  useCustom: boolean
  onActionSpaceChange: (actionSpace: ActionSpaceSpec) => void
}) {
  if (!useCustom) {
    return (
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Recommended: Continuous Actions</p>
          <p className="text-xs">
            Dimensions: {actionSpace.type === 'continuous' ? actionSpace.dimensions : 'N/A'}, Range:{' '}
            {actionSpace.type === 'continuous' ? `[${actionSpace.range?.[0]}, ${actionSpace.range?.[1]}]` : 'N/A'}
          </p>
          <p className="text-xs mt-1">Enable "Custom" to modify</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Action Space Type</label>
        <select
          value={actionSpace.type || 'continuous'}
          onChange={(e) => {
            if (e.target.value === 'continuous') {
              onActionSpaceChange({
                type: 'continuous',
                dimensions: actionSpace.type === 'continuous' ? actionSpace.dimensions || 2 : 2,
                range: actionSpace.type === 'continuous' ? actionSpace.range || [-1, 1] : [-1, 1],
              })
            } else {
              onActionSpaceChange({
                type: 'discrete',
                actions: ['up', 'down', 'left', 'right'],
              })
            }
          }}
          className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
        >
          <option value="continuous">Continuous</option>
          <option value="discrete">Discrete</option>
        </select>
      </div>

      {actionSpace.type === 'continuous' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1">Dimensions</label>
            <input
              type="number"
              min="1"
              max="10"
              value={actionSpace.dimensions || 2}
              onChange={(e) => {
                const dims = parseInt(e.target.value, 10) || 2
                onActionSpaceChange({
                  ...actionSpace,
                  dimensions: dims,
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">Typically 2 for X, Y velocity</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[0] ?? -1}
                onChange={(e) => {
                  const min = parseFloat(e.target.value) || -1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [min, actionSpace.range?.[1] ?? 1],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
                placeholder="Min"
              />
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[1] ?? 1}
                onChange={(e) => {
                  const max = parseFloat(e.target.value) || 1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [actionSpace.range?.[0] ?? -1, max],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
                placeholder="Max"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Normalized velocity range (recommended: -1 to 1)</p>
          </div>
        </div>
      )}

      {actionSpace.type === 'discrete' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium">Actions</label>
            <button
              onClick={() => {
                const newActions = [...(actionSpace.actions || []), 'new_action']
                onActionSpaceChange({ ...actionSpace, actions: newActions })
              }}
              className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {actionSpace.actions?.map((action: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => {
                    const newActions = [...(actionSpace.actions || [])]
                    newActions[i] = e.target.value
                    onActionSpaceChange({ ...actionSpace, actions: newActions })
                  }}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                  placeholder="action_name"
                />
                {actionSpace.actions && actionSpace.actions.length > 1 && (
                  <button
                    onClick={() => {
                      const newActions = actionSpace.actions.filter((_, idx) => idx !== i)
                      onActionSpaceChange({ ...actionSpace, actions: newActions })
                    }}
                    className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Generic Actions Configuration (fallback)
function GenericActionsConfig({
  actionSpace,
  onActionSpaceChange,
}: {
  actionSpace: ActionSpaceSpec
  onActionSpaceChange: (actionSpace: ActionSpaceSpec) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Action Space Type</label>
        <select
          value={actionSpace.type || 'discrete'}
          onChange={(e) => {
            if (e.target.value === 'discrete') {
              onActionSpaceChange({
                type: 'discrete',
                actions: actionSpace.type === 'discrete' ? actionSpace.actions || [] : ['up', 'down', 'left', 'right'],
              })
            } else {
              onActionSpaceChange({
                type: 'continuous',
                dimensions: 2,
                range: [-1, 1],
              })
            }
          }}
          className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
        >
          <option value="discrete">Discrete</option>
          <option value="continuous">Continuous</option>
        </select>
      </div>

      {actionSpace.type === 'discrete' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium">Actions</label>
            <button
              onClick={() => {
                const newActions = [...(actionSpace.actions || []), 'new_action']
                onActionSpaceChange({ ...actionSpace, actions: newActions })
              }}
              className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1">
            {actionSpace.actions?.map((action: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => {
                    const newActions = [...(actionSpace.actions || [])]
                    newActions[i] = e.target.value
                    onActionSpaceChange({ ...actionSpace, actions: newActions })
                  }}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                />
                {actionSpace.actions && actionSpace.actions.length > 1 && (
                  <button
                    onClick={() => {
                      const newActions = actionSpace.actions.filter((_, idx) => idx !== i)
                      onActionSpaceChange({ ...actionSpace, actions: newActions })
                    }}
                    className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {actionSpace.type === 'continuous' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1">Dimensions</label>
            <input
              type="number"
              min="1"
              max="10"
              value={actionSpace.dimensions || 2}
              onChange={(e) => {
                const dims = parseInt(e.target.value, 10) || 2
                onActionSpaceChange({
                  ...actionSpace,
                  dimensions: dims,
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[0] ?? -1}
                onChange={(e) => {
                  const min = parseFloat(e.target.value) || -1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [min, actionSpace.range?.[1] ?? 1],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
              />
              <input
                type="number"
                step="0.1"
                value={actionSpace.range?.[1] ?? 1}
                onChange={(e) => {
                  const max = parseFloat(e.target.value) || 1
                  onActionSpaceChange({
                    ...actionSpace,
                    range: [actionSpace.range?.[0] ?? -1, max],
                  })
                }}
                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Dynamics Configuration Component
function DynamicsConfig({
  dynamics,
  envType,
  actionSpace,
  onDynamicsChange,
}: {
  dynamics: DynamicsSpec | undefined
  envType: EnvType
  actionSpace: ActionSpaceSpec
  onDynamicsChange: (dynamics: DynamicsSpec) => void
}) {
  const currentDynamics = dynamics || getRecommendedDynamics(envType)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Dynamics Type</label>
        <select
          value={currentDynamics.type}
          onChange={(e) => {
            const type = e.target.value
            if (type === 'grid-step') {
              onDynamicsChange({ type: 'grid-step' })
            } else if (type === 'continuous-velocity') {
              onDynamicsChange({ type: 'continuous-velocity', maxSpeed: 0.1 })
            } else if (type === 'car-like') {
              onDynamicsChange({ type: 'car-like', maxSpeed: 0.1, turnRate: 0.1 })
            }
          }}
          className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
        >
          <option value="grid-step">Grid Step</option>
          <option value="continuous-velocity">Continuous Velocity</option>
          <option value="car-like">Car-like</option>
        </select>
      </div>

      {currentDynamics.type === 'continuous-velocity' && (
        <div>
          <label className="block text-xs font-medium mb-1">Max Speed</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="10"
            value={currentDynamics.maxSpeed || 0.1}
            onChange={(e) => {
              const maxSpeed = parseFloat(e.target.value) || 0.1
              onDynamicsChange({ type: 'continuous-velocity', maxSpeed })
            }}
            className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">Maximum velocity per step</p>
        </div>
      )}

      {currentDynamics.type === 'car-like' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1">Max Speed</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={currentDynamics.maxSpeed || 0.1}
              onChange={(e) => {
                const maxSpeed = parseFloat(e.target.value) || 0.1
                onDynamicsChange({
                  type: 'car-like',
                  maxSpeed,
                  turnRate: currentDynamics.type === 'car-like' ? currentDynamics.turnRate : 0.1,
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Turn Rate</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="2"
              value={currentDynamics.type === 'car-like' ? currentDynamics.turnRate || 0.1 : 0.1}
              onChange={(e) => {
                const turnRate = parseFloat(e.target.value) || 0.1
                onDynamicsChange({
                  type: 'car-like',
                  maxSpeed: currentDynamics.type === 'car-like' ? currentDynamics.maxSpeed : 0.1,
                  turnRate,
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
        </div>
      )}

      {currentDynamics.type === 'grid-step' && (
        <div className="text-xs text-muted-foreground">
          <p>Moves one cell per action (matches grid cell size)</p>
        </div>
      )}
    </div>
  )
}

function RewardsMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const rules = envSpec?.rules?.rewards || []

  const addRule = () => {
    const newRule = {
      id: `reward_${Date.now()}`,
      condition: { type: 'timeout', steps: 1 },
      reward: 0,
      shaping: false,
    }
    onSpecChange({
      ...envSpec,
      rules: {
        ...envSpec.rules,
        rewards: [...rules, newRule],
      },
    })
  }

  const removeRule = (ruleId: string) => {
    const newRules = rules.filter((r: any) => r.id !== ruleId)
    onSpecChange({
      ...envSpec,
      rules: {
        ...envSpec.rules,
        rewards: newRules,
      },
    })
  }

  const updateRule = (ruleId: string, updates: any) => {
    const newRules = rules.map((r: any) => (r.id === ruleId ? { ...r, ...updates } : r))
    onSpecChange({
      ...envSpec,
      rules: {
        ...envSpec.rules,
        rewards: newRules,
      },
    })
  }

  const getConditionLabel = (condition: any) => {
    if (!condition) return 'Unknown'
    if (condition.type === 'timeout') return `Timeout (Steps)`
    if (condition.type === 'reach_goal') return 'Goal Reached'
    if (condition.type === 'hit_trap') return 'Trap Hit'
    if (condition.type === 'step') return 'Per Step'
    if (condition.type === 'collect_key') return 'Key Collected'
    return condition.type || 'Custom'
  }

  const getTotalReward = () => {
    if (rules.length === 0) return 0
    // For timeout conditions, calculate based on steps
    return rules.reduce((sum: number, rule: any) => {
      if (rule.condition?.type === 'timeout' && rule.condition?.steps) {
        return sum + rule.reward * rule.condition.steps
      }
      return sum + rule.reward
    }, 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Reward Rules</label>
        <button
          onClick={addRule}
          className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          + Add Rule
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 text-center border border-border rounded">
            No reward rules defined. Click "+ Add Rule" to add a rule.
          </div>
        ) : (
          rules.map((rule: any) => (
            <div key={rule.id} className="p-3 border border-border rounded bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium">Reward Rule</span>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12">IF:</label>
                  <select
                    value={rule.condition?.type || ''}
                    onChange={(e) => {
                      const conditionType = e.target.value
                      let newCondition: any = { type: conditionType }
                      
                      // Set default steps for timeout
                      if (conditionType === 'timeout') {
                        newCondition.steps = rule.condition?.steps || 1
                      }
                      
                      updateRule(rule.id, { condition: newCondition })
                    }}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                  >
                    <option value="timeout">Timeout (Steps)</option>
                    <option value="reach_goal">Goal Reached</option>
                    <option value="hit_trap">Trap Hit</option>
                    <option value="step">Per Step</option>
                    <option value="collect_key">Key Collected</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                
                {rule.condition?.type === 'timeout' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-12">Steps:</label>
                    <input
                      type="number"
                      min="1"
                      value={rule.condition?.steps || 1}
                      onChange={(e) => {
                        updateRule(rule.id, {
                          condition: { ...rule.condition, steps: parseInt(e.target.value, 10) || 1 },
                        })
                      }}
                      className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12">Reward:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rule.reward ?? 0}
                    onChange={(e) => {
                      updateRule(rule.id, { reward: parseFloat(e.target.value) || 0 })
                    }}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
                  />
                  <span
                    className={`text-xs font-mono w-16 text-right ${rule.reward >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {rule.reward >= 0 ? '+' : ''}
                    {rule.reward}
                  </span>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rule.shaping || false}
                    onChange={(e) => {
                      updateRule(rule.id, { shaping: e.target.checked })
                    }}
                    className="rounded"
                  />
                  <span>Reward shaping (dense reward signal)</span>
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {rules.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Total Rewards:</div>
            <div className="space-y-0.5">
              {rules.map((rule: any) => {
                const conditionLabel = getConditionLabel(rule.condition)
                const stepInfo = rule.condition?.type === 'timeout' && rule.condition?.steps
                  ? `After ${rule.condition.steps} steps`
                  : 'On trigger'
                return (
                  <div key={rule.id} className="flex justify-between">
                    <span>{conditionLabel} ({stepInfo}):</span>
                    <span
                      className={`font-mono ${rule.reward >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {rule.reward >= 0 ? '+' : ''}
                      {rule.reward}
                    </span>
                  </div>
                )
              })}
              <div className="pt-1 mt-1 border-t border-border">
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span className={`font-mono ${getTotalReward() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getTotalReward() >= 0 ? '+' : ''}
                    {getTotalReward().toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EpisodeMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const episode = envSpec?.episode || { maxSteps: 100, termination: [] }
  const curriculum = envSpec?.curriculum || { stages: [] }
  const [maxStepsInput, setMaxStepsInput] = useState<string>('')

  // Sync local state with envSpec when it changes externally
  useEffect(() => {
    if (episode?.maxSteps !== undefined) {
      setMaxStepsInput(String(episode.maxSteps))
    }
  }, [episode?.maxSteps])

  return (
    <div className="space-y-6">
      {/* Episode Configuration */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Episode Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Max Episode Length</label>
            <input
              type="number"
              min="1"
              max="10000"
              value={maxStepsInput || episode?.maxSteps || 100}
              onChange={(e) => {
                const inputValue = e.target.value
                setMaxStepsInput(inputValue) // Update local state immediately
                
                // Check if this is different from current value
                const currentMaxSteps = episode?.maxSteps || 100
                const newMaxSteps = parseInt(inputValue, 10)
                
                if (!isNaN(newMaxSteps) && newMaxSteps >= 1 && newMaxSteps <= 10000 && newMaxSteps !== currentMaxSteps) {
                  // Update immediately for real-time preview
                  onSpecChange({
                    ...envSpec,
                    episode: { ...episode, maxSteps: newMaxSteps },
                  })
                }
              }}
              onBlur={(e) => {
                // Validate and clamp on blur
                const maxSteps = parseInt(e.target.value, 10)
                if (isNaN(maxSteps) || maxSteps < 1 || maxSteps > 10000) {
                  const validMaxSteps = Math.max(1, Math.min(10000, maxSteps || 100))
                  setMaxStepsInput(String(validMaxSteps))
                  onSpecChange({
                    ...envSpec,
                    episode: { ...episode, maxSteps: validMaxSteps },
                  })
                }
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
              placeholder="100"
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum number of steps before episode times out (1-10000)</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Termination Conditions</label>
            <div className="space-y-1">
              {['goal', 'maxSteps', 'trap'].map((condition) => {
                const isActive = episode.termination?.some((t: any) => t.type === condition)
                return (
                  <label key={condition} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => {
                        const terminations = episode.termination || []
                        if (e.target.checked) {
                          onSpecChange({
                            ...envSpec,
                            episode: {
                              ...episode,
                              termination: [...terminations, { type: condition }],
                            },
                          })
                        } else {
                          onSpecChange({
                            ...envSpec,
                            episode: {
                              ...episode,
                              termination: terminations.filter((t: any) => t.type !== condition),
                            },
                          })
                        }
                      }}
                      className="rounded"
                    />
                    <span className="capitalize">
                      {condition.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Configuration */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Curriculum Stages</h3>
          <button
            onClick={() => {
              const newStage = {
                id: `stage_${Date.now()}`,
                name: `Stage ${curriculum.stages.length + 1}`,
                threshold:
                  curriculum.stages.length > 0
                    ? (curriculum.stages[curriculum.stages.length - 1]?.threshold || 0) + 10
                    : 10,
                envModifications: {},
              }
              onSpecChange({
                ...envSpec,
                curriculum: {
                  ...curriculum,
                  stages: [...(curriculum.stages || []), newStage],
                },
              })
            }}
            className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
          >
            + Add Stage
          </button>
        </div>

        {curriculum.stages && curriculum.stages.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {curriculum.stages.map((stage: any, index: number) => (
              <div key={stage.id} className="p-2 border border-border rounded bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => {
                      const newStages = [...curriculum.stages]
                      newStages[index] = { ...stage, name: e.target.value }
                      onSpecChange({
                        ...envSpec,
                        curriculum: { ...curriculum, stages: newStages },
                      })
                    }}
                    className="text-xs font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1"
                  />
                  <button
                    onClick={() => {
                      const newStages = curriculum.stages.filter((s: any) => s.id !== stage.id)
                      onSpecChange({
                        ...envSpec,
                        curriculum: { ...curriculum, stages: newStages },
                      })
                    }}
                    className="text-xs text-red-600 hover:text-red-800 ml-2"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground w-20">Threshold:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={stage.threshold || 0}
                      onChange={(e) => {
                        const newStages = [...curriculum.stages]
                        newStages[index] = { ...stage, threshold: parseFloat(e.target.value) || 0 }
                        onSpecChange({
                          ...envSpec,
                          curriculum: { ...curriculum, stages: newStages },
                        })
                      }}
                      className="flex-1 px-2 py-1 border border-border rounded text-xs"
                      placeholder="Avg reward threshold"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Progress to this stage when average reward ≥ {stage.threshold}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground p-4 text-center border border-border rounded">
            No curriculum stages. Add stages to gradually increase difficulty.
          </div>
        )}

        {curriculum.stages && curriculum.stages.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <div className="font-medium mb-1">Curriculum Flow:</div>
              <div className="space-y-0.5">
                {curriculum.stages.map((stage: any, i: number) => (
                  <div key={stage.id}>
                    {i === 0
                      ? 'Start'
                      : `After ${curriculum.stages[i - 1]?.name || 'previous stage'}`}{' '}
                    → {stage.name} (threshold: {stage.threshold})
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const [code, setCode] = useState(JSON.stringify(envSpec, null, 2))
  const [error, setError] = useState<string | null>(null)

  // Sync code when envSpec changes externally
  useEffect(() => {
    setCode(JSON.stringify(envSpec, null, 2))
    setError(null)
  }, [envSpec])

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value
    setCode(newCode)

    try {
      const parsed = JSON.parse(newCode)
      onSpecChange(parsed)
      setError(null)
    } catch (err: any) {
      setError(`Invalid JSON: ${err.message}`)
    }
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(code)
      const formatted = JSON.stringify(parsed, null, 2)
      setCode(formatted)
      onSpecChange(parsed)
      setError(null)
    } catch (err: any) {
      setError(`Cannot format: ${err.message}`)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">EnvSpec JSON</label>
        <button
          onClick={handleFormat}
          className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
        >
          Format
        </button>
      </div>
      <textarea
        value={code}
        onChange={handleCodeChange}
        className="w-full h-96 px-3 py-2 border border-border rounded-md font-mono text-xs bg-muted/20 resize-none"
        spellCheck="false"
        style={{ fontFamily: 'monospace' }}
      />
      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {error}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Edit the JSON directly. Changes sync to visual editor automatically.
      </div>
    </div>
  )
}

