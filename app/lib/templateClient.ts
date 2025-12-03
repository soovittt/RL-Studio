/**
 * Template Client - Connects to backend Template Service
 * Handles template listing and instantiation
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

export interface Template {
  _id: string
  name: string
  description?: string
  sceneVersionId: string
  category?: string
  tags: string[]
  meta?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
    taskFamily?: string
    primaryUseCases?: string[]
    supportedAlgos?: string[]
    supportsMultiAgent?: boolean
    mode?: string
    [key: string]: any
  }
  isPublic: boolean
  createdBy: string
  createdAt: number
}

export interface TemplateWithVersion extends Template {
  sceneVersion: {
    sceneGraph: any
    rlConfig: any
  }
}

export interface InstantiateTemplateRequest {
  templateId: string
  projectId: string
  name?: string
}

/**
 * List templates with optional filters
 */
export async function listTemplates(params?: {
  mode?: string
  category?: string
  isPublic?: boolean
}): Promise<Template[]> {
  const searchParams = new URLSearchParams()
  if (params?.mode) searchParams.append('mode', params.mode)
  if (params?.category) searchParams.append('category', params.category)
  if (params?.isPublic !== undefined) searchParams.append('is_public', String(params.isPublic))

  const queryString = searchParams.toString()
  const url = `${getBackendUrl()}/api/templates${queryString ? `?${queryString}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to list templates' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Get template by ID with scene version
 */
export async function getTemplate(templateId: string): Promise<TemplateWithVersion> {
  const response = await fetch(`${getBackendUrl()}/api/templates/${templateId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get template' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Instantiate a template into a new scene
 */
export async function instantiateTemplate(
  request: InstantiateTemplateRequest
): Promise<{ sceneId: string; versionId: string }> {
  const response = await fetch(
    `${getBackendUrl()}/api/templates/${request.templateId}/instantiate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: request.projectId,
        name: request.name,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to instantiate template' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}
