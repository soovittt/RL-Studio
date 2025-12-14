/**
 * Scene Client - Connects to backend Scene Service via GraphQL
 * Handles scene and scene version CRUD operations
 */

import { query, mutate } from './graphqlClient'

// Note: All operations now use GraphQL - no REST endpoints needed

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
 * Get scene by projectId (environment ID) - finds scene that belongs to an environment
 * This is needed because environments have their own ID, but scenes reference them via projectId
 */
export async function getSceneByProjectId(
  projectId: string
): Promise<{ scene: Scene; activeVersion: SceneVersion | null } | null> {
  try {
    // Import Convex HTTP client
    const convexModule = await import('./convex')
    // Access the httpClient - it's not exported, so we need to use the api object
    const { api: convexApi } = await import('../../convex/_generated/api')
    
    // Use the Convex HTTP client via the api object
    // We need to query scenes:listByProject
    const convexUrl = import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_CONVEX_DEV_URL || ''
    if (!convexUrl) {
      console.warn('Convex URL not configured')
      return null
    }
    
    // Query Convex HTTP API directly
    const response = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'scenes:listByProject',
        args: { projectId },
      }),
    })
    
    const result = await response.json()
    
    if (result.status === 'error') {
      console.warn('Failed to find scene by projectId:', result.errorMessage)
      return null
    }
    
    const scenes = result.status === 'success' ? result.value : result
    
    if (!scenes || scenes.length === 0) {
      return null
    }
    
    // Get the first scene (there should only be one per project)
    const sceneData = scenes[0]
    
    // Now get the full scene with active version using the scene ID
    return await getScene(sceneData._id)
  } catch (error) {
    console.warn('Failed to get scene by projectId:', error)
    return null
  }
}

/**
 * Get scene with active version via GraphQL
 * Note: GraphQL only returns scene data, activeVersion is still fetched via REST
 */
