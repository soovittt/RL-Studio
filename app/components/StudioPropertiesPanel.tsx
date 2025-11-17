import { useState, useEffect } from 'react'
import { EnvSpec, GeometrySpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { RuleEditor } from './RuleEditor'
import { GeometryEditor } from './GeometryEditor'

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
  const [showGeometryEditor, setShowGeometryEditor] = useState(false)

  // Listen for geometry editor open event
  useEffect(() => {
    const handleOpenGeometryEditor = () => {
      setShowGeometryEditor(true)
    }
    window.addEventListener('openGeometryEditor' as any, handleOpenGeometryEditor)
    return () => {
      window.removeEventListener('openGeometryEditor' as any, handleOpenGeometryEditor)
    }
  }, [])

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

        {mode === 'actions' && (
          <ActionsMode
            envSpec={envSpec}
            onSpecChange={onSpecChange}
          />
        )}

        {mode === 'rewards' && sceneGraph ? (
          <RuleEditor
            envSpec={envSpec}
            sceneGraph={sceneGraph}
            onSpecChange={onSpecChange}
          />
        ) : mode === 'rewards' ? (
          <div className="text-xs text-muted-foreground p-4">
            Rule editor requires scene graph. Please refresh the page.
          </div>
        ) : null}

        {mode === 'episode' && (
          <EpisodeMode
            envSpec={envSpec}
            onSpecChange={onSpecChange}
          />
        )}

        {mode === 'code' && (
          <CodeMode
            envSpec={envSpec}
            onSpecChange={onSpecChange}
          />
        )}
      </div>

      {/* Geometry Editor Modal */}
      {showGeometryEditor && (
        <GeometryEditor
          envSpec={envSpec}
          onGeometryChange={(geometry: GeometrySpec) => {
            onSpecChange({
              ...envSpec,
              world: {
                ...envSpec.world,
                geometry,
              },
            })
          }}
          onClose={() => setShowGeometryEditor(false)}
        />
      )}
    </div>
  )
}

