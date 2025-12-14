import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvSpec, Vec2 } from '~/lib/envSpec'
import { runUniversalRollout, type SimulatorResult } from '~/lib/universalSimulator'
import { runRolloutHTTP, checkRolloutServiceHealth, loadRolloutFromS3 } from '~/lib/rolloutClient'
import { useAuth } from '~/lib/auth'
import { CodeViewTab } from './CodeViewTab'
import { RLAnalysisTab } from './RLAnalysisTab'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
} from 'recharts'

type BottomPanelTab = 'rollout' | 'rewards' | 'events' | 'history' | 'code' | 'analysis'

interface StudioBottomPanelProps {
  envSpec: EnvSpec
  envId?: string
  onRunRollout?: () => void
  onStepChange?: (stepState: { agents: Array<{ id: string; position: Vec2 }> } | null) => void
}

export function StudioBottomPanel({
  envSpec,
  envId,
  onRunRollout,
  onStepChange,
}: StudioBottomPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<BottomPanelTab>('rollout')
  const [rolloutResult, setRolloutResult] = useState<SimulatorResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [policy, setPolicy] = useState<'random' | 'greedy' | 'trained_model'>(() => {
    // Check URL params for testModel
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const testModel = params.get('testModel')
      const policyParam = params.get('policy')
      if (testModel && policyParam === 'trained_model') {
        return 'trained_model'
      }
    }
    return 'random'
  })
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => {
    // Check URL params for testModel
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const testModel = params.get('testModel')
      if (testModel) {
        return testModel
      }
    }
    return null
  })
  const [maxSteps, setMaxSteps] = useState<number>(() => {
    // Get maxSteps from episode config, timeout rule, or default to 2000 for training
    const episodeMaxSteps = envSpec?.episode?.maxSteps
    if (episodeMaxSteps) return episodeMaxSteps
    const timeoutRule = envSpec?.rules?.terminations?.find((r) => r.condition.type === 'timeout')
    if (timeoutRule?.condition.steps) return timeoutRule.condition.steps
    // Default to 2000 for actual RL experiments (was 100 for quick testing)
    return 2000
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(500) // ms per step
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  
  // Phase 2: Enhanced features state
  const [eventFilter, setEventFilter] = useState<string>('')
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'reward' | 'termination' | 'custom'>('all')
  const [comparisonMode, setComparisonMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([])

  // Keep recent rollouts with full step data in memory for analysis
  const [recentRolloutsWithData, setRecentRolloutsWithData] = useState<SimulatorResult[]>([])

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
      alert(
        `❌ Invalid environment: ${validation.error}\n\nPlease fix the environment before running rollout.`
      )
      return
    }

    // Check if goals exist for greedy policy
    const goals = envSpec.objects?.filter((o) => o?.type === 'goal') || []
    if (policy === 'greedy' && goals.length === 0) {
      alert(
        '⚠️ Greedy policy requires at least one goal object. Please add a goal to your environment.'
      )
      return
    }

    // Check if runId is provided for trained_model policy
    if (policy === 'trained_model' && !selectedRunId) {
      alert(
        '⚠️ Trained model policy requires a Run ID. Please enter a Run ID or select a completed training run.'
      )
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
      const timeoutRuleSteps = envSpec.rules?.terminations?.find(
        (r) => r.condition.type === 'timeout'
      )?.condition.steps

      // Use the actual input value if valid, otherwise fall back to state, then timeout rule, then default
      const effectiveMaxSteps =
        userInputValue && !isNaN(userInputValue) && userInputValue > 0 && userInputValue <= 10000
          ? userInputValue
          : maxSteps && maxSteps > 0
            ? maxSteps
            : timeoutRuleSteps || 100

      // Update state if input value is different (to keep in sync)
      if (
        userInputValue &&
        userInputValue !== maxSteps &&
        !isNaN(userInputValue) &&
        userInputValue > 0 &&
        userInputValue <= 10000
      ) {
        setMaxSteps(userInputValue)
      }

      console.log('📊 Rollout config:', {
        inputFieldValue: userInputValue,
        stateMaxSteps: maxSteps,
        timeoutRuleSteps,
        effectiveMaxSteps,
        policy,
        willUse: effectiveMaxSteps,
      })

      // Try Python backend first, fallback to TypeScript simulator
      let result: SimulatorResult
      const backendAvailable = await checkRolloutServiceHealth()

      if (backendAvailable) {
        console.log('✅ Using Python backend for rollout')
        try {
          // Debug: Log reward rules being sent
          const rewardRules = envSpec.rules?.rewards || []
          console.log('📤 Sending rollout request to backend:', {
            policy,
            maxSteps: effectiveMaxSteps,
            envSpecKeys: Object.keys(envSpec),
            objectsCount: envSpec.objects?.length || 0,
            goalsCount: goals.length,
            rewardRulesCount: rewardRules.length,
            rewardRules: rewardRules.map((r: any) => ({
              id: r.id,
              condition: r.condition?.type,
              reward: r.reward,
            })),
            rulesStructure: {
              hasRules: !!envSpec.rules,
              hasRewards: !!envSpec.rules?.rewards,
              rewardsType: Array.isArray(envSpec.rules?.rewards) ? 'array' : typeof envSpec.rules?.rewards,
            },
          })

          const response = await runRolloutHTTP({
            envSpec,
            policy,
            maxSteps: effectiveMaxSteps,
            ...(policy === 'trained_model' && selectedRunId && { runId: selectedRunId }),
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
              // Store S3 URL if available for later retrieval
              s3Url: response.result.s3Url,
            }
            console.log('✅ Python backend rollout complete:', {
              totalReward: result.totalReward,
              episodeLength: result.episodeLength,
              success: result.success,
              executionTime: response.executionTime,
              s3Url: (result as any).s3Url,
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
        const rewardRules = envSpec.rules?.rewards || []
        console.log('🔄 Running TypeScript rollout:', {
          policy,
          maxSteps: effectiveMaxSteps,
          rewardRulesCount: rewardRules.length,
          rewardRules: rewardRules.map((r: any) => ({
            id: r.id,
            condition: r.condition?.type,
            reward: r.reward,
          })),
        })
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
      
      // Clear selected history when new rollout runs - switch to new rollout data
      // This ensures all tabs (Reward Inspector, Event Log, RL Analysis) use the new rollout
      setSelectedHistoryId(null)

      // Add to recent rollouts with full data (keep last 10 for analysis)
      setRecentRolloutsWithData((prev) => {
        const updated = [result, ...prev].slice(0, 10) // Keep last 10 rollouts
        console.log(`📊 Stored ${updated.length} rollouts with full data for analysis`)
        return updated
      })

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
            endPosition: result.steps[result.steps.length - 1]?.state?.agents?.[0]?.position || [
              0, 0,
            ],
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
              // Store S3 URL if available for loading full data later
              s3Url: (result as any).s3Url || null,
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
      (window as any).__runRollout = handleRunRollout
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
                  setPolicy(e.target.value as 'random' | 'greedy' | 'trained_model')
                  setIsPlaying(false)
                }}
                disabled={isRunning || isPlaying}
                className="px-2 py-1 text-sm border border-border rounded bg-background"
              >
                <option value="random">Random Policy</option>
                <option value="greedy">Greedy Policy</option>
                <option value="trained_model">Trained Model</option>
              </select>
              {policy === 'trained_model' && (
                <input
                  type="text"
                  placeholder="Run ID (e.g., j1234567890)"
                  value={selectedRunId || ''}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  disabled={isRunning || isPlaying}
                  className="px-2 py-1 text-sm border border-border rounded bg-background flex-1 min-w-[200px]"
                />
              )}
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
                      console.log('📝 MaxSteps input changed:', {
                        inputValue,
                        parsedValue: value,
                        currentState: maxSteps,
                      })
                      setMaxSteps(value)
                    } else {
                      console.warn('⚠️ Invalid maxSteps input:', { inputValue, parsedValue: value })
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid value on blur
                    const value = parseInt(e.target.value, 10)
                    if (isNaN(value) || value <= 0 || value > 10000) {
                      const timeoutRule = envSpec?.rules?.terminations?.find(
                        (r) => r.condition.type === 'timeout'
                      )
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
                {/* Show if viewing historical rollout */}
                {selectedHistoryId && (
                  <div className="flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                    <span className="text-blue-600 dark:text-blue-400">
                      📜 Viewing historical rollout
                    </span>
                    <button
                      onClick={() => {
                        setSelectedHistoryId(null)
                        // Keep current rolloutResult if it's the latest, or clear it
                        // The latest rollout should be in recentRolloutsWithData[0]
                        if (recentRolloutsWithData.length > 0) {
                          setRolloutResult(recentRolloutsWithData[0])
                          setCurrentStepIndex(0)
                        }
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Switch to latest
                    </button>
                  </div>
                )}
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
                        style={{
                          width: `${((currentStepIndex + 1) / rolloutResult.steps.length) * 100}%`,
                        }}
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

                {/* Step Info and Mini-Map Row */}
                <div className="flex gap-4">
                  {/* Step Info */}
                  {currentStep && (
                    <div className="text-xs space-y-1 flex-1">
                      <div>
                        <span className="text-muted-foreground">Action: </span>
                        <span className="font-mono">
                          {typeof currentStep.action === 'string'
                            ? currentStep.action
                            : `[${currentStep.action.map((a) => a.toFixed(2)).join(', ')}]`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Step Reward: </span>
                        <span
                          className={`font-mono ${currentStep.reward > 0 ? 'text-green-600' : currentStep.reward < 0 ? 'text-red-600' : ''}`}
                        >
                          {currentStep.reward >= 0 ? '+' : ''}
                          {currentStep.reward.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cumulative: </span>
                        <span
                          className={`font-mono ${currentStep.state.totalReward > 0 ? 'text-green-600' : currentStep.state.totalReward < 0 ? 'text-red-600' : ''}`}
                        >
                          {currentStep.state.totalReward.toFixed(2)}
                        </span>
                      </div>
                      {currentStep.state.agents.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Position: </span>
                          <span className="font-mono">
                            ({currentStep.state.agents[0].position[0].toFixed(1)},{' '}
                            {currentStep.state.agents[0].position[1].toFixed(1)})
                          </span>
                        </div>
                      )}
                      {currentStep.state.info.rewards.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Reward sources: </span>
                          <div className="ml-4 space-y-0.5">
                            {currentStep.state.info.rewards.map((r, i) => (
                              <div key={i} className="text-xs">
                                {r.reason}: {r.value >= 0 ? '+' : ''}
                                {r.value.toFixed(2)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Mini-Map */}
                  <div className="w-32 h-32 border border-border rounded bg-muted/30 relative overflow-hidden flex-shrink-0">
                    <svg width="100%" height="100%" viewBox={`0 0 ${envSpec.world?.width || 10} ${envSpec.world?.height || 10}`}>
                      {/* Grid */}
                      {Array.from({ length: (envSpec.world?.width || 10) + 1 }, (_, i) => (
                        <line key={`v-${i}`} x1={i} y1={0} x2={i} y2={envSpec.world?.height || 10} stroke="currentColor" strokeWidth={0.05} opacity={0.2} />
                      ))}
                      {Array.from({ length: (envSpec.world?.height || 10) + 1 }, (_, i) => (
                        <line key={`h-${i}`} x1={0} y1={i} x2={envSpec.world?.width || 10} y2={i} stroke="currentColor" strokeWidth={0.05} opacity={0.2} />
                      ))}
                      {/* Objects */}
                      {(envSpec.objects || []).map((obj, i) => (
                        <rect
                          key={i}
                          x={obj.position?.[0] || 0}
                          y={obj.position?.[1] || 0}
                          width={0.8}
                          height={0.8}
                          fill={obj.type === 'goal' ? '#22c55e' : obj.type === 'trap' ? '#ef4444' : '#6b7280'}
                          opacity={0.6}
                        />
                      ))}
                      {/* Trajectory path */}
                      {rolloutResult.steps.length > 1 && (
                        <polyline
                          points={rolloutResult.steps
                            .slice(0, currentStepIndex + 1)
                            .map((s) => {
                              const pos = s.state.agents[0]?.position
                              return pos ? `${pos[0] + 0.5},${pos[1] + 0.5}` : ''
                            })
                            .filter(Boolean)
                            .join(' ')}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={0.15}
                          opacity={0.6}
                        />
                      )}
                      {/* Current agent position */}
                      {currentStep?.state.agents[0]?.position && (
                        <circle
                          cx={currentStep.state.agents[0].position[0] + 0.5}
                          cy={currentStep.state.agents[0].position[1] + 0.5}
                          r={0.4}
                          fill="#3b82f6"
                          stroke="white"
                          strokeWidth={0.1}
                        />
                      )}
                    </svg>
                    <div className="absolute bottom-0.5 right-0.5 text-[8px] text-muted-foreground">
                      mini-map
                    </div>
                  </div>
                </div>
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
          <div className="p-4 h-full overflow-y-auto">
            {/* Summary stats */}
            {rolloutResult && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="border border-border rounded p-2">
                  <div className="text-xs text-muted-foreground">Total Reward</div>
                  <div className={`text-lg font-mono font-semibold ${rolloutResult.totalReward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {rolloutResult.totalReward >= 0 ? '+' : ''}{rolloutResult.totalReward.toFixed(2)}
                  </div>
                </div>
                <div className="border border-border rounded p-2">
                  <div className="text-xs text-muted-foreground">Current Step</div>
                  <div className="text-lg font-mono font-semibold">{currentStepIndex + 1}</div>
                </div>
                <div className="border border-border rounded p-2">
                  <div className="text-xs text-muted-foreground">Step Reward</div>
                  <div className={`text-lg font-mono font-semibold ${(currentStep?.reward || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(currentStep?.reward || 0) >= 0 ? '+' : ''}{(currentStep?.reward || 0).toFixed(2)}
                  </div>
                </div>
                <div className="border border-border rounded p-2">
                  <div className="text-xs text-muted-foreground">Cumulative</div>
                  <div className={`text-lg font-mono font-semibold ${(currentStep?.state?.totalReward || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(currentStep?.state?.totalReward || 0) >= 0 ? '+' : ''}{(currentStep?.state?.totalReward || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Reward Timeline Chart */}
            {rolloutResult && rolloutResult.steps.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium">Reward Timeline</h3>
                  <button
                    onClick={() => {
                      const data = rolloutResult.steps.map((s, i) => ({
                        step: i + 1,
                        reward: s.reward,
                        cumulative: s.state.totalReward
                      }))
                      const csv = 'Step,Reward,Cumulative\n' + data.map(d => `${d.step},${d.reward},${d.cumulative}`).join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'rewards.csv'
                      a.click()
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Export CSV
                  </button>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart
                      data={rolloutResult.steps.map((s, i) => ({
                        step: i + 1,
                        reward: s.reward,
                        cumulative: s.state.totalReward
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="step" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" opacity={0.5} />
                      <ReferenceLine x={currentStepIndex + 1} stroke="#f59e0b" strokeWidth={2} />
                      <Line type="monotone" dataKey="reward" stroke="#ef4444" strokeWidth={1} dot={false} name="Step Reward" />
                      <Line type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Cumulative" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500"></span> Step</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500"></span> Cumulative</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500"></span> Current</span>
                  </div>
                </div>
              </div>
            )}

            {/* Current step rewards */}
            {rolloutResult && currentStep ? (
              <div>
                <h3 className="text-xs font-medium mb-2">Step {currentStepIndex + 1} Reward Sources</h3>
                {currentStep.state.info.rewards && currentStep.state.info.rewards.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Rule</th>
                          <th className="text-left px-3 py-2 font-medium">Reason</th>
                          <th className="text-right px-3 py-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentStep.state.info.rewards.map((r: any, i: number) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{r.ruleId || '-'}</td>
                            <td className="px-3 py-2">{r.reason || 'unknown'}</td>
                            <td className={`px-3 py-2 text-right font-mono ${r.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {r.value >= 0 ? '+' : ''}{r.value.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground p-3 border border-border rounded">
                    No rewards triggered this step
                  </div>
                )}
              </div>
            ) : (
              // Show configured rules
              <div>
                <h3 className="text-xs font-medium mb-2">Configured Reward Rules</h3>
                {envSpec?.rules?.rewards && envSpec.rules.rewards.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Condition</th>
                          <th className="text-left px-3 py-2 font-medium">Type</th>
                          <th className="text-right px-3 py-2 font-medium">Reward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {envSpec.rules.rewards.map((rule) => (
                          <tr key={rule.id} className="border-t border-border">
                            <td className="px-3 py-2">{rule.condition.type}</td>
                            <td className="px-3 py-2 text-muted-foreground">{rule.shaping ? 'Shaping' : 'Sparse'}</td>
                            <td className={`px-3 py-2 text-right font-mono ${rule.reward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {rule.reward >= 0 ? '+' : ''}{rule.reward}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground p-3 border border-amber-500/30 bg-amber-500/5 rounded">
                    No reward rules configured. Add rules in the Properties panel → Rewards tab.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="p-4 h-full flex flex-col">
            {rolloutResult && rolloutResult.steps.length > 0 ? (
              <>
                {/* Filter controls */}
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
                  />
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value as any)}
                    className="px-2 py-1 text-xs border border-border rounded bg-background"
                  >
                    <option value="all">All Types</option>
                    <option value="reward">Rewards</option>
                    <option value="termination">Terminations</option>
                    <option value="custom">Custom</option>
                  </select>
                  <button
                    onClick={() => {
                      const allEvents = rolloutResult.steps
                        .slice(0, currentStepIndex + 1)
                        .flatMap((step, idx) => (step.state.info.events || []).map(e => ({ step: idx + 1, event: e })))
                      const csv = 'Step,Event\n' + allEvents.map(e => `${e.step},"${e.event}"`).join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'events.csv'
                      a.click()
                    }}
                    className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                  >
                    Export
                  </button>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">
                    Steps 1-{currentStepIndex + 1} of {rolloutResult.steps.length}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {(() => {
                      const allEvents = rolloutResult.steps
                        .slice(0, currentStepIndex + 1)
                        .flatMap((step) => step.state.info.events || [])
                        .filter(e => {
                          if (eventFilter && !e.toLowerCase().includes(eventFilter.toLowerCase())) return false
                          if (eventTypeFilter === 'reward' && !e.toLowerCase().includes('reward')) return false
                          if (eventTypeFilter === 'termination' && !e.toLowerCase().includes('terminat')) return false
                          return true
                        })
                      return `${allEvents.length} events`
                    })()}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium w-16">Step</th>
                        <th className="text-left px-3 py-2 font-medium">Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolloutResult.steps
                        .slice(0, currentStepIndex + 1)
                        .flatMap((step, stepIdx) =>
                          (step.state.info.events || [])
                            .filter(event => {
                              if (eventFilter && !event.toLowerCase().includes(eventFilter.toLowerCase())) return false
                              if (eventTypeFilter === 'reward' && !event.toLowerCase().includes('reward')) return false
                              if (eventTypeFilter === 'termination' && !event.toLowerCase().includes('terminat')) return false
                              return true
                            })
                            .map((event, eventIdx) => (
                              <tr
                                key={`${stepIdx}-${eventIdx}`}
                                className="border-t border-border hover:bg-muted/30 cursor-pointer"
                                onClick={() => setCurrentStepIndex(stepIdx)}
                              >
                                <td className="px-3 py-1.5 font-mono text-muted-foreground">{stepIdx + 1}</td>
                                <td className="px-3 py-1.5">
                                  {event.toLowerCase().includes('reward') && <span className="text-green-600 mr-1">●</span>}
                                  {event.toLowerCase().includes('terminat') && <span className="text-red-600 mr-1">●</span>}
                                  {event}
                                </td>
                              </tr>
                            ))
                        )}
                    </tbody>
                  </table>
                  {rolloutResult.steps.slice(0, currentStepIndex + 1).every(step => !step.state.info.events?.length) && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No events triggered yet
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Run a rollout to see events</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 h-full overflow-y-auto">
            {!envId ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">Save the environment to track history</p>
              </div>
            ) : rolloutHistory === undefined ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">Loading...</p>
              </div>
            ) : rolloutHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">No rollout history. Run a rollout to start.</p>
              </div>
            ) : (
              <div>
                {/* Controls */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{rolloutHistory.length} rollouts</span>
                    <button
                      onClick={() => {
                        setComparisonMode(!comparisonMode)
                        if (comparisonMode) setSelectedForComparison([])
                      }}
                      className={`px-2 py-1 text-xs border rounded ${comparisonMode ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                    >
                      {comparisonMode ? 'Exit Compare' : 'Compare'}
                    </button>
                    {comparisonMode && selectedForComparison.length > 0 && (
                      <span className="text-xs text-muted-foreground">{selectedForComparison.length} selected</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const data = rolloutHistory.map(h => ({
                        time: new Date(h.createdAt).toISOString(),
                        policy: h.policy,
                        success: h.result?.success,
                        reward: h.result?.totalReward,
                        steps: h.result?.episodeLength
                      }))
                      const csv = 'Time,Policy,Success,Reward,Steps\n' + data.map(d => `${d.time},${d.policy},${d.success},${d.reward},${d.steps}`).join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'rollout_history.csv'
                      a.click()
                    }}
                    className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                  >
                    Export All
                  </button>
                </div>

                {/* Comparison Chart */}
                {comparisonMode && selectedForComparison.length >= 2 && (
                  <div className="mb-4 border border-border rounded-lg p-3">
                    <h4 className="text-xs font-medium mb-2">Comparison: Reward Distribution</h4>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart
                        data={selectedForComparison.map((id, idx) => {
                          const h = rolloutHistory.find(r => r._id === id)
                          return {
                            name: `#${idx + 1}`,
                            reward: h?.result?.totalReward || 0,
                            steps: h?.result?.episodeLength || 0
                          }
                        })}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="name" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '11px',
                          }}
                        />
                        <Bar dataKey="reward" fill="#22c55e" name="Reward" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="border border-border rounded p-2">
                        <div className="text-muted-foreground">Avg Reward</div>
                        <div className="font-mono font-semibold">
                          {(selectedForComparison.reduce((sum, id) => {
                            const h = rolloutHistory.find(r => r._id === id)
                            return sum + (h?.result?.totalReward || 0)
                          }, 0) / selectedForComparison.length).toFixed(2)}
                        </div>
                      </div>
                      <div className="border border-border rounded p-2">
                        <div className="text-muted-foreground">Avg Steps</div>
                        <div className="font-mono font-semibold">
                          {Math.round(selectedForComparison.reduce((sum, id) => {
                            const h = rolloutHistory.find(r => r._id === id)
                            return sum + (h?.result?.episodeLength || 0)
                          }, 0) / selectedForComparison.length)}
                        </div>
                      </div>
                      <div className="border border-border rounded p-2">
                        <div className="text-muted-foreground">Success Rate</div>
                        <div className="font-mono font-semibold">
                          {Math.round((selectedForComparison.filter(id => {
                            const h = rolloutHistory.find(r => r._id === id)
                            return h?.result?.success
                          }).length / selectedForComparison.length) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {comparisonMode && <th className="text-center px-2 py-2 font-medium w-8"></th>}
                        <th className="text-left px-3 py-2 font-medium">Time</th>
                        <th className="text-left px-3 py-2 font-medium">Policy</th>
                        <th className="text-center px-3 py-2 font-medium">Status</th>
                        <th className="text-right px-3 py-2 font-medium">Reward</th>
                        <th className="text-right px-3 py-2 font-medium">Steps</th>
                        <th className="text-center px-3 py-2 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolloutHistory.map((history) => {
                        const result = history.result as SimulatorResult
                        const isSelected = selectedHistoryId === history._id
                        const isCompareSelected = selectedForComparison.includes(history._id)
                        const isSummaryOnly =
                          (result as any)?._metadata?.hasFullData === false ||
                          (result?.steps?.length === 0 && result?.episodeLength > 0)
                        const hasSteps = result && result.steps && Array.isArray(result.steps) && result.steps.length > 0
                        const s3Url = (result as any)?._metadata?.s3Url
                        const hasS3Url = !!s3Url

                        return (
                          <tr
                            key={history._id}
                            className={`border-t border-border cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/5' : isCompareSelected ? 'bg-blue-500/10' : 'hover:bg-muted/50'
                            } ${isSummaryOnly ? 'opacity-60' : ''}`}
                            onClick={async () => {
                              if (comparisonMode) {
                                if (isCompareSelected) {
                                  setSelectedForComparison(selectedForComparison.filter(id => id !== history._id))
                                } else {
                                  setSelectedForComparison([...selectedForComparison, history._id])
                                }
                              } else if (isSummaryOnly || !hasSteps) {
                                // Try to load from S3 or in-memory cache
                                console.log('🔍 Loading historical rollout:', {
                                  historyId: history._id,
                                  isSummaryOnly,
                                  hasSteps,
                                  hasS3Url,
                                  s3Url: s3Url,
                                  metadata: (result as any)?._metadata,
                                  episodeLength: result.episodeLength,
                                  totalReward: result.totalReward,
                                  success: result.success,
                                  recentRolloutsCount: recentRolloutsWithData.length,
                                })
                                
                                // Check in-memory cache first (most reliable)
                                // Try to match by multiple criteria for better accuracy
                                const cachedRollout = recentRolloutsWithData.find((r) => {
                                  // Match by episode length, total reward, and success status
                                  const lengthMatch = r.episodeLength === result.episodeLength
                                  const rewardMatch = Math.abs(r.totalReward - (result.totalReward || 0)) < 0.01
                                  const successMatch = r.success === result.success
                                  return lengthMatch && rewardMatch && successMatch
                                })
                                
                                if (cachedRollout) {
                                  console.log('✅ Found rollout in memory cache, using cached data')
                                  // Found in cache - use it
                                  setSelectedHistoryId(history._id)
                                  setRolloutResult(cachedRollout)
                                  setCurrentStepIndex(0)
                                  setIsPlaying(false)
                                  if (cachedRollout.steps.length > 0 && onStepChange) {
                                    onStepChange({ agents: cachedRollout.steps[0].state.agents })
                                  }
                                  // Switch to rollout preview tab to show the data
                                  setActiveTab('rollout')
                                } else if (hasS3Url && s3Url) {
                                  console.log('📥 Loading rollout from S3:', s3Url)
                                  // Try to load from S3
                                  setLoadingHistoryRollout(true)
                                  try {
                                    const loadedResult = await loadRolloutFromS3(s3Url)
                                    if (loadedResult.success && loadedResult.result) {
                                      const fullResult: SimulatorResult = {
                                        steps: loadedResult.result.steps.map((step: any) => ({
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
                                        totalReward: loadedResult.result.totalReward,
                                        episodeLength: loadedResult.result.episodeLength,
                                        success: loadedResult.result.success,
                                        terminationReason: loadedResult.result.terminationReason,
                                      }
                                      
                                      setSelectedHistoryId(history._id)
                                      setRolloutResult(fullResult)
                                      setCurrentStepIndex(0)
                                      setIsPlaying(false)
                                      if (fullResult.steps.length > 0 && onStepChange) {
                                        onStepChange({ agents: fullResult.steps[0].state.agents })
                                      }
                                      // Switch to rollout preview tab to show the data
                                      setActiveTab('rollout')
                                    } else {
                                      alert('Failed to load rollout data from storage')
                                    }
                                  } catch (error) {
                                    console.error('Failed to load rollout from S3:', error)
                                    alert('Failed to load rollout data. The rollout may have been deleted or storage is unavailable.')
                                  } finally {
                                    setLoadingHistoryRollout(false)
                                  }
                                } else {
                                  console.warn('❌ No S3 URL or cache found for historical rollout:', {
                                    historyId: history._id,
                                    hasS3Url: !!s3Url,
                                    cachedRollouts: recentRolloutsWithData.length,
                                    episodeLength: result.episodeLength,
                                    totalReward: result.totalReward,
                                  })
                                  alert(
                                    'This rollout only has summary data. Full step data is not available.\n\n' +
                                    'This may happen if:\n' +
                                    '• The rollout was saved before S3 storage was enabled\n' +
                                    '• The rollout data was deleted from storage\n' +
                                    '• The page was refreshed (in-memory cache cleared)\n\n' +
                                    'Run a new rollout to see full data, or check if this rollout is in your recent rollouts.'
                                  )
                                }
                              } else if (hasSteps) {
                                // Has full step data in history - use it directly
                                setSelectedHistoryId(history._id)
                                setRolloutResult(result)
                                setCurrentStepIndex(0)
                                setIsPlaying(false)
                                if (result.steps.length > 0 && onStepChange) {
                                  onStepChange({ agents: result.steps[0].state.agents })
                                }
                                // Switch to rollout preview tab to show the data
                                setActiveTab('rollout')
                              }
                            }}
                          >
                            {comparisonMode && (
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isCompareSelected}
                                  onChange={() => {}}
                                  className="w-3 h-3"
                                />
                              </td>
                            )}
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(history.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="px-3 py-2 capitalize">{history.policy}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={result?.success ? 'text-green-600' : 'text-red-600'}>
                                {result?.success ? '✓' : '✗'}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${(result?.totalReward || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {result?.totalReward?.toFixed(2) || '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {result?.episodeLength || (result as any)?._metadata?.totalSteps || '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isSelected && <span className="text-primary">●</span>}
                              {isSummaryOnly && <span className="text-muted-foreground text-[10px]">sum</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && <CodeViewTab envSpec={envSpec} />}

        {activeTab === 'analysis' && (
          <RLAnalysisTab
            rolloutResult={rolloutResult}
            rolloutHistory={rolloutHistory}
            recentRolloutsWithData={recentRolloutsWithData}
            envSpec={envSpec}
            policy={policy}
          />
        )}
      </div>
    </div>
  )
}
