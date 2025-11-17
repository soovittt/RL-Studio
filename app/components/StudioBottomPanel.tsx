import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvSpec, Vec2 } from '~/lib/envSpec'
import { runUniversalRollout, type SimulatorResult } from '~/lib/universalSimulator'
import { runRolloutHTTP, checkRolloutServiceHealth } from '~/lib/rolloutClient'
import { useAuth } from '~/lib/auth'
import { CodeViewTab } from './CodeViewTab'
import { RewardDecompositionHeatmap } from './RewardDecompositionHeatmap'
import { TrajectoryPathVisualizer } from './TrajectoryPathVisualizer'
import { TerminationAnalysisChart } from './TerminationAnalysisChart'
import { PolicyEntropyChart } from './PolicyEntropyChart'

type BottomPanelTab = 'rollout' | 'rewards' | 'events' | 'history' | 'code' | 'analysis'

interface StudioBottomPanelProps {
  envSpec: EnvSpec
  envId?: string
  onRunRollout?: () => void
  onStepChange?: (stepState: { agents: Array<{ id: string; position: Vec2 }> } | null) => void
}

export function StudioBottomPanel({ envSpec, envId, onRunRollout, onStepChange }: StudioBottomPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<BottomPanelTab>('rollout')
  const [rolloutResult, setRolloutResult] = useState<SimulatorResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [policy, setPolicy] = useState<'random' | 'greedy'>('random')
  const [maxSteps, setMaxSteps] = useState<number>(() => {
    // Get maxSteps from timeout rule or default to 100
    const timeoutRule = envSpec?.rules?.terminations?.find((r) => r.condition.type === 'timeout')
    return timeoutRule?.condition.steps || 100
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(500) // ms per step
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  const saveRolloutMutation = useMutation(api.rolloutHistory.create)
  const rolloutHistory = useQuery(
    api.rolloutHistory.list,
    envId && envId !== 'new' ? { envId: envId as any, limit: 50 } : 'skip'
  )

  const tabs: { id: BottomPanelTab; label: string }[] = [
    { id: 'rollout', label: 'Rollout Preview' },
    { id: 'rewards', label: 'Reward Inspector' },
    { id: 'events', label: 'Event Log' },
    { id: 'history', label: 'History' },
    { id: 'code', label: 'Code View' },
    { id: 'analysis', label: 'RL Analysis' },
  ]

      const handleRunRollout = useCallback(async () => {
        if (!envSpec) {
          alert('❌ No environment specification found')
          return
        }

        // Validate environment using the validation function
        const { validateEnvSpec } = await import('~/lib/universalSimulator')
        const validation = validateEnvSpec(envSpec)
        if (!validation.valid) {
          alert(`❌ Invalid environment: ${validation.error}\n\nPlease fix the environment before running rollout.`)
          return
        }

        // Check if goals exist for greedy policy
        const goals = envSpec.objects?.filter((o) => o?.type === 'goal') || []
        if (policy === 'greedy' && goals.length === 0) {
          alert('⚠️ Greedy policy requires at least one goal object. Please add a goal to your environment.')
          return
        }
    
    console.log('🚀 Running rollout:', {
      policy,
      agentCount: envSpec.agents.length,
      goalCount: goals.length,
      agentPos: envSpec.agents[0]?.position,
      goalPos: goals[0]?.position,
      actionSpace: envSpec.actionSpace,
      objects: envSpec.objects?.length || 0,
    })

    setIsRunning(true)
    setCurrentStepIndex(0)
    setRolloutResult(null) // Clear previous result

    try {
      // Priority: user input > timeout rule > default
      // User's maxSteps input should take precedence over environment timeout rule
      // IMPORTANT: Read maxSteps from the input field directly to avoid stale closure
      const currentMaxStepsInput = document.getElementById('maxSteps') as HTMLInputElement
      const userInputValue = currentMaxStepsInput ? parseInt(currentMaxStepsInput.value, 10) : null
      const timeoutRuleSteps = envSpec.rules?.terminations?.find((r) => r.condition.type === 'timeout')?.condition.steps
      
      // Use the actual input value if valid, otherwise fall back to state, then timeout rule, then default
      const effectiveMaxSteps = (userInputValue && !isNaN(userInputValue) && userInputValue > 0 && userInputValue <= 10000) 
        ? userInputValue 
        : (maxSteps && maxSteps > 0 ? maxSteps : (timeoutRuleSteps || 100))
      
      // Update state if input value is different (to keep in sync)
      if (userInputValue && userInputValue !== maxSteps && !isNaN(userInputValue) && userInputValue > 0 && userInputValue <= 10000) {
        setMaxSteps(userInputValue)
      }
      
      console.log('📊 Rollout config:', { 
        inputFieldValue: userInputValue,
        stateMaxSteps: maxSteps, 
        timeoutRuleSteps, 
        effectiveMaxSteps, 
        policy,
        willUse: effectiveMaxSteps
      })
      
      // Try Python backend first, fallback to TypeScript simulator
      let result: SimulatorResult
      const backendAvailable = await checkRolloutServiceHealth()
      
      if (backendAvailable) {
        console.log('✅ Using Python backend for rollout')
        try {
          console.log('📤 Sending rollout request to backend:', {
            policy,
            maxSteps: effectiveMaxSteps,
            envSpecKeys: Object.keys(envSpec),
            objectsCount: envSpec.objects?.length || 0,
            goalsCount: goals.length,
          })
          
          const response = await runRolloutHTTP({
            envSpec,
            policy,
            maxSteps: effectiveMaxSteps,
          })
          
          console.log('📥 Backend response:', {
            success: response.success,
            stepsCount: response.result?.steps?.length || 0,
            error: response.error,
          })
          
          if (response.success && response.result) {
            // Convert Python backend response to SimulatorResult format
            result = {
              steps: response.result.steps.map((step: any) => ({
                state: {
                  agents: step.state.agents.map((a: any) => ({
                    id: a.id,
                    position: a.position,
                  })),
                  objects: step.state.objects,
                  step: step.state.step,
                  totalReward: step.state.totalReward,
                  done: step.state.done,
                  info: step.state.info,
                },
                action: step.action,
                reward: step.reward,
                done: step.done,
              })),
              totalReward: response.result.totalReward,
              episodeLength: response.result.episodeLength,
              success: response.result.success,
              terminationReason: response.result.terminationReason,
            }
            console.log('✅ Python backend rollout complete:', {
              totalReward: result.totalReward,
              episodeLength: result.episodeLength,
              success: result.success,
              executionTime: response.executionTime,
            })
          } else {
            throw new Error(response.error || 'Backend rollout failed')
          }
        } catch (backendError) {
          console.error('❌ Python backend failed:', backendError)
          console.warn('⚠️ Falling back to TypeScript simulator')
          // Fallback to TypeScript simulator
          console.log('🔄 Running TypeScript rollout:', { policy, maxSteps: effectiveMaxSteps })
          result = runUniversalRollout(envSpec, policy, effectiveMaxSteps)
          console.log('✅ TypeScript rollout complete:', {
            steps: result.steps.length,
            totalReward: result.totalReward,
            success: result.success,
          })
        }
      } else {
        console.log('ℹ️ Python backend not available, using TypeScript simulator')
        // Use TypeScript simulator as fallback
        console.log('🔄 Running TypeScript rollout:', { policy, maxSteps: effectiveMaxSteps })
        result = runUniversalRollout(envSpec, policy, effectiveMaxSteps)
        console.log('✅ TypeScript rollout complete:', {
          steps: result.steps.length,
          totalReward: result.totalReward,
          success: result.success,
        })
      }
      
      console.log('✅ Rollout complete:', {
        totalReward: result.totalReward,
        episodeLength: result.episodeLength,
        success: result.success,
        steps: result.steps.length,
        firstStepAction: result.steps[0]?.action,
        firstStepPosition: result.steps[0]?.state.agents[0]?.position,
        lastStepPosition: result.steps[result.steps.length - 1]?.state.agents[0]?.position,
      })
      
      if (!result || !result.steps || result.steps.length === 0) {
        throw new Error('Rollout returned no steps')
      }
      
      setRolloutResult(result)
      setCurrentStepIndex(0)
      
      // Use requestAnimationFrame to avoid setState during render warning
      requestAnimationFrame(() => {
        // Update visualization with first step
        if (result.steps.length > 0 && onStepChange) {
          const firstStep = result.steps[0]
          console.log('📍 Setting initial visualization:', {
            agentPosition: firstStep.state.agents[0]?.position,
            action: firstStep.action,
            totalSteps: result.steps.length,
          })
          onStepChange({ agents: firstStep.state.agents })
        }
        // Auto-play the rollout
        setIsPlaying(true)
      })
      
      // Save rollout to history if we have an envId and user
      // Only save summary data to avoid Convex 1MB limit
      // Full step data is stored in memory for current session only
      if (envId && envId !== 'new' && user?._id) {
        try {
          // Ultra-compressed: Only save summary statistics, no step data
          // Step data is too large even when sampled - Convex has 1MB limit
          // For analysis, we'll use the backend API which has the full data
          const summaryOnly = {
            totalReward: result.totalReward,
            episodeLength: result.episodeLength,
            success: result.success,
            terminationReason: result.terminationReason,
            // Save only first and last agent positions for visualization
            startPosition: result.steps[0]?.state?.agents?.[0]?.position || [0, 0],
            endPosition: result.steps[result.steps.length - 1]?.state?.agents?.[0]?.position || [0, 0],
            // Save only final step info (for termination analysis)
            finalInfo: {
              events: result.steps[result.steps.length - 1]?.state?.info?.events?.slice(-5) || [],
              rewards: result.steps[result.steps.length - 1]?.state?.info?.rewards || [],
            },
            // Empty steps array - analysis will use backend API
            steps: [],
            // Metadata for analysis
            _metadata: {
              totalSteps: result.steps.length,
              hasFullData: false, // Indicates this is summary-only
              note: 'Full step data available via backend API for analysis',
            },
          }
          
          await saveRolloutMutation({
            envId: envId as any,
            ownerId: user._id,
            policy,
            result: summaryOnly, // Save summary-only result
          })
          console.log('Rollout saved to history (summary-only, compressed)')
        } catch (error) {
          console.error('Failed to save rollout history:', error)
          // Don't block the UI if save fails - this is non-critical
        }
      }
    } catch (error) {
      console.error('Rollout failed:', error)
      alert('Rollout failed: ' + (error as Error).message)
    } finally {
      setIsRunning(false)
    }
  }, [envSpec, policy, envId, user, saveRolloutMutation, onStepChange])

  // Expose runRollout function to parent
  useEffect(() => {
    if (onRunRollout) {
      // Store the run function in a way parent can call it
      ;(window as any).__runRollout = handleRunRollout
    }
    return () => {
      delete (window as any).__runRollout
    }
  }, [handleRunRollout, onRunRollout])

  const handleStepForward = () => {
    if (rolloutResult && currentStepIndex < rolloutResult.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const handleStepBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1)
    } else if (currentStepIndex === 0 && onStepChange) {
      // Reset to initial state
      setCurrentStepIndex(0)
    }
  }

  const currentStep = rolloutResult?.steps[currentStepIndex]

  // Auto-play animation
  useEffect(() => {
    if (!isPlaying || !rolloutResult) return

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= rolloutResult.steps.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, playbackSpeed)

    return () => clearInterval(interval)
  }, [isPlaying, rolloutResult, playbackSpeed])

  // Update visualization when step changes (for both auto-play and manual stepping)
  useEffect(() => {
    if (rolloutResult && currentStep && onStepChange) {
      // Use requestAnimationFrame to avoid setState during render warning
      requestAnimationFrame(() => {
        onStepChange({ agents: currentStep.state.agents })
      })
    } else if (!rolloutResult && onStepChange) {
      requestAnimationFrame(() => {
        onStepChange(null)
      })
    }
  }, [currentStepIndex, rolloutResult, currentStep, onStepChange])

  const handlePlayPause = () => {
    if (!rolloutResult) return
    if (currentStepIndex >= rolloutResult.steps.length - 1) {
      // Reset to start
      setCurrentStepIndex(0)
      setIsPlaying(true)
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const handleStop = () => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
            {activeTab === 'rollout' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <select
                value={policy}
                onChange={(e) => {
                  setPolicy(e.target.value as 'random' | 'greedy')
                  setIsPlaying(false)
                }}
                disabled={isRunning || isPlaying}
                className="px-2 py-1 text-sm border border-border rounded bg-background"
              >
                <option value="random">Random Policy</option>
                <option value="greedy">Greedy Policy</option>
              </select>
              <div className="flex items-center gap-2">
                <label htmlFor="maxSteps" className="text-sm text-muted-foreground">
                  Max Steps:
                </label>
                <input
                  id="maxSteps"
                  type="number"
                  min="1"
                  max="10000"
                  value={maxSteps}
                  onChange={(e) => {
                    const inputValue = e.target.value
                    // Allow empty input while typing
                    if (inputValue === '') {
                      setMaxSteps(100) // Temporary fallback, will be overridden when user types
                      return
                    }
                    const value = parseInt(inputValue, 10)
                    if (!isNaN(value) && value > 0 && value <= 10000) {
                      console.log('📝 MaxSteps input changed:', { inputValue, parsedValue: value, currentState: maxSteps })
                      setMaxSteps(value)
                    } else {
                      console.warn('⚠️ Invalid maxSteps input:', { inputValue, parsedValue: value })
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid value on blur
                    const value = parseInt(e.target.value, 10)
                    if (isNaN(value) || value <= 0 || value > 10000) {
                      const timeoutRule = envSpec?.rules?.terminations?.find((r) => r.condition.type === 'timeout')
                      const fallback = timeoutRule?.condition.steps || 100
                      setMaxSteps(fallback)
                    }
                  }}
                  disabled={isRunning || isPlaying}
                  className="w-20 px-2 py-1 text-sm border border-border rounded bg-background font-mono"
                />
              </div>
              <button
                onClick={handleRunRollout}
                disabled={isRunning || isPlaying}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {isRunning ? 'Running...' : 'Run Rollout'}
              </button>
              {rolloutResult && (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reward: </span>
                    <span className="font-mono">{rolloutResult.totalReward.toFixed(2)}</span>
                    <span className="text-muted-foreground ml-4">Steps: </span>
                    <span className="font-mono">{rolloutResult.episodeLength}</span>
                    <span className="text-muted-foreground ml-4">Success: </span>
                    <span className={rolloutResult.success ? 'text-green-600' : 'text-red-600'}>
                      {rolloutResult.success ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={handlePlayPause}
                      disabled={!rolloutResult}
                      className="px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50"
                    >
                      {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>
                    <button
                      onClick={handleStop}
                      disabled={!rolloutResult || (!isPlaying && currentStepIndex === 0)}
                      className="px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50"
                    >
                      ⏹ Stop
                    </button>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      disabled={!rolloutResult}
                      className="px-2 py-1 text-xs border border-border rounded bg-background"
                    >
                      <option value="50">Fast</option>
                      <option value="200">Normal</option>
                      <option value="500">Slow</option>
                      <option value="1000">Very Slow</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {rolloutResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStepBack}
                    disabled={currentStepIndex === 0 || isPlaying}
                    className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                  >
                    ←
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Step {currentStepIndex + 1} / {rolloutResult.steps.length}
                      </span>
                      {isPlaying && (
                        <span className="text-xs text-primary animate-pulse">● Playing</span>
                      )}
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-100"
                        style={{ width: `${((currentStepIndex + 1) / rolloutResult.steps.length) * 100}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleStepForward}
                    disabled={currentStepIndex >= rolloutResult.steps.length - 1 || isPlaying}
                    className="px-2 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-50"
                  >
                    →
                  </button>
                </div>

                {currentStep && (
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Action: </span>
                      <span className="font-mono">
                        {typeof currentStep.action === 'string' 
                          ? currentStep.action 
                          : `[${currentStep.action.map(a => a.toFixed(2)).join(', ')}]`}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Step Reward: </span>
                      <span className={`font-mono ${currentStep.reward > 0 ? 'text-green-600' : currentStep.reward < 0 ? 'text-red-600' : ''}`}>
                        {currentStep.reward >= 0 ? '+' : ''}{currentStep.reward.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cumulative: </span>
                      <span className={`font-mono ${currentStep.state.totalReward > 0 ? 'text-green-600' : currentStep.state.totalReward < 0 ? 'text-red-600' : ''}`}>
                        {currentStep.state.totalReward.toFixed(2)}
                      </span>
                    </div>
                    {currentStep.state.agents.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Position: </span>
                        <span className="font-mono">
                          ({currentStep.state.agents[0].position[0].toFixed(1)}, {currentStep.state.agents[0].position[1].toFixed(1)})
                        </span>
                      </div>
                    )}
                    {currentStep.state.info.rewards.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Reward sources: </span>
                        <div className="ml-4 space-y-0.5">
                          {currentStep.state.info.rewards.map((r, i) => (
                            <div key={i} className="text-xs">
                              {r.reason}: {r.value >= 0 ? '+' : ''}{r.value.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!rolloutResult && !isRunning && (
              <div className="text-sm text-muted-foreground">
                <p>Click "Run Rollout" to test the environment</p>
              </div>
            )}
          </div>
        )}

            {activeTab === 'rewards' && (
              <div className="text-sm">
                <div className="space-y-2">
                  {rolloutResult && currentStep ? (
                    // Show rewards from current step
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        Step {currentStepIndex + 1} Rewards:
                      </div>
                      {currentStep.state.info.rewards && currentStep.state.info.rewards.length > 0 ? (
                        currentStep.state.info.rewards.map((r: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div>
                              <span className="text-xs font-medium">
                                {r.reason || 'unknown'}
                              </span>
                              {r.ruleId && r.ruleId !== 'unknown' && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({r.ruleId})
                                </span>
                              )}
                            </div>
                            <span className={`font-mono ${r.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {r.value >= 0 ? '+' : ''}{r.value.toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-xs">No rewards for this step</p>
                      )}
                    </div>
                  ) : (
                    // Show reward rules from envSpec
                    <>
                      {envSpec?.rules?.rewards && envSpec.rules.rewards.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Configured Reward Rules:
                          </div>
                          {envSpec.rules.rewards.map((rule) => (
                            <div key={rule.id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <span className="text-xs font-medium">
                                  {rule.condition.type}
                                </span>
                                {rule.shaping && (
                                  <span className="text-xs text-muted-foreground ml-2">(shaping)</span>
                                )}
                              </div>
                              <span className={`font-mono ${rule.reward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {rule.reward >= 0 ? '+' : ''}{rule.reward}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded">
                          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
                            ⚠️ No reward rules defined
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Add reward rules in the <strong>Rules panel</strong> (right sidebar → Rewards tab) before running rollout.
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Common rules:
                          </p>
                          <ul className="text-xs text-muted-foreground ml-4 list-disc space-y-1">
                            <li>Goal reached: +10</li>
                            <li>Per step: -0.1</li>
                            <li>Trap hit: -10</li>
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

        {activeTab === 'events' && (
          <div className="text-sm h-full flex flex-col">
            {rolloutResult && rolloutResult.steps.length > 0 ? (
              <>
                <div className="mb-2 text-xs text-muted-foreground">
                  Showing events up to step {currentStepIndex + 1} / {rolloutResult.steps.length}
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5 pr-2">
                  {rolloutResult.steps.slice(0, currentStepIndex + 1).map((step, stepIdx) => 
                    step.state.info.events?.map((event, eventIdx) => (
                      <div 
                        key={`${stepIdx}-${eventIdx}`} 
                        className="text-xs text-muted-foreground p-1.5 hover:bg-muted/50 rounded transition-colors border-l-2 border-transparent hover:border-primary/30"
                      >
                        <span className="text-muted-foreground/60 font-mono text-[10px] mr-2">
                          Step {stepIdx + 1}:
                        </span>
                        {event}
                      </div>
                    ))
                  ).flat()}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Run a rollout to see events</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="text-sm">
            {!envId ? (
              <p className="text-muted-foreground">Save the environment to track rollout history</p>
            ) : rolloutHistory === undefined ? (
              <p className="text-muted-foreground">Loading history...</p>
            ) : rolloutHistory.length === 0 ? (
              <p className="text-muted-foreground">No rollout history yet. Run a rollout to see it here.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {rolloutHistory.length} rollouts
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rolloutHistory.map((history) => {
                    const result = history.result as SimulatorResult
                    const isSelected = selectedHistoryId === history._id
                    // Check if this is summary-only (no step data)
                    const isSummaryOnly = result?._metadata?.hasFullData === false || (result?.steps?.length === 0 && result?.episodeLength > 0)
                    const hasSteps = result && result.steps && result.steps.length > 0
                    
                    return (
                      <div
                        key={history._id}
                        onClick={() => {
                          if (isSummaryOnly) {
                            alert('This rollout is stored as summary-only to save space. Re-run the rollout to see full visualization, or use RL Analysis tab for detailed analysis.')
                          } else if (hasSteps) {
                            setSelectedHistoryId(history._id)
                            setRolloutResult(result)
                            setCurrentStepIndex(0)
                            setIsPlaying(false)
                            if (result.steps.length > 0 && onStepChange) {
                              onStepChange({ agents: result.steps[0].state.agents })
                            }
                          }
                        }}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted'
                        } ${isSummaryOnly ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium capitalize">{history.policy}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(history.createdAt).toLocaleTimeString()}
                            </span>
                            {isSummaryOnly && (
                              <span className="text-xs text-blue-600" title="Summary-only (full data available via backend)">
                                (summary)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className={result?.success ? 'text-green-600' : 'text-red-600'}>
                              {result?.success ? '✓' : '✗'}
                            </span>
                            <span className="text-muted-foreground">
                              Reward: <span className="font-mono">{result?.totalReward?.toFixed(2) || 'N/A'}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Steps: <span className="font-mono">{result?.episodeLength || result?._metadata?.totalSteps || 'N/A'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && (
          <CodeViewTab envSpec={envSpec} />
        )}

        {activeTab === 'analysis' && (
          <div className="p-4 h-full overflow-y-auto space-y-6">
            {!rolloutResult ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-sm mb-2">Run a rollout to see RL analysis</p>
                  <p className="text-xs">The analysis tab provides scientific insights into agent behavior</p>
                </div>
              </div>
            ) : (
              <>
                {/* Reward Decomposition */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <RewardDecompositionHeatmap
                    rolloutSteps={rolloutResult.steps}
                    envSpec={envSpec}
                  />
                </div>

                {/* Trajectory Path */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <TrajectoryPathVisualizer
                    rolloutSteps={rolloutResult.steps}
                    envSpec={envSpec}
                  />
                </div>

                {/* Policy Entropy */}
                {rolloutHistory && rolloutHistory.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="mb-2 text-xs text-muted-foreground">
                      Note: Policy entropy analysis requires full step data. Summary-only rollouts will be skipped.
                    </div>
                    <PolicyEntropyChart
                      rollouts={rolloutHistory
                        .slice(0, 10)
                        .filter((h) => {
                          // Only use rollouts with actual step data (not summary-only)
                          const result = h?.result
                          return result && 
                                 result.steps && 
                                 Array.isArray(result.steps) && 
                                 result.steps.length > 0 &&
                                 result._metadata?.hasFullData !== false
                        })
                        .map((h) =>
                          (h.result.steps || [])
                            .filter((s: any) => s && s.state && s.action !== undefined)
                            .map((s: any) => ({
                              state: s.state || {},
                              action: s.action,
                              reward: s.reward || 0,
                              done: s.done || false,
                            }))
                        )
                        .filter((rollout) => rollout.length > 0)}
                      envSpec={envSpec}
                    />
                  </div>
                )}

                {/* Termination Analysis */}
                {rolloutHistory && rolloutHistory.length > 1 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="mb-2 text-xs text-muted-foreground">
                      Note: Termination analysis requires full step data. Summary-only rollouts will be skipped.
                    </div>
                    <TerminationAnalysisChart
                      rollouts={rolloutHistory
                        .slice(0, 20)
                        .filter((h) => {
                          // Only use rollouts with actual step data (not summary-only)
                          const result = h?.result
                          return result && 
                                 result.steps && 
                                 Array.isArray(result.steps) && 
                                 result.steps.length > 0 &&
                                 result._metadata?.hasFullData !== false
                        })
                        .map((h) =>
                          (h.result.steps || [])
                            .filter((s: any) => s && s.state && s.action !== undefined)
                            .map((s: any) => ({
                              state: s.state || {},
                              action: s.action,
                              reward: s.reward || 0,
                              done: s.done || false,
                            }))
                        )
                        .filter((rollout) => rollout.length > 0)}
                      envSpec={envSpec}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

