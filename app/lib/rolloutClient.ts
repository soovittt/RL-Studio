/**
 * Rollout Client - Connects to Python backend rollout service via GraphQL
 * Supports both GraphQL (HTTP) and WebSocket for real-time streaming
 */

import { mutate, query } from './graphqlClient'

export interface RolloutRequest {
  envSpec: any
  policy: 'random' | 'greedy' | 'trained_model'
  maxSteps: number
  stream?: boolean
  runId?: string // For trained_model policy
  modelUrl?: string // Alternative to runId
}

export interface RolloutResponse {
  success: boolean
  result?: {
    steps: Array<{
      state: {
        agents: Array<{ id: string; position: [number, number] }>
        objects: any[]
        step: number
        totalReward: number
        done: boolean
        info: {
          events: string[]
          rewards: Array<{ ruleId: string; value: number; reason: string }>
        }
      }
      action: string | number[]
      reward: number
      done: boolean
    }>
    totalReward: number
    episodeLength: number
    success: boolean
    terminationReason?: string
  }
  error?: string
  executionTime?: number
}

/**
 * Run rollout via GraphQL (returns complete result)
 */
export async function runRolloutHTTP(request: RolloutRequest): Promise<RolloutResponse> {
  const gqlMutation = `
    mutation RunRollout($input: RolloutInput!) {
      runRollout(input: $input) {
        success
        totalReward
        episodeLength
        terminationReason
        executionTime
        error
        steps {
          stepNumber
          state
          action
          reward
          done
          info
        }
      }
    }
  `

  try {
    const variables = {
      input: {
        envSpec: JSON.stringify(request.envSpec),
        policy: request.policy,
        maxSteps: request.maxSteps,
        runId: request.runId || null,
        modelUrl: request.modelUrl || null,
        batchSize: 1,
        useParallel: false,
      },
    }

    const data = await mutate<{ runRollout: any }>(gqlMutation, variables)

    if (!data?.runRollout) {
      throw new Error('Failed to run rollout')
    }

    const result = data.runRollout

    // Parse JSON string fields from GraphQL response
    const steps =
      result.steps?.map((step: any) => {
        const state = step.state ? JSON.parse(step.state) : {}
        const info = step.info ? JSON.parse(step.info) : {}

        return {
          state,
          action: step.action,
          reward: step.reward,
          done: step.done,
          info,
        }
      }) || []

    return {
      success: result.success,
      result: {
        steps,
        totalReward: result.totalReward,
        episodeLength: result.episodeLength,
        success: result.success,
        terminationReason: result.terminationReason,
      },
      error: result.error || undefined,
      executionTime: result.executionTime || undefined,
    }
  } catch (error) {
    console.error('Rollout GraphQL request failed:', error)
    throw error
  }
}

/**
 * Run rollout via WebSocket (streams results in real-time)
 * Note: WebSocket is not available via GraphQL, so this still uses REST API
 */
export function runRolloutWebSocket(
  request: RolloutRequest,
  callbacks: {
    onStep?: (step: any) => void
    onComplete?: (result: any) => void
    onError?: (error: Error) => void
  }
): () => void {
  // Get backend URL for WebSocket (still using REST endpoint)
  const getBackendUrl = (): string => {
    const envUrl = import.meta.env.VITE_ROLLOUT_SERVICE_URL
    return envUrl || 'http://localhost:8000'
  }

  const ROLLOUT_SERVICE_URL = getBackendUrl()
  const wsUrl = ROLLOUT_SERVICE_URL.replace('http://', 'ws://').replace('https://', 'wss://')
  const ws = new WebSocket(`${wsUrl}/ws/rollout`)

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        envSpec: request.envSpec,
        policy: request.policy,
        maxSteps: request.maxSteps,
        stream: true,
        ...(request.runId && { runId: request.runId }),
        ...(request.modelUrl && { modelUrl: request.modelUrl }),
      })
    )
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'started') {
        console.log('Rollout started:', data)
      } else if (data.type === 'step') {
        if (callbacks.onStep) {
          callbacks.onStep(data.step)
        }
      } else if (data.type === 'complete') {
        if (callbacks.onComplete) {
          callbacks.onComplete(data.result)
        }
        ws.close()
      } else if (data.type === 'error') {
        const error = new Error(data.error || 'Unknown error')
        if (callbacks.onError) {
          callbacks.onError(error)
        }
        ws.close()
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
      if (callbacks.onError) {
        callbacks.onError(error as Error)
      }
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
    if (callbacks.onError) {
      callbacks.onError(new Error('WebSocket connection failed'))
    }
  }

  ws.onclose = () => {
    console.log('WebSocket closed')
  }

  // Return cleanup function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  }
}

/**
 * Check if rollout service is available via GraphQL health query
 */
export async function checkRolloutServiceHealth(): Promise<boolean> {
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

/**
 * Load rollout data from S3
 */
export async function loadRolloutFromS3(s3Url: string): Promise<RolloutResponse> {
  const getBackendUrl = (): string => {
    // Prioritize localhost in development mode
    if (import.meta.env.MODE === 'development') {
      return 'http://localhost:8000'
    }

    const envUrl =
      import.meta.env.VITE_TRAINING_SERVICE_URL ||
      import.meta.env.VITE_ROLLOUT_SERVICE_URL ||
      import.meta.env.VITE_BACKEND_URL

    return envUrl || 'http://localhost:8000'
  }

  const BACKEND_URL = getBackendUrl()

  try {
    const response = await fetch(`${BACKEND_URL}/rollout/load-from-s3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ s3Url }),
    })

    if (!response.ok) {
      throw new Error(`Failed to load rollout: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success || !data.result) {
      throw new Error(data.error || 'Failed to load rollout from S3')
    }

    return {
      success: true,
      result: data.result,
      error: undefined,
      executionTime: undefined,
    }
  } catch (error) {
    console.error('Failed to load rollout from S3:', error)
    throw error
  }
}
