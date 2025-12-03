/**
 * Client for code generation API
 * Generates production-ready code based on actual environment configuration
 */

// Get backend API URL with proper local vs production handling
const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL

  // If explicitly set, use it
  if (envUrl) {
    return envUrl
  }

  // In production, warn if not set (should be set)
  if (import.meta.env.MODE === 'production') {
    console.warn(
      '⚠️ VITE_API_URL is not set in production. Defaulting to localhost:8000. ' +
        'Please set your production backend URL in environment variables.'
    )
  }

  // Default to localhost for local development
  return 'http://localhost:8000'
}

const API_URL = getBackendUrl()

export interface GenerateCodeRequest {
  env_spec: any
  file_type: 'environment' | 'training' | 'config' | 'skypilot' | 'readme' | 'env_spec'
  training_config?: {
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
    num_runs?: number
    run_id?: string
  }
  algorithm?: 'ppo' | 'dqn'
}

export interface GenerateCodeResponse {
  success: boolean
  code?: string
  error?: string
  file_name?: string
}

export interface GenerateAllFilesResponse {
  [fileName: string]: string
}

/**
 * Generate a single code file
 */
export async function generateCode(request: GenerateCodeRequest): Promise<GenerateCodeResponse> {
  try {
    const response = await fetch(`${API_URL}/api/codegen/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Code generation failed:', error)
    throw error
  }
}

/**
 * Generate all code files at once
 */
export async function generateAllFiles(
  envSpec: any,
  trainingConfig?: GenerateCodeRequest['training_config'],
  algorithm: 'ppo' | 'dqn' = 'ppo'
): Promise<GenerateAllFilesResponse> {
  try {
    const response = await fetch(`${API_URL}/api/codegen/generate-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        env_spec: envSpec,
        training_config: trainingConfig,
        algorithm,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Code generation failed:', error)
    throw error
  }
}

/**
 * Get file name mapping for code view dropdown
 */
export function getFileTypeMapping(): Record<string, string> {
  return {
    'environment.py': 'environment',
    'train.py': 'training',
    'config.yaml': 'config',
    'skypilot.yaml': 'skypilot',
    'README.md': 'readme',
    'env_spec.json': 'env_spec',
  }
}

/**
 * Get display name for file type
 */
export function getFileDisplayName(fileType: string): string {
  const mapping: Record<string, string> = {
    environment: 'Environment (Python)',
    training: 'Training Script',
    config: 'Config YAML',
    skypilot: 'SkyPilot YAML',
    readme: 'README',
    env_spec: 'EnvSpec JSON',
  }
  return mapping[fileType] || fileType
}

/**
 * Save edited code to backend
 */
export interface SaveCodeRequest {
  env_spec: any
  file_type: string
  code: string
  file_name: string
  training_config?: GenerateCodeRequest['training_config']
  algorithm?: string
}

export interface SaveCodeResponse {
  success: boolean
  error?: string
}

export async function saveCode(request: SaveCodeRequest): Promise<SaveCodeResponse> {
  try {
    const response = await fetch(`${API_URL}/api/codegen/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Code save failed:', error)
    throw error
  }
}