export async function getScene(
  sceneId: string
): Promise<{ scene: Scene; activeVersion: SceneVersion | null }> {
  const gqlQuery = `
    query GetScene($id: String!) {
      scene(id: $id) {
        id
        name
        envSpec
        createdAt
        updatedAt
        createdBy
      }
    }
  `

  try {
    const data = await query<{ scene: any }>(gqlQuery, { id: sceneId })

    if (!data?.scene) {
      throw new Error('Scene not found')
    }

    const sceneData = data.scene
    const envSpec = sceneData.envSpec ? JSON.parse(sceneData.envSpec) : {}

    // Convert GraphQL response to Scene interface
    const scene: Scene = {
      _id: sceneData.id,
      projectId: '', // GraphQL doesn't return this yet
      name: sceneData.name,
      mode: envSpec.mode || 'grid', // Extract from envSpec
      environmentSettings: envSpec,
      createdBy: sceneData.createdBy || '',
      createdAt: sceneData.createdAt ? new Date(sceneData.createdAt).getTime() : Date.now(),
      updatedAt: sceneData.updatedAt ? new Date(sceneData.updatedAt).getTime() : Date.now(),
    }

    // Fetch active version via GraphQL
    let activeVersion: SceneVersion | null = null
    try {
      // Try to get the first version (active version is typically version 1)
      const versionData = await getSceneVersion(sceneId, 1)
      if (versionData) {
        activeVersion = {
          _id: '',
          sceneId,
          versionNumber: 1,
          sceneGraph: versionData.sceneGraph,
          rlConfig: versionData.rlConfig,
          createdBy: '',
          createdAt: Date.now(),
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active version:', err)
    }

    return { scene, activeVersion }
  } catch (error) {
    console.error('Failed to get scene via GraphQL:', error)
    throw error
  }
}

/**
 * Create a new scene via GraphQL
 */
export async function createScene(
  request: CreateSceneRequest
): Promise<{ id: string; name: string }> {
  const gqlMutation = `
    mutation CreateScene($input: CreateSceneInput!) {
      createScene(input: $input) {
        id
        name
      }
    }
  `

  const variables = {
    input: {
      projectId: request.projectId || null, // Convert undefined/empty string to null for GraphQL
      name: request.name,
      description: request.description,
      mode: request.mode,
      // GraphQL JSON scalar expects a dict/object, not a string
      // The GraphQL client will handle serialization automatically
      environmentSettings: request.environmentSettings || {},
      createdBy: request.createdBy,
    },
  }

  try {
    const data = await mutate<{ createScene: { id: string; name: string } }>(gqlMutation, variables)

    if (!data?.createScene) {
      throw new Error('Failed to create scene')
    }

    return {
      id: data.createScene.id,
      name: data.createScene.name,
    }
  } catch (error) {
    console.error('Failed to create scene via GraphQL:', error)
    throw error
  }
}

/**
 * Update scene metadata via GraphQL
 */
export async function updateScene(
  sceneId: string,
  request: UpdateSceneRequest
): Promise<{ success: boolean }> {
  const gqlMutation = `
    mutation UpdateScene($id: String!, $input: UpdateSceneInput!) {
      updateScene(id: $id, input: $input) {
        id
        name
      }
    }
  `

  const variables = {
    id: sceneId,
    input: {
      name: request.name,
      description: request.description,
      mode: request.mode,
      // GraphQL JSON scalar expects a dict/object, not a string
      // The GraphQL client will handle serialization automatically
      environmentSettings: request.environmentSettings || undefined,
      projectId: request.projectId,
    },
  }

  try {
    await mutate(gqlMutation, variables)
    return { success: true }
  } catch (error) {
    console.error('Failed to update scene via GraphQL:', error)
    throw error
  }
}

/**
 * Create a new scene version via GraphQL
 */
export async function createSceneVersion(
  sceneId: string,
  request: CreateSceneVersionRequest
): Promise<{ id: string; sceneId: string }> {
  const gqlMutation = `
    mutation CreateSceneVersion($sceneId: String!, $input: CreateSceneVersionInput!) {
      createSceneVersion(sceneId: $sceneId, input: $input) {
        id
        sceneId
      }
    }
  `

  const variables = {
    sceneId,
    input: {
      sceneGraph: JSON.stringify(request.sceneGraph),
      rlConfig: JSON.stringify(request.rlConfig),
      createdBy: request.createdBy,
    },
  }

  try {
    const data = await mutate<{ createSceneVersion: { id: string; sceneId: string } }>(
      gqlMutation,
      variables
    )

    if (!data?.createSceneVersion) {
      throw new Error('Failed to create scene version')
    }

    return data.createSceneVersion
  } catch (error) {
    console.error('Failed to create scene version via GraphQL:', error)
    throw error
  }
}

/**
 * Get a specific scene version via GraphQL
 */
export async function getSceneVersion(
  sceneId: string,
  versionNumber: number
): Promise<{ sceneGraph: SceneVersion['sceneGraph']; rlConfig: SceneVersion['rlConfig'] }> {
  const gqlQuery = `
    query GetSceneVersion($sceneId: String!, $versionNumber: Int!) {
      sceneVersion(sceneId: $sceneId, versionNumber: $versionNumber) {
        sceneGraph
        rlConfig
      }
    }
  `

  try {
    const data = await query<{ sceneVersion: { sceneGraph: any; rlConfig: any } }>(gqlQuery, {
      sceneId,
      versionNumber,
    })

    if (!data?.sceneVersion) {
      throw new Error('Scene version not found')
    }

    return {
      sceneGraph: data.sceneVersion.sceneGraph,
      rlConfig: data.sceneVersion.rlConfig,
    }
  } catch (error) {
    console.error('Failed to get scene version via GraphQL:', error)
    throw error
  }
}

/**
 * List all versions for a scene via GraphQL
 */
export async function listSceneVersions(sceneId: string): Promise<{ versions: SceneVersion[] }> {
  const gqlQuery = `
    query ListSceneVersions($sceneId: String!) {
      sceneVersions(sceneId: $sceneId) {
        _id
        sceneId
        versionNumber
        sceneGraph
        rlConfig
        createdBy
        createdAt
      }
    }
  `

  try {
    const data = await query<{ sceneVersions: any[] }>(gqlQuery, { sceneId })

    if (!data?.sceneVersions) {
      return { versions: [] }
    }

    // Convert GraphQL response to SceneVersion interface
    const versions: SceneVersion[] = data.sceneVersions.map((v: any) => ({
      _id: v._id,
      sceneId: v.sceneId,
      versionNumber: v.versionNumber,
      sceneGraph: v.sceneGraph,
      rlConfig: v.rlConfig,
      createdBy: v.createdBy,
      createdAt: v.createdAt ? new Date(v.createdAt).getTime() : Date.now(),
    }))

    return { versions }
  } catch (error) {
    console.error('Failed to list scene versions via GraphQL:', error)
    throw error
  }
}
