// Rule Editor - Universal rule builder using ConditionSpec
import { useState } from 'react'
import {
  EnvSpec,
  ConditionSpec,
  RewardRule,
  TerminationRule,
  EventRule,
  ObjectType,
} from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { InlineCodeReviewer } from './InlineCodeReviewer'

interface RuleEditorProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
}

type RuleTab = 'rewards' | 'terminations' | 'events'

export function RuleEditor({ envSpec, sceneGraph, onSpecChange }: RuleEditorProps) {
  const [activeTab, setActiveTab] = useState<RuleTab>('rewards')

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['rewards', 'terminations', 'events'] as RuleTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'rewards' && (
          <RewardRulesEditor
            envSpec={envSpec}
            sceneGraph={sceneGraph}
            onSpecChange={onSpecChange}
          />
        )}
        {activeTab === 'terminations' && (
          <TerminationRulesEditor
            envSpec={envSpec}
            sceneGraph={sceneGraph}
            onSpecChange={onSpecChange}
          />
        )}
        {activeTab === 'events' && (
          <EventRulesEditor envSpec={envSpec} sceneGraph={sceneGraph} onSpecChange={onSpecChange} />
        )}
      </div>
    </div>
  )
}

function RewardRulesEditor({ envSpec, sceneGraph, onSpecChange }: RuleEditorProps) {
  const rules = envSpec.rules.rewards || []

  const addRule = () => {
    const newRule: RewardRule = {
      id: `reward_${Date.now()}`,
      condition: { type: 'timeout', steps: 1 },
      reward: 0,
      shaping: false,
    }
    const newRules = [...rules, newRule]
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, rewards: newRules },
    })
  }

  const removeRule = (ruleId: string) => {
    const newRules = rules.filter((r) => r.id !== ruleId)
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, rewards: newRules },
    })
  }

  const updateRule = (ruleId: string, updates: Partial<RewardRule>) => {
    const newRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, rewards: newRules },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Reward Rules</h3>
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
            No reward rules. Click "Add Rule" to create one.
          </div>
        ) : (
          rules.map((rule) => (
            <RewardRuleCard
              key={rule.id}
              rule={rule}
              envSpec={envSpec}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onRemove={() => removeRule(rule.id)}
            />
          ))
        )}
      </div>

      {rules.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Total Rewards:</div>
            <div className="space-y-0.5">
              {rules.map((rule) => {
                const stepInfo = rule.condition?.type === 'timeout' && (rule.condition as any)?.steps
                  ? `After ${(rule.condition as any).steps} steps`
                  : 'On trigger'
                return (
                  <div key={rule.id} className="flex justify-between">
                    <span>{stepInfo}:</span>
                    <span
                      className={`font-mono ${rule.reward >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {rule.reward >= 0 ? '+' : ''}
                      {rule.reward}
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

function TerminationRulesEditor({ envSpec, sceneGraph, onSpecChange }: RuleEditorProps) {
  const rules = envSpec.rules.terminations || []

  const addRule = () => {
    const newRule: TerminationRule = {
      id: `termination_${Date.now()}`,
      condition: { type: 'timeout', steps: 100 },
    }
    const newRules = [...rules, newRule]
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, terminations: newRules },
    })
  }

  const removeRule = (ruleId: string) => {
    const newRules = rules.filter((r) => r.id !== ruleId)
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, terminations: newRules },
    })
  }

  const updateRule = (ruleId: string, updates: Partial<TerminationRule>) => {
    const newRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, terminations: newRules },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Termination Conditions</h3>
        <button
          onClick={addRule}
          className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          + Add Condition
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 text-center border border-border rounded">
            No termination conditions. Episodes will run until max steps.
          </div>
        ) : (
          rules.map((rule) => (
            <TerminationRuleCard
              key={rule.id}
              rule={rule}
              envSpec={envSpec}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onRemove={() => removeRule(rule.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function EventRulesEditor({ envSpec, sceneGraph, onSpecChange }: RuleEditorProps) {
  const rules = envSpec.rules.events || []

  const addRule = () => {
    const newRule: EventRule = {
      id: `event_${Date.now()}`,
      condition: { type: 'timeout', steps: 1 },
      action: 'spawn_object',
      params: {},
    }
    const newRules = [...rules, newRule]
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, events: newRules },
    })
  }

  const removeRule = (ruleId: string) => {
    const newRules = rules.filter((r) => r.id !== ruleId)
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, events: newRules },
    })
  }

  const updateRule = (ruleId: string, updates: Partial<EventRule>) => {
    const newRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    onSpecChange({
      ...envSpec,
      rules: { ...envSpec.rules, events: newRules },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Event Rules</h3>
        <button
          onClick={addRule}
          className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          + Add Event
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 text-center border border-border rounded">
            No event rules defined.
          </div>
        ) : (
          rules.map((rule) => (
            <EventRuleCard
              key={rule.id}
              rule={rule}
              envSpec={envSpec}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onRemove={() => removeRule(rule.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RewardRuleCard({
  rule,
  envSpec,
  onUpdate,
  onRemove,
}: {
  rule: RewardRule
  envSpec: EnvSpec
  onUpdate: (updates: Partial<RewardRule>) => void
  onRemove: () => void
}) {
  const getConditionLabel = (condition: ConditionSpec) => {
    if (!condition) return 'Unknown'
    if (condition.type === 'timeout') return 'Timeout (Steps)'
    if (condition.type === 'reach_goal') return 'Goal Reached'
    if (condition.type === 'hit_trap') return 'Trap Hit'
    if (condition.type === 'step') return 'Per Step'
    if (condition.type === 'collect_key') return 'Key Collected'
    return condition.type || 'Custom'
  }

  return (
    <div className="p-3 border border-border rounded bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium">Reward Rule</span>
        <button onClick={onRemove} className="text-xs text-red-600 hover:text-red-800">
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
              let newCondition: ConditionSpec = { type: conditionType as any }
              
              // Set default steps for timeout
              if (conditionType === 'timeout') {
                newCondition = { type: 'timeout', steps: (rule.condition as any)?.steps || 1 }
              }
              
              onUpdate({ condition: newCondition })
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
              value={(rule.condition as any)?.steps || 1}
              onChange={(e) => {
                onUpdate({
                  condition: {
                    type: 'timeout',
                    steps: parseInt(e.target.value, 10) || 1,
                  } as ConditionSpec,
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
            value={rule.reward}
            onChange={(e) => onUpdate({ reward: parseFloat(e.target.value) || 0 })}
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
            onChange={(e) => onUpdate({ shaping: e.target.checked })}
            className="rounded"
          />
          <span>Reward shaping (dense reward signal)</span>
        </label>
      </div>
    </div>
  )
}

function TerminationRuleCard({
  rule,
  envSpec,
  onUpdate,
  onRemove,
}: {
  rule: TerminationRule
  envSpec: EnvSpec
  onUpdate: (updates: Partial<TerminationRule>) => void
  onRemove: () => void
}) {
  const getConditionLabel = (condition: ConditionSpec) => {
    if (!condition) return 'Unknown'
    if (condition.type === 'timeout') return 'Timeout (Steps)'
    if (condition.type === 'reach_goal') return 'Goal Reached'
    if (condition.type === 'hit_trap') return 'Trap Hit'
    if (condition.type === 'agent_at_object') return 'Agent at Object'
    if (condition.type === 'collision') return 'Collision'
    return condition.type || 'Custom'
  }

  return (
    <div className="p-3 border border-border rounded bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium">Termination Condition</span>
        <button onClick={onRemove} className="text-xs text-red-600 hover:text-red-800">
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
              let newCondition: ConditionSpec = { type: conditionType as any }
              
              // Set default steps for timeout
              if (conditionType === 'timeout') {
                newCondition = { type: 'timeout', steps: (rule.condition as any)?.steps || 1 }
              }
              
              onUpdate({ condition: newCondition })
            }}
            className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
          >
            <option value="timeout">Timeout (Steps)</option>
            <option value="reach_goal">Goal Reached</option>
            <option value="hit_trap">Trap Hit</option>
            <option value="agent_at_object">Agent at Object</option>
            <option value="collision">Collision</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        {rule.condition?.type === 'timeout' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-12">Steps:</label>
            <input
              type="number"
              min="1"
              value={(rule.condition as any)?.steps || 1}
              onChange={(e) => {
                onUpdate({
                  condition: {
                    type: 'timeout',
                    steps: parseInt(e.target.value, 10) || 1,
                  } as ConditionSpec,
                })
              }}
              className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function EventRuleCard({
  rule,
  envSpec,
  onUpdate,
  onRemove,
}: {
  rule: EventRule
  envSpec: EnvSpec
  onUpdate: (updates: Partial<EventRule>) => void
  onRemove: () => void
}) {
  const getConditionLabel = (condition: ConditionSpec) => {
    if (!condition) return 'Unknown'
    if (condition.type === 'timeout') return 'Timeout (Steps)'
    if (condition.type === 'reach_goal') return 'Goal Reached'
    if (condition.type === 'hit_trap') return 'Trap Hit'
    if (condition.type === 'agent_at_object') return 'Agent at Object'
    if (condition.type === 'collision') return 'Collision'
    return condition.type || 'Custom'
  }

  return (
    <div className="p-3 border border-border rounded bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium">Event Rule</span>
        <button onClick={onRemove} className="text-xs text-red-600 hover:text-red-800">
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
              let newCondition: ConditionSpec = { type: conditionType as any }
              
              // Set default steps for timeout
              if (conditionType === 'timeout') {
                newCondition = { type: 'timeout', steps: (rule.condition as any)?.steps || 1 }
              }
              
              onUpdate({ condition: newCondition })
            }}
            className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
          >
            <option value="timeout">Timeout (Steps)</option>
            <option value="reach_goal">Goal Reached</option>
            <option value="hit_trap">Trap Hit</option>
            <option value="agent_at_object">Agent at Object</option>
            <option value="collision">Collision</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        
        {rule.condition?.type === 'timeout' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-12">Steps:</label>
            <input
              type="number"
              min="1"
              value={(rule.condition as any)?.steps || 1}
              onChange={(e) => {
                onUpdate({
                  condition: {
                    type: 'timeout',
                    steps: parseInt(e.target.value, 10) || 1,
                  } as ConditionSpec,
                })
              }}
              className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground w-12">Action:</label>
          <select
            value={rule.action}
            onChange={(e) => onUpdate({ action: e.target.value })}
            className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
          >
            <option value="spawn_object">Spawn Object</option>
            <option value="modify_property">Modify Property</option>
            <option value="remove_object">Remove Object</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function ConditionBuilder({
  condition,
  envSpec,
  onChange,
  scriptType,
}: {
  condition: ConditionSpec
  envSpec: EnvSpec
  onChange: (condition: ConditionSpec) => void
  scriptType?: 'reward' | 'termination' | 'custom'
}) {
  const conditionType = condition.type

  // Safety: Ensure envSpec has valid arrays and filter out any invalid items
  const safeAgents = Array.isArray(envSpec?.agents)
    ? envSpec.agents.filter((a) => {
        if (!a || typeof a !== 'object' || Array.isArray(a)) return false
        if (!a.id || typeof a.id !== 'string') return false
        return true
      })
    : []
  const safeObjects = Array.isArray(envSpec?.objects)
    ? envSpec.objects.filter((o) => {
        if (!o || typeof o !== 'object' || Array.isArray(o)) return false
        if (!o.id || typeof o.id !== 'string') return false
        return true
      })
    : []

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground w-20">IF:</label>
        <select
          value={conditionType}
          onChange={(e) => {
            const newType = e.target.value as ConditionSpec['type']
            // Create default condition based on type
            let newCondition: ConditionSpec
            switch (newType) {
              case 'agent_at_position':
                newCondition = {
                  type: 'agent_at_position',
                  agentId:
                    Array.isArray(envSpec.agents) && envSpec.agents[0]?.id
                      ? String(envSpec.agents[0].id)
                      : '',
                  position: [0, 0],
                  tolerance: 0.5,
                }
                break
              case 'agent_at_object':
                newCondition = {
                  type: 'agent_at_object',
                  agentId:
                    Array.isArray(envSpec.agents) && envSpec.agents[0]?.id
                      ? String(envSpec.agents[0].id)
                      : '',
                  objectId:
                    Array.isArray(envSpec.objects) && envSpec.objects[0]?.id
                      ? String(envSpec.objects[0].id)
                      : '',
                }
                break
              case 'collision':
                newCondition = {
                  type: 'collision',
                  a:
                    Array.isArray(envSpec.agents) && envSpec.agents[0]?.id
                      ? String(envSpec.agents[0].id)
                      : '',
                  b:
                    Array.isArray(envSpec.objects) && envSpec.objects[0]?.id
                      ? String(envSpec.objects[0].id)
                      : '',
                }
                break
              case 'timeout':
                newCondition = { type: 'timeout', steps: 100 }
                break
              case 'inside_region':
                const regionObj = Array.isArray(envSpec.objects)
                  ? envSpec.objects.find((o) => o && o.type === 'region')
                  : null
                newCondition = {
                  type: 'inside_region',
                  agentId:
                    Array.isArray(envSpec.agents) && envSpec.agents[0]?.id
                      ? String(envSpec.agents[0].id)
                      : '',
                  regionId: regionObj?.id ? String(regionObj.id) : '',
                }
                break
              case 'custom':
                newCondition = { type: 'custom', script: '' }
                break
              default:
                newCondition = { type: 'timeout', steps: 100 }
            }
            onChange(newCondition)
          }}
          className="flex-1 px-2 py-1 border border-border rounded text-xs"
        >
          <option value="agent_at_position">Agent at Position</option>
          <option value="agent_at_object">Agent at Object</option>
          <option value="collision">Collision</option>
          <option value="timeout">Timeout (Steps)</option>
          <option value="inside_region">Inside Region</option>
          <option value="custom">Custom Script</option>
        </select>
      </div>

      {/* Condition-specific fields */}
      {conditionType === 'agent_at_position' && (
        <div className="space-y-1 pl-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Agent:</label>
            <select
              value={condition.agentId || ''}
              onChange={(e) => onChange({ ...condition, agentId: e.target.value } as ConditionSpec)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {safeAgents
                .filter((a) => a && a.id && typeof a.id === 'string')
                .map((a) => {
                  const agentName = a?.name
                    ? typeof a.name === 'string'
                      ? a.name
                      : String(a.name || 'Unknown Agent')
                    : 'Unknown Agent'
                  const agentId = a?.id
                    ? typeof a.id === 'string'
                      ? a.id
                      : String(a.id || '')
                    : ''
                  return (
                    <option key={agentId} value={agentId}>
                      {String(agentName)}
                    </option>
                  )
                })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Position:</label>
            <input
              type="number"
              step="0.1"
              value={condition.position?.[0] || 0}
              onChange={(e) =>
                onChange({
                  ...condition,
                  position: [parseFloat(e.target.value) || 0, condition.position?.[1] || 0],
                } as ConditionSpec)
              }
              className="w-20 px-2 py-1 border border-border rounded text-xs"
              placeholder="X"
            />
            <input
              type="number"
              step="0.1"
              value={condition.position?.[1] || 0}
              onChange={(e) =>
                onChange({
                  ...condition,
                  position: [condition.position?.[0] || 0, parseFloat(e.target.value) || 0],
                } as ConditionSpec)
              }
              className="w-20 px-2 py-1 border border-border rounded text-xs"
              placeholder="Y"
            />
          </div>
        </div>
      )}

      {conditionType === 'agent_at_object' && (
        <div className="space-y-1 pl-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Agent:</label>
            <select
              value={condition.agentId || ''}
              onChange={(e) => onChange({ ...condition, agentId: e.target.value } as ConditionSpec)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {safeAgents
                .filter((a) => a && a.id && typeof a.id === 'string')
                .map((a) => {
                  const agentName = a?.name
                    ? typeof a.name === 'string'
                      ? a.name
                      : String(a.name || 'Unknown Agent')
                    : 'Unknown Agent'
                  const agentId = a?.id
                    ? typeof a.id === 'string'
                      ? a.id
                      : String(a.id || '')
                    : ''
                  return (
                    <option key={agentId} value={agentId}>
                      {String(agentName)}
                    </option>
                  )
                })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Object:</label>
            <select
              value={condition.objectId || ''}
              onChange={(e) =>
                onChange({ ...condition, objectId: e.target.value } as ConditionSpec)
              }
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {safeObjects
                .filter((o) => o && o.id && typeof o.id === 'string')
                .map((o) => {
                  const objectType = o?.type
                    ? typeof o.type === 'string'
                      ? o.type
                      : String(o.type || 'object')
                    : 'object'
                  const objectId = o?.id
                    ? typeof o.id === 'string'
                      ? o.id
                      : String(o.id || '')
                    : ''
                  const shortId = objectId ? objectId.slice(0, 8) : 'unknown'
                  return (
                    <option key={objectId} value={objectId}>
                      {String(objectType)} ({String(shortId)})
                    </option>
                  )
                })}
            </select>
          </div>
        </div>
      )}

      {conditionType === 'collision' && (
        <div className="space-y-1 pl-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Object A:</label>
            <select
              value={condition.a || ''}
              onChange={(e) => onChange({ ...condition, a: e.target.value } as ConditionSpec)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {[...safeAgents, ...safeObjects]
                .filter((item) => {
                  // Only include valid items with string IDs
                  if (!item || !item.id) return false
                  if (typeof item.id !== 'string') return false
                  return true
                })
                .map((item) => {
                  // Ensure we always get a string, never an object
                  let displayName = 'Unknown'
                  if ('name' in item && item.name) {
                    displayName =
                      typeof item.name === 'string' ? item.name : String(item.name || 'Unknown')
                  } else if ('type' in item && item.type) {
                    displayName =
                      typeof item.type === 'string' ? item.type : String(item.type || 'Unknown')
                  }
                  const itemId = typeof item.id === 'string' ? item.id : String(item.id || '')
                  const shortId = itemId ? itemId.slice(0, 8) : 'unknown'
                  return (
                    <option key={itemId} value={itemId}>
                      {String(displayName)} ({String(shortId)})
                    </option>
                  )
                })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Object B:</label>
            <select
              value={condition.b || ''}
              onChange={(e) => onChange({ ...condition, b: e.target.value } as ConditionSpec)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {[...safeAgents, ...safeObjects]
                .filter((item) => {
                  // Only include valid items with string IDs
                  if (!item || !item.id) return false
                  if (typeof item.id !== 'string') return false
                  return true
                })
                .map((item) => {
                  // Ensure we always get a string, never an object
                  let displayName = 'Unknown'
                  if ('name' in item && item.name) {
                    displayName =
                      typeof item.name === 'string' ? item.name : String(item.name || 'Unknown')
                  } else if ('type' in item && item.type) {
                    displayName =
                      typeof item.type === 'string' ? item.type : String(item.type || 'Unknown')
                  }
                  const itemId = typeof item.id === 'string' ? item.id : String(item.id || '')
                  const shortId = itemId ? itemId.slice(0, 8) : 'unknown'
                  return (
                    <option key={itemId} value={itemId}>
                      {String(displayName)} ({String(shortId)})
                    </option>
                  )
                })}
            </select>
          </div>
        </div>
      )}

      {conditionType === 'timeout' && (
        <div className="flex items-center gap-2 pl-6">
          <label className="text-xs text-muted-foreground w-16">Steps:</label>
          <input
            type="number"
            value={condition.steps || 100}
            onChange={(e) =>
              onChange({ ...condition, steps: parseInt(e.target.value) || 100 } as ConditionSpec)
            }
            className="flex-1 px-2 py-1 border border-border rounded text-xs"
          />
        </div>
      )}

      {conditionType === 'inside_region' && (
        <div className="space-y-1 pl-6">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Agent:</label>
            <select
              value={condition.agentId || ''}
              onChange={(e) => onChange({ ...condition, agentId: e.target.value } as ConditionSpec)}
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {safeAgents
                .filter((a) => a && a.id && typeof a.id === 'string')
                .map((a) => {
                  const agentName = a?.name
                    ? typeof a.name === 'string'
                      ? a.name
                      : String(a.name || 'Unknown Agent')
                    : 'Unknown Agent'
                  const agentId = a?.id
                    ? typeof a.id === 'string'
                      ? a.id
                      : String(a.id || '')
                    : ''
                  return (
                    <option key={agentId} value={agentId}>
                      {String(agentName)}
                    </option>
                  )
                })}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-16">Region:</label>
            <select
              value={condition.regionId || ''}
              onChange={(e) =>
                onChange({ ...condition, regionId: e.target.value } as ConditionSpec)
              }
              className="flex-1 px-2 py-1 border border-border rounded text-xs"
            >
              {safeObjects
                .filter((o) => o && o.id && typeof o.id === 'string' && o.type === 'region')
                .map((o) => {
                  const regionId = o?.id
                    ? typeof o.id === 'string'
                      ? o.id
                      : String(o.id || '')
                    : ''
                  const shortId = regionId ? regionId.slice(0, 8) : 'unknown'
                  return (
                    <option key={regionId} value={regionId}>
                      Region ({String(shortId)})
                    </option>
                  )
                })}
            </select>
          </div>
        </div>
      )}

      {conditionType === 'custom' && (
        <div className="pl-6 space-y-2">
          <textarea
            value={condition.script || ''}
            onChange={(e) => onChange({ ...condition, script: e.target.value } as ConditionSpec)}
            className="w-full px-2 py-1 border border-border rounded text-xs font-mono h-20"
            placeholder="Python script: return reward_value"
          />
          {scriptType && (
            <InlineCodeReviewer script={condition.script || ''} scriptType={scriptType} />
          )}
        </div>
      )}
    </div>
  )
}

function formatCondition(condition: ConditionSpec): string {
  switch (condition.type) {
    case 'agent_at_position':
      return `Agent at (${condition.position?.[0]}, ${condition.position?.[1]})`
    case 'agent_at_object':
      return `Agent at object`
    case 'collision':
      return `Collision`
    case 'timeout':
      return `After ${condition.steps} steps`
    case 'inside_region':
      return `Agent inside region`
    case 'custom':
      return `Custom: ${condition.script?.slice(0, 30) || '...'}`
    default:
      return 'Unknown condition'
  }
}
