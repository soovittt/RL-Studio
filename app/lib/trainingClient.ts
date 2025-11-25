/**
 * Training Client - Connects to Python backend training service via GraphQL
 * Handles job launch, status checks, and job management
 */

import { query, mutate } from './graphqlClient'

export interface LaunchTrainingRequest {
  runId: string
  envSpec?: any // Required for GraphQL, optional for backward compatibility
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
    training_config?: any
    use_spot?: boolean
    use_managed_jobs?: boolean
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

/**
 * Launch a training job via GraphQL
 */
export async function launchTrainingJob(request: LaunchTrainingRequest): Promise<LaunchTrainingResponse> {
  if (!request.envSpec) {
    throw new Error('envSpec is required for GraphQL training launch')
  }

  const gqlMutation = `
    mutation LaunchTraining($input: TrainingRunInput!) {
      launchTraining(input: $input) {
        id
        runId
        status {
          status
          jobId
          progress
          metadata
          logs
          error
        }
      }
    }
  `

  try {
    const variables = {
      input: {
        run_id: request.runId,
        env_spec: JSON.stringify(request.envSpec),
        config: JSON.stringify(request.config),
        use_managed_jobs: request.config.use_managed_jobs ?? true,
      },
    }

    const data = await mutate<{ launchTraining: any }>(gqlMutation, variables)

    if (!data?.launchTraining) {
      throw new Error('Failed to launch training job')
    }

    const result = data.launchTraining
    const jobId = result.status?.jobId

    return {
      success: !!jobId,
      jobId: jobId || undefined,
      error: result.status?.error || (!jobId ? 'No job ID returned' : undefined),
    }
  } catch (error) {
    console.error('Training launch request failed:', error)
    throw error
  }
}

/**
 * Get status of a training job via GraphQL
 */
export async function getTrainingJobStatus(jobId: string): Promise<JobStatusResponse> {
  const gqlQuery = `
    query GetTrainingStatus($jobId: String!) {
      trainingStatus(jobId: $jobId) {
        status
        jobId
        progress
        metadata
        logs
        error
      }
    }
  `

  try {
    const data = await query<{ trainingStatus: any }>(gqlQuery, { jobId })

    if (!data?.trainingStatus) {
      return {
        success: false,
        status: 'not_found',
        error: 'Job not found',
      }
    }

    const status = data.trainingStatus
    const statusMap: Record<string, 'queued' | 'running' | 'completed' | 'error' | 'stopped' | 'not_found'> = {
      PENDING: 'queued',
      RUNNING: 'running',
      SUCCEEDED: 'completed',
      FAILED: 'error',
      STOPPED: 'stopped',
    }

    return {
      success: true,
      status: statusMap[status.status] || 'not_found',
      jobId: status.jobId,
      error: status.error || undefined,
    }
  } catch (error) {
    console.error('Training status request failed:', error)
    throw error
  }
}

/**
 * Stop a running training job via GraphQL
 */
export async function stopTrainingJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const gqlMutation = `
    mutation StopTraining($jobId: String!) {
      stopTraining(jobId: $jobId)
    }
  `

  try {
    const data = await mutate<{ stopTraining: boolean }>(gqlMutation, { jobId })

    return {
      success: data?.stopTraining ?? false,
      error: data?.stopTraining ? undefined : 'Failed to stop training job',
    }
  } catch (error) {
    console.error('Training stop request failed:', error)
    throw error
  }
}

/**
 * Check if training service is available via GraphQL health query
 */
export async function checkTrainingServiceHealth(): Promise<boolean> {
  const gqlQuery = `
    query Health {
      health {
        status
      }
    }
  `

  try {
    const data = await query<{ health: { status: string } }>(gqlQuery)
    return data?.health?.status === 'healthy'
  } catch {
    return false
  }
}

