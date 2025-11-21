/**
 * Scene Client - Connects to backend Scene Service
 * Handles scene and scene version CRUD operations
 */

// Get backend service URL with proper local vs production handling
const getBackendUrl = (): string => {
  // In development, always use localhost (ignore env vars)
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    return 'http://localhost:8000'
  }
  
  // In production, use env var if set
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_ROLLOUT_SERVICE_URL
  
  if (envUrl) {
    return envUrl
  }
  
  // In production, warn if not set but still default to localhost
  console.warn(
    '⚠️ VITE_API_URL or VITE_ROLLOUT_SERVICE_URL is not set in production. Defaulting to localhost:8000. ' +
    'Please set your production backend URL in environment variables.'
  )
  
  return 'http://localhost:8000'
}

export interface Scene {
  _id: string
  projectId: string
  name: string
  description?: string
  mode: string
  environmentSettings: Record<string, any>
  activeVersionId?: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface SceneVersion {
  _id: string
  sceneId: string
  versionNumber: number
  sceneGraph: {
    entities: Array<{
      id: string
      assetId?: string
      name?: string
      parentId?: string
      transform: {
        position: [number, number, number]
        rotation: [number, number, number]
        scale: [number, number, number]
      }
      components: Record<string, any>
    }>
    metadata: Record<string, any>
  }
  rlConfig: {
    agents: Array<any>
    rewards: Array<any>
    episode: any
  }
  createdBy: string
  createdAt: number
}

export interface CreateSceneRequest {
  projectId?: string
  name: string
  description?: string
  mode: string
  environmentSettings?: Record<string, any>
  createdBy?: string
}

export interface CreateSceneVersionRequest {
  sceneGraph: SceneVersion['sceneGraph']
  rlConfig: SceneVersion['rlConfig']
  createdBy?: string
}

export interface UpdateSceneRequest {
  name?: string
  description?: string
  mode?: string
  environmentSettings?: Record<string, any>
}

/**
 * Get scene with active version
 */
export async function getScene(sceneId: string): Promise<{ scene: Scene; activeVersion: SceneVersion | null }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes/${sceneId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get scene' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Create a new scene
 */
export async function createScene(request: CreateSceneRequest): Promise<{ id: string; name: string }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create scene' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Update scene metadata
 */
export async function updateScene(sceneId: string, request: UpdateSceneRequest): Promise<{ success: boolean }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes/${sceneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to update scene' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Create a new scene version
 */
export async function createSceneVersion(
  sceneId: string,
  request: CreateSceneVersionRequest
): Promise<{ id: string; sceneId: string }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes/${sceneId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create scene version' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Get a specific scene version
 */
export async function getSceneVersion(
  sceneId: string,
  versionNumber: number
): Promise<{ sceneGraph: SceneVersion['sceneGraph']; rlConfig: SceneVersion['rlConfig'] }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes/${sceneId}/versions/${versionNumber}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get scene version' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * List all versions for a scene
 */
export async function listSceneVersions(sceneId: string): Promise<{ versions: SceneVersion[] }> {
  const response = await fetch(`${getBackendUrl()}/api/scenes/${sceneId}/versions`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list scene versions' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

