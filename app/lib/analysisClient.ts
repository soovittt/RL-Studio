/**
 * Client for RL analysis API endpoints
 * REAL Python backend calculations - NO FALLBACKS
 */

// Get backend service URL with proper local vs production handling
const getBackendUrl = (): string => {
  // In development mode, prioritize localhost
  const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV

  // Try multiple environment variables for backend URL
  const envUrl =
    import.meta.env.VITE_TRAINING_SERVICE_URL ||
    import.meta.env.VITE_ROLLOUT_SERVICE_URL ||
    import.meta.env.VITE_BACKEND_URL

  // In development mode, check if env URL is localhost - if not, use localhost
  if (isDevelopment) {
    if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      // Use the env URL if it's already localhost
      return envUrl
    }
    // Force localhost in development, even if env var is set to production
    console.log('🔧 Development mode: Using localhost:8000 for backend (ignoring production URL)')
    return 'http://localhost:8000'
  }

  // In production, use env URL if set, otherwise warn
  if (envUrl) {
    return envUrl
  }

  // Production but no URL set - warn and default to localhost (shouldn't happen in production)
  console.warn(
    '⚠️ Backend URL not set in production. Check VITE_TRAINING_SERVICE_URL, VITE_ROLLOUT_SERVICE_URL, or VITE_BACKEND_URL. ' +
      'Defaulting to localhost:8000.'
  )
  return 'http://localhost:8000'
}

const ANALYSIS_SERVICE_URL = getBackendUrl()
const WS_URL = ANALYSIS_SERVICE_URL.replace('http://', 'ws://').replace('https://', 'wss://')

export interface AnalyzeRolloutRequest {
  rollout_steps: Array<{
    state: any
    action: any
    reward: number
    done: boolean
  }>
  env_spec: any
}

export interface RewardAnalysis {
  per_rule_stats: Record<
    string,
    {
      total: number
      mean: number
      std: number
      min: number
      max: number
      fire_count: number
      fire_rate: number
    }
  >
  most_active_rules: Array<[string, number]>
  cumulative_contributions: Record<string, number[]>
  heatmap_data: Array<{
    step: number
    rule: string
    value: number
  }>
  episode_total: number
  episode_length: number
  reward_density: number
  warnings: string[]
}

export interface TrajectoryAnalysis {
  trajectory_path: Array<{
    step: number
    position: [number, number]
    action: any
    reward: number
  }>
  action_state_pairs: Array<{
    action: any
    state: [number, number]
    step: number
  }>
  action_distribution: Record<string, number>
  policy_entropy: number
  trajectory_length: number
  path_efficiency: number
  oscillation_detection: {
    detected: boolean
    oscillation_count: number
    oscillation_rate: number
  }
  suboptimal_attractors: Array<{
    position: [number, number]
    visit_count: number
    steps: number[]
  }>
}

export interface TerminationAnalysis {
  terminated: boolean
  reason?: string
  step?: number
  episode_length?: number
}

export interface TerminationAnalysisMultiple {
  termination_counts: Record<string, number>
  top_causes: Array<[string, number]>
  heatmap_data: Array<{
    reason: string
    mean_step: number
    std_step: number
    min_step: number
    max_step: number
    count: number
  }>
  conflicting_rules: Array<{
    rule: string
    frequency: number
    conflict_with: string[]
  }>
  premature_terminations: Array<{
    reason: string
    count: number
    mean_step: number
    threshold: number
  }>
  late_terminations: Array<{
    reason: string
    count: number
    mean_step: number
    threshold: number
  }>
}

