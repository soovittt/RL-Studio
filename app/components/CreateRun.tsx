import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useAuth } from '~/lib/auth'
import { useNavigate } from '@tanstack/react-router'
import { launchTrainingJob, checkTrainingServiceHealth, type LaunchTrainingRequest } from '~/lib/trainingClient'
import { EnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { HyperparameterSweepModal } from './HyperparameterSweepModal'

interface CreateRunProps {
  envId: string
  onClose: () => void
  duplicateFromRunId?: string
}

type AlgorithmType = 'ppo' | 'dqn' | 'a2c' | 'bc' | 'imitation' | 'random'

export function CreateRun({ envId, onClose, duplicateFromRunId }: CreateRunProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showSweepModal, setShowSweepModal] = useState(false)
  
  // Fetch environment to get EnvSpec
  const environment = useQuery(api.environments.get, envId !== 'new' ? { id: envId as any } : 'skip')
  
  // Fetch run to duplicate if duplicateFromRunId is provided
  const sourceRun = useQuery(
    api.runs.get,
    duplicateFromRunId ? { id: duplicateFromRunId as any } : 'skip'
  )
  
  // Load EnvSpec from environment
  const envSpec = useMemo<EnvSpec | null>(() => {
    if (!environment) return null
    if (environment.envSpec) {
      return environment.envSpec as EnvSpec
    }
    return SceneGraphManager.migrateFromLegacy(environment)
  }, [environment])

  // Calculate environment-adaptive defaults
  const adaptiveDefaults = useMemo(() => {
    if (!envSpec) return { learningRate: 3e-4, rolloutLength: 256, numEnvs: 8 }
    
    const actionSpaceType = envSpec.actionSpace?.type || 'discrete'
    const worldSize = (envSpec.world?.width || 10) * (envSpec.world?.height || 10)
    
    return {
      learningRate: actionSpaceType === 'discrete' ? 0.0005 : 0.0003,
      rolloutLength: worldSize > 400 ? 512 : 256,
      numEnvs: envSpec.envType === 'grid' ? 8 : 4,
    }
  }, [envSpec])

  // Get available algorithms based on action space
  const availableAlgorithms = useMemo(() => {
    if (!envSpec) return ['ppo', 'dqn', 'a2c', 'bc', 'random']
    
    const actionSpaceType = envSpec.actionSpace?.type || 'discrete'
    
    if (actionSpaceType === 'continuous') {
      return ['ppo', 'a2c', 'bc', 'random'] as AlgorithmType[]
    } else {
      return ['ppo', 'dqn', 'a2c', 'bc', 'random'] as AlgorithmType[]
    }
  }, [envSpec])

  // Pre-fill from source run if duplicating
  const getInitialAlgorithm = (): AlgorithmType => {
    if (sourceRun?.algorithm) {
      return sourceRun.algorithm as AlgorithmType
    }
    return 'ppo'
  }

  const getInitialHyperparams = () => {
    if (sourceRun?.hyperparams && typeof sourceRun.hyperparams === 'object') {
      const source = sourceRun.hyperparams as any
      return {
        learning_rate: source.learning_rate || adaptiveDefaults.learningRate,
        gamma: source.gamma || 0.99,
        steps: source.steps || 1000000,
        batch_size: source.batch_size || 64,
        rollout_length: source.rollout_length || adaptiveDefaults.rolloutLength,
        update_epochs: source.update_epochs || 10,
        entropy_coeff: source.entropy_coeff || 0.01,
      }
    }
    return {
    learning_rate: adaptiveDefaults.learningRate,
    gamma: 0.99,
    steps: 1000000,
    batch_size: 64,
    rollout_length: adaptiveDefaults.rolloutLength,
    update_epochs: 10,
    entropy_coeff: 0.01,
    }
  }

  const getInitialAdvancedHyperparams = () => {
    if (sourceRun?.hyperparams && typeof sourceRun.hyperparams === 'object') {
      const source = sourceRun.hyperparams as any
      return {
        clip_range: source.clip_range || 0.2,
        value_loss_coeff: source.value_loss_coeff || 0.5,
        max_grad_norm: source.max_grad_norm || 0.5,
        gae_lambda: source.gae_lambda || 0.95,
        mini_batch_size: source.mini_batch_size || 64,
        replay_buffer_size: source.replay_buffer_size || 100000,
        target_update_freq: source.target_update_freq || 1000,
        epsilon_start: source.epsilon_start || 1.0,
        epsilon_end: source.epsilon_end || 0.05,
        expert_dataset_path: source.expert_dataset_path || '',
        mixture_coeff: source.mixture_coeff || 0.5,
      }
    }
    return {
    clip_range: 0.2,
    value_loss_coeff: 0.5,
    max_grad_norm: 0.5,
    gae_lambda: 0.95,
    mini_batch_size: 64,
    replay_buffer_size: 100000,
    target_update_freq: 1000,
    epsilon_start: 1.0,
    epsilon_end: 0.05,
    expert_dataset_path: '',
    mixture_coeff: 0.5,
    }
  }

  const getInitialTrainingConfig = () => {
    if (sourceRun?.config && typeof sourceRun.config === 'object') {
      const source = sourceRun.config as any
      return {
        accelerator: source.accelerator || 'A10:1',
        metrics_interval: source.metrics_interval || 100,
        seed: source.seed || 42,
        num_envs: source.num_envs || adaptiveDefaults.numEnvs,
        checkpoint_interval: source.checkpoint_interval || 10000,
        early_stopping: source.early_stopping || false,
        early_stopping_patience: source.early_stopping_patience || 10,
      }
    }
    return {
    accelerator: 'A10:1',
    metrics_interval: 100,
    seed: 42,
    num_envs: adaptiveDefaults.numEnvs,
    checkpoint_interval: 10000,
    early_stopping: false,
    early_stopping_patience: 10,
    }
  }

  // State management
  const [algorithm, setAlgorithm] = useState<AlgorithmType>(getInitialAlgorithm)
  const [concepts, setConcepts] = useState({
    rewardShaping: false,
    curriculum: false,
    imitation: false,
    explorationBonus: false,
    domainRandomization: false,
    multiAgentMode: false,
  })
  const [hyperparams, setHyperparams] = useState(getInitialHyperparams)
  const [advancedHyperparams, setAdvancedHyperparams] = useState(getInitialAdvancedHyperparams)
  const [trainingConfig, setTrainingConfig] = useState(getInitialTrainingConfig)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null)
  const [serviceError, setServiceError] = useState<string | null>(null)

  const createRunMutation = useMutation(api.runs.create)
  const updateStatusMutation = useMutation(api.runs.updateStatus)
  const suggestHyperparamsAction = useAction(api.coderabbit.suggestHyperparameters)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [hyperparamSuggestions, setHyperparamSuggestions] = useState<any>(null)

  // Update defaults when envSpec changes
  useEffect(() => {
    if (envSpec && adaptiveDefaults) {
      setHyperparams(prev => ({
        ...prev,
        learning_rate: adaptiveDefaults.learningRate,
        rollout_length: adaptiveDefaults.rolloutLength,
      }))
      setTrainingConfig(prev => ({
        ...prev,
        num_envs: adaptiveDefaults.numEnvs,
      }))
    }
  }, [envSpec, adaptiveDefaults])

  // Auto-show multi-agent mode if >1 agent
  useEffect(() => {
    if (envSpec && envSpec.agents && envSpec.agents.length > 1) {
      setConcepts(prev => ({ ...prev, multiAgentMode: true }))
    }
  }, [envSpec])

  // Check training service availability
  useEffect(() => {
    checkTrainingServiceHealth()
      .then((available) => {
        setServiceAvailable(available)
        if (!available) {
          setServiceError('Training service is not available. Please ensure the backend is running.')
        }
      })
      .catch((error) => {
        setServiceAvailable(false)
        setServiceError(`Failed to connect to training service: ${error.message}`)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?._id) {
      alert('Please log in to create runs')
      return
    }
    setIsSubmitting(true)
    setServiceError(null)
    try {
      // Create run record in database
      const runId = await createRunMutation({
        envId: envId as any,
        ownerId: user._id,
        algorithm,
        concepts,
        hyperparams: {
          ...hyperparams,
          ...(showAdvanced ? advancedHyperparams : {}),
        },
      })

      // Launch training job via backend
      try {
        if (!envSpec) {
          throw new Error('Environment specification is required to launch training')
        }

        const launchRequest: LaunchTrainingRequest = {
          runId,
          envSpec, // Required for GraphQL
          config: {
            accelerator: trainingConfig.accelerator,
            metrics_interval: trainingConfig.metrics_interval,
            algorithm,
            hyperparams: {
              ...hyperparams,
              ...(showAdvanced ? advancedHyperparams : {}),
            },
            concepts,
            training_config: trainingConfig,
            use_spot: false,
            use_managed_jobs: true,
          },
        }

        const launchResponse = await launchTrainingJob(launchRequest)
        
        if (launchResponse.success && launchResponse.jobId) {
          await updateStatusMutation({ 
            id: runId, 
            status: 'running',
            skyPilotJobId: launchResponse.jobId,
          })
          navigate({ to: '/runs/$id', params: { id: runId } })
          onClose()
        } else {
          await updateStatusMutation({ id: runId, status: 'error' })
          throw new Error(launchResponse.error || 'Failed to launch training job')
        }
      } catch (jobError) {
        await updateStatusMutation({ id: runId, status: 'error' })
        throw jobError
      }
    } catch (error) {
      console.error('Failed to create run:', error)
      setServiceError('Failed to launch training job: ' + (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper to format action space summary
  const getActionSpaceSummary = () => {
    if (!envSpec?.actionSpace) return 'Not specified'
    const as = envSpec.actionSpace
    if (as.type === 'discrete') {
      const actions = as.actions || []
      return `Discrete (${actions.length} actions: ${actions.join(', ')})`
    } else {
      return `Continuous (${as.dimensions || 2} dims, range: [${as.range?.[0] || -1}, ${as.range?.[1] || 1}])`
    }
  }

  // Helper to format observation space summary
  const getObservationSpaceSummary = () => {
    if (!envSpec?.stateSpace) return 'Not specified'
    const ss = envSpec.stateSpace
    if (ss.type === 'vector') {
      const dims = ss.dimensions || []
      return `Vector (${dims.join(' × ')})`
    } else if (ss.type === 'image') {
      return `Image (${ss.dimensions?.join(' × ') || 'unknown'})`
    }
    return 'Custom'
  }

  const algorithmOptions = [
    { value: 'ppo', label: 'PPO (Proximal Policy Optimization)' },
    { value: 'dqn', label: 'DQN (Deep Q-Network)' },
    { value: 'a2c', label: 'A2C (Actor-Critic)' },
    { value: 'bc', label: 'BC (Behavior Cloning)' },
    { value: 'imitation', label: 'Imitation (GAIL-lite)' },
    { value: 'random', label: 'Random / Heuristic (Debug)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto text-foreground">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {duplicateFromRunId ? 'Duplicate Training Run' : 'New Training Run'}
            </h2>
            {duplicateFromRunId && sourceRun && (
              <div className="text-sm text-muted-foreground">
                Based on run: <span className="font-mono">{sourceRun._id.slice(0, 8)}...</span>
              </div>
            )}
          </div>
          {duplicateFromRunId && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                This run is pre-filled with settings from the previous run. Modify any values before submitting.
              </p>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Algorithm Section */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {algorithmOptions
                .filter(opt => availableAlgorithms.includes(opt.value as AlgorithmType))
                .map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            {availableAlgorithms.length < algorithmOptions.length && (
              <p className="text-xs text-muted-foreground mt-1">
                Algorithms filtered based on environment action space type
              </p>
            )}
          </div>

          {/* 2. RL Concepts Section */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold">RL Concepts</label>
            <div className="space-y-2.5 pl-1">
              {Object.entries(concepts).map(([key, value]) => {
                // Hide multi-agent if only 1 agent
                if (key === 'multiAgentMode' && (!envSpec || (envSpec.agents?.length || 0) <= 1)) {
                  return null
                }
                const label = key.replace(/([A-Z])/g, ' $1').trim()
                return (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) =>
                        setConcepts({ ...concepts, [key]: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer bg-background"
                    />
                    <span className="text-sm group-hover:text-primary transition-colors">
                      {label}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 3. Hyperparameters Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-900">Hyperparameters</label>
              <button
                type="button"
                onClick={async () => {
                  if (!envSpec) return
                  setIsLoadingSuggestions(true)
                  try {
                    const result = await suggestHyperparamsAction({
                      envSpec,
                      algorithm,
                    })
                    if (result.success && result.recommendations) {
                      setHyperparamSuggestions(result.recommendations)
                      // Apply suggestions
                      setHyperparams(prev => ({
                        ...prev,
                        learning_rate: result.recommendations.learning_rate,
                        gamma: result.recommendations.gamma,
                        entropy_coeff: result.recommendations.entropy_coef || prev.entropy_coeff,
                        batch_size: result.recommendations.batch_size || prev.batch_size,
                        rollout_length: result.recommendations.n_steps || prev.rollout_length,
                      }))
                    }
                  } catch (err) {
                    console.error('Failed to get suggestions:', err)
                  } finally {
                    setIsLoadingSuggestions(false)
                  }
                }}
                disabled={isLoadingSuggestions || !envSpec}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isLoadingSuggestions ? (
                  <>
                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Getting Suggestions...
                  </>
                ) : (
                  <>
                    💡 Get CodeRabbit Suggestions
                  </>
                )}
              </button>
            </div>
            {hyperparamSuggestions && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <div className="font-medium text-gray-900 mb-1">Recommended by CodeRabbit:</div>
                <div className="text-gray-700 space-y-1">
                  <div>• Learning Rate: {hyperparamSuggestions.learning_rate} ({hyperparamSuggestions.justification.split(';')[0]})</div>
                  <div>• Gamma: {hyperparamSuggestions.gamma} ({hyperparamSuggestions.justification.split(';')[1]})</div>
                  {hyperparamSuggestions.entropy_coef && (
                    <div>• Entropy: {hyperparamSuggestions.entropy_coef} ({hyperparamSuggestions.justification.split(';')[2]})</div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Confidence: {Math.round(hyperparamSuggestions.confidence * 100)}%
                </div>
              </div>
            )}
            <div className="space-y-3 pl-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1.5 font-medium">Learning Rate</label>
                  <input
                    type="number"
                    step="1e-5"
                    value={hyperparams.learning_rate}
                    onChange={(e) => setHyperparams({ ...hyperparams, learning_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Gamma</label>
                  <input
                    type="number"
                    step="0.01"
                    value={hyperparams.gamma}
                    onChange={(e) => setHyperparams({ ...hyperparams, gamma: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Total Steps</label>
                  <input
                    type="number"
                    value={hyperparams.steps}
                    onChange={(e) => setHyperparams({ ...hyperparams, steps: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Batch Size</label>
                  <input
                    type="number"
                    value={hyperparams.batch_size}
                    onChange={(e) => setHyperparams({ ...hyperparams, batch_size: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Rollout Length</label>
                  <input
                    type="number"
                    value={hyperparams.rollout_length}
                    onChange={(e) => setHyperparams({ ...hyperparams, rollout_length: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Update Epochs</label>
                  <input
                    type="number"
                    value={hyperparams.update_epochs}
                    onChange={(e) => setHyperparams({ ...hyperparams, update_epochs: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Entropy Coefficient</label>
                  <input
                    type="number"
                    step="0.001"
                    value={hyperparams.entropy_coeff}
                    onChange={(e) => setHyperparams({ ...hyperparams, entropy_coeff: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
            {duplicateFromRunId && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm font-medium text-yellow-900 mb-2">Quick Edit Suggestions:</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHyperparams(prev => ({
                        ...prev,
                        learning_rate: prev.learning_rate * 0.5,
                      }))
                    }}
                    className="px-3 py-1 text-xs bg-background border border-yellow-300/50 rounded hover:bg-yellow-100/20 transition-colors"
                  >
                    Try Lower LR (×0.5)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHyperparams(prev => ({
                        ...prev,
                        learning_rate: prev.learning_rate * 2,
                      }))
                    }}
                    className="px-3 py-1 text-xs bg-background border border-yellow-300/50 rounded hover:bg-yellow-100/20 transition-colors"
                  >
                    Try Higher LR (×2)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (algorithm === 'ppo' && availableAlgorithms.includes('dqn')) {
                        setAlgorithm('dqn')
                      } else if (algorithm === 'dqn' && availableAlgorithms.includes('ppo')) {
                        setAlgorithm('ppo')
                      } else if (algorithm === 'ppo' && availableAlgorithms.includes('a2c')) {
                        setAlgorithm('a2c')
                      }
                    }}
                    disabled={!((algorithm === 'ppo' && (availableAlgorithms.includes('dqn') || availableAlgorithms.includes('a2c'))) || (algorithm === 'dqn' && availableAlgorithms.includes('ppo')))}
                    className="px-3 py-1 text-xs bg-background border border-yellow-300/50 rounded hover:bg-yellow-100/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Try Different Algorithm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHyperparams(prev => ({
                        ...prev,
                        steps: Math.round(prev.steps * 1.5),
                      }))
                    }}
                    className="px-3 py-1 text-xs bg-background border border-yellow-300/50 rounded hover:bg-yellow-100/20 transition-colors"
                  >
                    Try More Steps (×1.5)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Training Configuration Section */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold">Training Configuration</label>
            <div className="space-y-3 pl-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">GPU Accelerator</label>
                  <select
                    value={trainingConfig.accelerator}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, accelerator: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  >
                    <option value="A10:1">A10 (1 GPU)</option>
                    <option value="A10:2">A10 (2 GPUs)</option>
                    <option value="A100:1">A100 (1 GPU)</option>
                    <option value="A100:2">A100 (2 GPUs)</option>
                    <option value="T4:1">T4 (1 GPU)</option>
                    <option value="L4:1">L4 (1 GPU)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Rollout Interval (steps)</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={trainingConfig.metrics_interval}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, metrics_interval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1">How often to send metrics</p>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Seed</label>
                  <input
                    type="number"
                    value={trainingConfig.seed}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, seed: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Parallel Environments</label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={trainingConfig.num_envs}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, num_envs: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Checkpoint Interval (steps)</label>
                  <input
                    type="number"
                    value={trainingConfig.checkpoint_interval}
                    onChange={(e) => setTrainingConfig({ ...trainingConfig, checkpoint_interval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer pt-6">
                    <input
                      type="checkbox"
                      checked={trainingConfig.early_stopping}
                      onChange={(e) => setTrainingConfig({ ...trainingConfig, early_stopping: e.target.checked })}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground font-medium">Early Stopping</span>
                  </label>
                  {trainingConfig.early_stopping && (
                    <input
                      type="number"
                      placeholder="Patience (iterations)"
                      value={trainingConfig.early_stopping_patience}
                      onChange={(e) => setTrainingConfig({ ...trainingConfig, early_stopping_patience: parseInt(e.target.value) })}
                      className="w-full mt-2 px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Environment Settings (Read-only) */}
          {envSpec && (
            <div className="space-y-2 bg-muted/50 p-4 rounded-md border border-border">
              <label className="block text-sm font-semibold">Environment Summary (Read-only)</label>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Env Name:</span>
                  <span className="ml-2 font-medium">{envSpec.name || 'Untitled'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 font-medium capitalize">{envSpec.envType || 'grid'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Agents:</span>
                  <span className="ml-2 font-medium">{envSpec.agents?.length || 0} agent{envSpec.agents?.length !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Action Space:</span>
                  <span className="ml-2 font-medium">{getActionSpaceSummary()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Observation Space:</span>
                  <span className="ml-2 font-medium">{getObservationSpaceSummary()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reward Rules:</span>
                  <span className="ml-2 font-medium">{envSpec.rules?.rewards?.length || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Termination Rules:</span>
                  <span className="ml-2 font-medium">{envSpec.rules?.terminations?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Observation & Action Settings (Read-only) */}
          {envSpec && (
            <div className="space-y-2 bg-muted/50 p-4 rounded-md border border-border">
              <label className="block text-sm font-semibold">Action & Observation Space (Read-only)</label>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-medium">Action Space:</span>
                  <div className="mt-1 bg-background p-2 rounded border border-border font-mono text-xs text-foreground">
                    {getActionSpaceSummary()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Observation Space:</span>
                  <div className="mt-1 bg-background p-2 rounded border border-border font-mono text-xs text-foreground">
                    {getObservationSpaceSummary()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Advanced Section (Collapsed) */}
          <div className="space-y-2 border border-border rounded-md">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex justify-between items-center p-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              <span>Advanced Settings</span>
              <span className="text-muted-foreground">{showAdvanced ? '▼' : '▶'}</span>
            </button>
            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-border">
                {/* PPO-specific */}
                {(algorithm === 'ppo' || algorithm === 'a2c') && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">PPO/A2C Settings</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Clip Range</label>
                        <input
                          type="number"
                          step="0.01"
                          value={advancedHyperparams.clip_range}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, clip_range: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Value Loss Coeff</label>
                        <input
                          type="number"
                          step="0.1"
                          value={advancedHyperparams.value_loss_coeff}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, value_loss_coeff: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Max Grad Norm</label>
                        <input
                          type="number"
                          step="0.1"
                          value={advancedHyperparams.max_grad_norm}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, max_grad_norm: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">GAE Lambda</label>
                        <input
                          type="number"
                          step="0.01"
                          value={advancedHyperparams.gae_lambda}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, gae_lambda: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Mini-batch Size</label>
                        <input
                          type="number"
                          value={advancedHyperparams.mini_batch_size}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, mini_batch_size: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* DQN-specific */}
                {algorithm === 'dqn' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">DQN Settings</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Replay Buffer Size</label>
                        <input
                          type="number"
                          value={advancedHyperparams.replay_buffer_size}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, replay_buffer_size: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Target Update Freq</label>
                        <input
                          type="number"
                          value={advancedHyperparams.target_update_freq}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, target_update_freq: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Epsilon Start</label>
                        <input
                          type="number"
                          step="0.1"
                          value={advancedHyperparams.epsilon_start}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, epsilon_start: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Epsilon End</label>
                        <input
                          type="number"
                          step="0.01"
                          value={advancedHyperparams.epsilon_end}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, epsilon_end: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Imitation-specific */}
                {concepts.imitation && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Imitation Learning Settings</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Expert Dataset Path</label>
                        <input
                          type="text"
                          value={advancedHyperparams.expert_dataset_path}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, expert_dataset_path: e.target.value })}
                          placeholder="/path/to/expert/data"
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">Mixture Coefficient</label>
                        <input
                          type="number"
                          step="0.1"
                          value={advancedHyperparams.mixture_coeff}
                          onChange={(e) => setAdvancedHyperparams({ ...advancedHyperparams, mixture_coeff: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error/Warning Messages */}
          {serviceError && (
            <div className="bg-red-50/20 border border-red-200/50 rounded-md p-3.5 text-sm text-red-500 flex items-start gap-2">
              <span className="text-lg leading-none">⚠️</span>
              <span>{serviceError}</span>
            </div>
          )}

          {serviceAvailable === false && !serviceError && (
            <div className="bg-yellow-50/20 border border-yellow-200/50 rounded-md p-3.5 text-sm text-yellow-600 flex items-start gap-2">
              <span className="text-lg leading-none">⚠️</span>
              <span>Training service is not available. The run will be created but the job may not launch.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setShowSweepModal(true)}
              disabled={!envSpec}
              className="px-5 py-2.5 border border-purple-300/50 text-purple-600 rounded-md hover:bg-purple-50/10 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hyperparameter Sweep
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-input rounded-md hover:bg-muted transition-colors text-sm font-medium text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm hover:shadow"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Launching...
                </span>
              ) : (
                'Launch Training'
              )}
            </button>
          </div>
        </form>

        {showSweepModal && envSpec && (
          <HyperparameterSweepModal
            envSpec={envSpec}
            envId={envId}
            onClose={() => setShowSweepModal(false)}
            onLaunchSweep={async (trials) => {
              // Launch multiple training runs for each trial
              // This is a simplified version - in production, you'd want to batch these
              alert(`Would launch ${trials.length} training runs. This feature requires backend support for batch job creation.`)
              setShowSweepModal(false)
            }}
          />
        )}
      </div>
    </div>
  )
}