function StructureMode({ envSpec, onSpecChange, selectedObjectId }: StudioPropertiesPanelProps) {
  const envType = envSpec?.envType || envSpec?.type || 'grid'

  if (envType === 'grid') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Grid Size</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={envSpec?.stateSpace?.shape?.[0] || 10}
              onChange={(e) => {
                const width = parseInt(e.target.value) || 10
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    shape: [width, envSpec?.stateSpace?.shape?.[1] || 10],
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Width"
            />
            <input
              type="number"
              value={envSpec?.stateSpace?.shape?.[1] || 10}
              onChange={(e) => {
                const height = parseInt(e.target.value) || 10
                onSpecChange({
                  ...envSpec,
                  stateSpace: {
                    ...envSpec?.stateSpace,
                    shape: [envSpec?.stateSpace?.shape?.[0] || 10, height],
                  },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-sm"
              placeholder="Height"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cell Types</label>
          <div className="text-xs text-muted-foreground">
            Click cells in the canvas to place objects
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Custom Geometry</label>
          <button
            onClick={() => {
              const event = new CustomEvent('openGeometryEditor')
              window.dispatchEvent(event)
            }}
            className="w-full px-3 py-2 text-sm border border-border rounded hover:bg-muted"
          >
            Edit Geometry (Polyline Drawing)
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            Define custom walkable/non-walkable regions
          </p>
        </div>
      </div>
    )
  }

  if (envType === 'continuous2d') {
    const bounds = envSpec?.stateSpace?.bounds || [[-10, 10], [-10, 10]]
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

        <div>
          <label className="block text-sm font-medium mb-2">Custom Geometry</label>
          <button
            onClick={() => {
              const event = new CustomEvent('openGeometryEditor')
              window.dispatchEvent(event)
            }}
            className="w-full px-3 py-2 text-sm border border-border rounded hover:bg-muted"
          >
            Edit Geometry (Polyline Drawing)
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            Define custom walkable/non-walkable regions
          </p>
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
    <div className="text-sm text-muted-foreground">
      Structure mode for {envType} coming soon
    </div>
  )
}

function ActionsMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const actionSpace = envSpec?.actionSpace || { type: 'discrete', actions: ['up', 'down', 'left', 'right'] }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Action Space Type</label>
        <select
          value={actionSpace.type || 'discrete'}
          onChange={(e) => {
            onSpecChange({
              ...envSpec,
              actionSpace: {
                type: e.target.value,
                actions: e.target.value === 'discrete' ? ['up', 'down', 'left', 'right'] : undefined,
                bounds: e.target.value === 'continuous' ? [[-1, 1], [-1, 1]] : undefined,
              },
            })
          }}
          className="w-full px-2 py-1 border border-border rounded text-sm"
        >
          <option value="discrete">Discrete</option>
          <option value="continuous">Continuous</option>
        </select>
      </div>

      {actionSpace.type === 'discrete' && (
        <div>
          <label className="block text-sm font-medium mb-2">Actions</label>
          <div className="space-y-1">
            {actionSpace.actions?.map((action: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => {
                    const newActions = [...(actionSpace.actions || [])]
                    newActions[i] = e.target.value
                    onSpecChange({
                      ...envSpec,
                      actionSpace: { ...actionSpace, actions: newActions },
                    })
                  }}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RewardsMode({ envSpec, onSpecChange }: StudioPropertiesPanelProps) {
  const reward = envSpec?.reward || { rules: [] }

  const commonConditions = [
    { type: 'goal', label: 'Goal Reached', default: 10 },
    { type: 'trap', label: 'Trap Hit', default: -10 },
    { type: 'step', label: 'Per Step', default: -0.1 },
    { type: 'key', label: 'Key Collected', default: 1 },
  ]

  const addRule = (conditionType: string, defaultValue: number) => {
    onSpecChange({
      ...envSpec,
      reward: {
        ...reward,
        rules: [
          ...(reward.rules || []),
          { condition: { type: conditionType }, value: defaultValue },
        ],
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Reward Rules</label>
        <div className="flex gap-1">
          {commonConditions.map((cond) => (
            <button
              key={cond.type}
              onClick={() => addRule(cond.type, cond.default)}
              className="text-xs px-2 py-1 border border-border rounded hover:bg-muted"
              title={cond.label}
            >
              + {cond.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {reward.rules?.map((rule: any, i: number) => {
          const conditionLabel = commonConditions.find((c) => c.type === rule.condition?.type)?.label || rule.condition?.type || 'unknown'
          
          return (
            <div key={i} className="p-2 border border-border rounded bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{conditionLabel}</span>
                <button
                  onClick={() => {
                    const newRules = [...(reward.rules || [])]
                    newRules.splice(i, 1)
                    onSpecChange({
                      ...envSpec,
                      reward: { ...reward, rules: newRules },
                    })
                  }}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  ×
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-16">Condition:</label>
                  <select
                    value={rule.condition?.type || ''}
                    onChange={(e) => {
                      const newRules = [...(reward.rules || [])]
                      const defaultVal = commonConditions.find((c) => c.type === e.target.value)?.default || 0
                      newRules[i] = {
                        ...rule,
                        condition: { type: e.target.value },
                        value: defaultVal,
                      }
                      onSpecChange({
                        ...envSpec,
                        reward: { ...reward, rules: newRules },
                      })
                    }}
                    className="flex-1 px-2 py-1 border border-border rounded text-xs"
                  >
                    <option value="">Select condition...</option>
                    {commonConditions.map((cond) => (
                      <option key={cond.type} value={cond.type}>
                        {cond.label}
                      </option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-16">Value:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={rule.value ?? 0}
                    onChange={(e) => {
                      const newRules = [...(reward.rules || [])]
                      newRules[i] = { ...rule, value: parseFloat(e.target.value) || 0 }
                      onSpecChange({
                        ...envSpec,
                        reward: { ...reward, rules: newRules },
                      })
                    }}
                    className="flex-1 px-2 py-1 border border-border rounded text-xs"
                  />
                  <span className={`text-xs font-mono w-12 text-right ${rule.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rule.value >= 0 ? '+' : ''}{rule.value}
                  </span>
                </div>
              </div>
            </div>
          )
        }) || (
          <div className="text-xs text-muted-foreground p-4 text-center">
            No reward rules defined. Click buttons above to add rules.
          </div>
        )}
      </div>

      {reward.rules && reward.rules.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Reward Summary:</div>
            <div className="space-y-0.5">
              {reward.rules.map((rule: any, i: number) => {
                const conditionLabel = commonConditions.find((c) => c.type === rule.condition?.type)?.label || rule.condition?.type || 'unknown'
                return (
                  <div key={i} className="flex justify-between">
                    <span>{conditionLabel}:</span>
                    <span className={`font-mono ${rule.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {rule.value >= 0 ? '+' : ''}{rule.value}
                    </span>
                  </div>
                )
              })}
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
              value={episode.maxSteps || 100}
              onChange={(e) => {
                onSpecChange({
                  ...envSpec,
                  episode: { ...episode, maxSteps: parseInt(e.target.value) || 100 },
                })
              }}
              className="w-full px-2 py-1 border border-border rounded text-xs"
            />
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
                    <span className="capitalize">{condition.replace(/([A-Z])/g, ' $1').trim()}</span>
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
                threshold: curriculum.stages.length > 0 
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
                    {i === 0 ? 'Start' : `After ${curriculum.stages[i - 1]?.name || 'previous stage'}`} → {stage.name} (threshold: {stage.threshold})
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