export async function analyzeReward(request: AnalyzeRolloutRequest): Promise<RewardAnalysis> {
  try {
    const response = await fetch(`${ANALYSIS_SERVICE_URL}/api/analysis/reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend error (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    if (!data.analysis) {
      throw new Error('Backend returned invalid response: missing analysis data')
    }
    return data.analysis
  } catch (error) {
    console.error('❌ Reward analysis failed - Backend required:', error)
    throw new Error(
      `Backend unavailable. Real Python calculations required. ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function analyzeRewardStreaming(
  request: AnalyzeRolloutRequest,
  callbacks: {
    onProgress?: (progress: number, message: string) => void
    onComplete?: (analysis: RewardAnalysis) => void
    onError?: (error: Error) => void
  }
): () => void {
  let ws: WebSocket | null = null
  let timeoutId: NodeJS.Timeout | null = null
  let connectionTimeoutId: NodeJS.Timeout | null = null
  let isCleanedUp = false

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
    }
    isCleanedUp = true
  }

  // Fallback to HTTP if WebSocket fails
  const fallbackToHTTP = async () => {
    if (isCleanedUp) return
    try {
      callbacks.onProgress?.(0.1, 'WebSocket unavailable, using HTTP fallback...')
      const analysis = await analyzeReward(request)
      callbacks.onComplete?.(analysis)
    } catch (error) {
      callbacks.onError?.(
        new Error(
          `Backend analysis failed: ${error instanceof Error ? error.message : String(error)}. ` +
            `Make sure the backend is running at ${ANALYSIS_SERVICE_URL}`
        )
      )
    }
  }

  try {
    ws = new WebSocket(`${WS_URL}/api/analysis/ws/reward`)

    // Connection timeout (5 seconds)
    connectionTimeoutId = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        console.warn('⚠️ WebSocket connection timeout, falling back to HTTP')
        ws.close()
        fallbackToHTTP()
      }
    }, 5000)

    // Overall timeout (30 seconds)
    timeoutId = setTimeout(() => {
      if (!isCleanedUp) {
        console.warn('⚠️ Analysis timeout after 30 seconds')
        cleanup()
        callbacks.onError?.(
          new Error(
            'Analysis timed out after 30 seconds. The backend might be slow or unresponsive. ' +
              `Backend URL: ${ANALYSIS_SERVICE_URL}`
          )
        )
      }
    }, 30000)

    ws.onopen = () => {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      if (isCleanedUp) {
        ws?.close()
        return
      }
      ws?.send(JSON.stringify(request))
    }

    ws.onmessage = (event) => {
      if (isCleanedUp) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'started') {
          callbacks.onProgress?.(0, data.message || 'Starting analysis...')
        } else if (data.type === 'progress') {
          callbacks.onProgress?.(data.progress || 0, data.message || 'Processing...')
        } else if (data.type === 'complete') {
          if (timeoutId) clearTimeout(timeoutId)
          callbacks.onComplete?.(data.analysis)
          cleanup()
        } else if (data.type === 'error') {
          if (timeoutId) clearTimeout(timeoutId)
          callbacks.onError?.(new Error(data.error || 'Analysis failed'))
          cleanup()
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)
        callbacks.onError?.(new Error('Failed to parse WebSocket message'))
        cleanup()
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      // Don't call onError here if we're already trying HTTP fallback
      if (ws?.readyState === WebSocket.CONNECTING) {
        fallbackToHTTP()
      } else {
        callbacks.onError?.(
          new Error(
            `WebSocket connection failed. Backend may not be running at ${ANALYSIS_SERVICE_URL}. ` +
              `Trying HTTP fallback...`
          )
        )
        fallbackToHTTP()
      }
    }

    ws.onclose = (event) => {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      // Only error if it wasn't a normal close and we haven't completed
      if (event.code !== 1000 && !isCleanedUp && ws?.readyState !== WebSocket.CLOSING) {
        // If we haven't received completion, try HTTP fallback
        if (timeoutId) {
          fallbackToHTTP()
        }
      }
    }
  } catch (error) {
    if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
    console.error('Failed to create WebSocket:', error)
    fallbackToHTTP()
  }

  return cleanup
}

