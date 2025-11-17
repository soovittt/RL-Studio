/**
 * Rollout Client - Connects to Python backend rollout service
 * Supports both HTTP and WebSocket for real-time streaming
 */

export interface RolloutRequest {
  envSpec: any
  policy: 'random' | 'greedy'
  maxSteps: number
  stream?: boolean
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

const ROLLOUT_SERVICE_URL = import.meta.env.VITE_ROLLOUT_SERVICE_URL || 'http://localhost:8000'

/**
 * Run rollout via HTTP (returns complete result)
 */
export async function runRolloutHTTP(request: RolloutRequest): Promise<RolloutResponse> {
  try {
    const response = await fetch(`${ROLLOUT_SERVICE_URL}/api/rollout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        envSpec: request.envSpec,
        policy: request.policy,
        maxSteps: request.maxSteps,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Rollout HTTP request failed:', error)
    throw error
  }
}

/**
 * Run rollout via WebSocket (streams results in real-time)
 */
export function runRolloutWebSocket(
  request: RolloutRequest,
  callbacks: {
    onStep?: (step: any) => void
    onComplete?: (result: any) => void
    onError?: (error: Error) => void
  }
): () => void {
  const wsUrl = ROLLOUT_SERVICE_URL.replace('http://', 'ws://').replace('https://', 'wss://')
  const ws = new WebSocket(`${wsUrl}/ws/rollout`)

  ws.onopen = () => {
    ws.send(JSON.stringify({
      envSpec: request.envSpec,
      policy: request.policy,
      maxSteps: request.maxSteps,
      stream: true,
    }))
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
 * Check if rollout service is available
 */
export async function checkRolloutServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ROLLOUT_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    return response.ok
  } catch {
    return false
  }
}

