/**
 * Training Client - Connects to Python backend training service
 * Handles job launch, status checks, and job management
 */

export interface LaunchTrainingRequest {
  runId: string
  config: {
    accelerator?: string
    metrics_interval?: number
    algorithm?: 'ppo' | 'dqn'
    hyperparams?: {
      learning_rate?: number
      gamma?: number
      steps?: number
    }
    concepts?: {
      rewardShaping?: boolean
      curriculum?: boolean
      imitation?: boolean
      explorationBonus?: boolean
    }
  }
}

export interface LaunchTrainingResponse {
  success: boolean
  jobId?: string
  error?: string
}

export interface JobStatusResponse {
  success: boolean
  status?: 'queued' | 'running' | 'completed' | 'error' | 'stopped' | 'not_found'
  jobId?: string
  error?: string
}

// Get backend service URL with proper local vs production handling
const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_ROLLOUT_SERVICE_URL
  
  // If explicitly set, use it
  if (envUrl) {
    return envUrl
  }
  
  // In production, warn if not set (should be set)
  if (import.meta.env.MODE === 'production') {
    console.warn(
      '⚠️ VITE_ROLLOUT_SERVICE_URL is not set in production. Defaulting to localhost:8000. ' +
      'Please set your production backend URL in environment variables.'
    )
  }
  
  // Default to localhost for local development
  return 'http://localhost:8000'
}

const TRAINING_SERVICE_URL = getBackendUrl()

/**
 * Launch a training job via backend API
 */
export async function launchTrainingJob(request: LaunchTrainingRequest): Promise<LaunchTrainingResponse> {
  try {
    const response = await fetch(`${TRAINING_SERVICE_URL}/api/training/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runId: request.runId,
        config: request.config,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Training launch request failed:', error)
    throw error
  }
}

/**
 * Get status of a training job
 */
export async function getTrainingJobStatus(jobId: string): Promise<JobStatusResponse> {
  try {
    const response = await fetch(`${TRAINING_SERVICE_URL}/api/training/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Training status request failed:', error)
    throw error
  }
}

/**
 * Stop a running training job
 */
export async function stopTrainingJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${TRAINING_SERVICE_URL}/api/training/stop/${jobId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Training stop request failed:', error)
    throw error
  }
}

/**
 * Check if training service is available
 */
export async function checkTrainingServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${TRAINING_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    return response.ok
  } catch {
    return false
  }
}