export async function analyzeTrajectory(
  request: AnalyzeRolloutRequest
): Promise<TrajectoryAnalysis> {
  try {
    const response = await fetch(`${ANALYSIS_SERVICE_URL}/api/analysis/trajectory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend error (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    if (!data.analysis) {
      throw new Error('Backend returned invalid response: missing analysis data')
    }
    return data.analysis
  } catch (error) {
    console.error('❌ Trajectory analysis failed - Backend required:', error)
    throw new Error(
      `Backend unavailable. Real Python calculations required. ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function analyzeTrajectoryStreaming(
  request: AnalyzeRolloutRequest,
  callbacks: {
    onProgress?: (progress: number, message: string) => void
    onComplete?: (analysis: TrajectoryAnalysis) => void
    onError?: (error: Error) => void
  }
): () => void {
  let ws: WebSocket | null = null
  let timeoutId: NodeJS.Timeout | null = null
  let connectionTimeoutId: NodeJS.Timeout | null = null
  let isCleanedUp = false

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close()
    }
    isCleanedUp = true
  }

  // Fallback to HTTP if WebSocket fails
  const fallbackToHTTP = async () => {
    if (isCleanedUp) return
    try {
      callbacks.onProgress?.(0.1, 'WebSocket unavailable, using HTTP fallback...')
      const analysis = await analyzeTrajectory(request)
      callbacks.onComplete?.(analysis)
    } catch (error) {
      callbacks.onError?.(
        new Error(
          `Backend analysis failed: ${error instanceof Error ? error.message : String(error)}. ` +
            `Make sure the backend is running at ${ANALYSIS_SERVICE_URL}`
        )
      )
    }
  }

  try {
    ws = new WebSocket(`${WS_URL}/api/analysis/ws/trajectory`)

    // Connection timeout (5 seconds)
    connectionTimeoutId = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        console.warn('⚠️ WebSocket connection timeout, falling back to HTTP')
        ws.close()
        fallbackToHTTP()
      }
    }, 5000)

    // Overall timeout (30 seconds)
    timeoutId = setTimeout(() => {
      if (!isCleanedUp) {
        console.warn('⚠️ Analysis timeout after 30 seconds')
        cleanup()
        callbacks.onError?.(
          new Error(
            'Analysis timed out after 30 seconds. The backend might be slow or unresponsive. ' +
              `Backend URL: ${ANALYSIS_SERVICE_URL}`
          )
        )
      }
    }, 30000)

    ws.onopen = () => {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      if (isCleanedUp) {
        ws?.close()
        return
      }
      ws?.send(JSON.stringify(request))
    }

    ws.onmessage = (event) => {
      if (isCleanedUp) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'started') {
          callbacks.onProgress?.(0, data.message || 'Starting trajectory analysis...')
        } else if (data.type === 'progress') {
          callbacks.onProgress?.(data.progress || 0, data.message || 'Processing...')
        } else if (data.type === 'complete') {
          if (timeoutId) clearTimeout(timeoutId)
          callbacks.onComplete?.(data.analysis)
          cleanup()
        } else if (data.type === 'error') {
          if (timeoutId) clearTimeout(timeoutId)
          callbacks.onError?.(new Error(data.error || 'Analysis failed'))
          cleanup()
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)
        callbacks.onError?.(new Error('Failed to parse WebSocket message'))
        cleanup()
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      // Don't call onError here if we're already trying HTTP fallback
      if (ws?.readyState === WebSocket.CONNECTING) {
        fallbackToHTTP()
      } else {
        callbacks.onError?.(
          new Error(
            `WebSocket connection failed. Backend may not be running at ${ANALYSIS_SERVICE_URL}. ` +
              `Trying HTTP fallback...`
          )
        )
        fallbackToHTTP()
      }
    }

    ws.onclose = (event) => {
      if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
      // Only error if it wasn't a normal close and we haven't completed
      if (event.code !== 1000 && !isCleanedUp && ws?.readyState !== WebSocket.CLOSING) {
        // If we haven't received completion, try HTTP fallback
        if (timeoutId) {
          fallbackToHTTP()
        }
      }
    }
  } catch (error) {
    if (connectionTimeoutId) clearTimeout(connectionTimeoutId)
    console.error('Failed to create WebSocket:', error)
    fallbackToHTTP()
  }

  return cleanup
}

export async function analyzeTermination(
  request: AnalyzeRolloutRequest
): Promise<TerminationAnalysis> {
  try {
    const response = await fetch(`${ANALYSIS_SERVICE_URL}/api/analysis/termination`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data.analysis
  } catch (error) {
    console.error('Termination analysis failed:', error)
    throw error
  }
}

export async function analyzeMultipleTerminations(
  rollouts: Array<AnalyzeRolloutRequest['rollout_steps']>,
  env_spec: any
): Promise<TerminationAnalysisMultiple> {
  try {
    const response = await fetch(`${ANALYSIS_SERVICE_URL}/api/analysis/termination/multiple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rollouts, env_spec }),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Backend error (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    if (!data.analysis) {
      throw new Error('Backend returned invalid response: missing analysis data')
    }
    return data.analysis
  } catch (error) {
    console.error('❌ Termination analysis failed - Backend required:', error)
    throw new Error(
      `Backend unavailable. Real Python calculations required. ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function analyzeMultipleTerminationsStreaming(
  rollouts: Array<AnalyzeRolloutRequest['rollout_steps']>,
  env_spec: any,
  callbacks: {
    onProgress?: (progress: number, message: string) => void
    onComplete?: (analysis: TerminationAnalysisMultiple) => void
    onError?: (error: Error) => void
  }
): () => void {
  const ws = new WebSocket(`${WS_URL}/api/analysis/ws/termination/multiple`)

  ws.onopen = () => {
    ws.send(JSON.stringify({ rollouts, env_spec }))
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'started') {
        callbacks.onProgress?.(0, data.message || 'Starting termination analysis...')
      } else if (data.type === 'progress') {
        callbacks.onProgress?.(data.progress || 0, data.message || 'Processing...')
      } else if (data.type === 'complete') {
        callbacks.onComplete?.(data.analysis)
        ws.close()
      } else if (data.type === 'error') {
        callbacks.onError?.(new Error(data.error || 'Analysis failed'))
        ws.close()
      }
    } catch (error) {
      callbacks.onError?.(new Error('Failed to parse WebSocket message'))
      ws.close()
    }
  }

  ws.onerror = () => {
    callbacks.onError?.(new Error('WebSocket connection failed. Backend required.'))
  }

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  }
}
