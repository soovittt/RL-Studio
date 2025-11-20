/**
 * Asset Client - Connects to backend Asset Service
 * Handles asset library operations
 */

// Get backend service URL
const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_ROLLOUT_SERVICE_URL
  
  if (envUrl) {
    return envUrl
  }
  
  // Default to localhost in development
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  
  throw new Error('VITE_API_URL or VITE_ROLLOUT_SERVICE_URL must be set')
}

export interface Asset {
  _id: string
  projectId?: string
  assetTypeId: string
  name: string
  slug?: string
  thumbnailUrl?: string
  modelUrl?: string
  geometry?: {
    primitive: 'rectangle' | 'box' | 'sphere' | 'cylinder' | 'curve'
    params: Record<string, any>
  }
  visualProfile: Record<string, any>
  physicsProfile: Record<string, any>
  behaviorProfile: Record<string, any>
  meta: {
    tags?: string[]
    mode?: string
    paletteColor?: string
    labelColor?: string
    palette?: 'primary' | 'secondary'
    [key: string]: any
  }
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface CreateAssetRequest {
  projectId?: string
  assetTypeKey: string
  name: string
  slug?: string
  thumbnailUrl?: string
  modelUrl?: string
  visualProfile?: Record<string, any>
  physicsProfile?: Record<string, any>
  behaviorProfile?: Record<string, any>
  meta?: Record<string, any>
}

/**
 * List assets with optional filters
 */
export async function listAssets(params?: {
  projectId?: string
  assetType?: string
  mode?: string
  tag?: string
}): Promise<Asset[]> {
  const searchParams = new URLSearchParams()
  if (params?.projectId) searchParams.append('project_id', params.projectId)
  if (params?.assetType) searchParams.append('asset_type', params.assetType)
  if (params?.mode) searchParams.append('mode', params.mode)
  if (params?.tag) searchParams.append('tag', params.tag)
  
  const queryString = searchParams.toString()
  const url = `${getBackendUrl()}/api/assets${queryString ? `?${queryString}` : ''}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list assets' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Get asset by ID
 */
export async function getAsset(assetId: string): Promise<Asset> {
  const response = await fetch(`${getBackendUrl()}/api/assets/${assetId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get asset' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

/**
 * Create a new asset
 */
export async function createAsset(request: CreateAssetRequest): Promise<{ id: string; name: string }> {
  const response = await fetch(`${getBackendUrl()}/api/assets/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create asset' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  
  return response.json()
}

