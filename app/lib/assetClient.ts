/**
 * Asset Client - Connects to backend Asset Service via GraphQL
 * Handles asset library operations
 */

import { query, mutate } from './graphqlClient'

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
  const gqlQuery = `
    query ListAssets($filter: AssetFilter) {
      assets(filter: $filter) {
        id
        name
        assetType
        geometry
        visualProfile
        physicsProfile
        behaviorProfile
        meta
        createdAt
        updatedAt
      }
    }
  `

  const variables: any = {}
  if (params) {
    variables.filter = {}
    if (params.projectId) variables.filter.projectId = params.projectId
    if (params.assetType) variables.filter.assetType = params.assetType
    if (params.mode) variables.filter.mode = params.mode
    if (params.tag) variables.filter.tag = params.tag
  }

  try {
    const data = await query<{ assets: any[] }>(gqlQuery, Object.keys(variables).length > 0 ? variables : undefined)
    
    if (!data?.assets || !Array.isArray(data.assets)) {
      return []
    }

    // Convert GraphQL response to Asset interface
    return data.assets.map((asset) => {
      // Parse JSON string fields
      const geometry = asset.geometry ? JSON.parse(asset.geometry) : undefined
      const visualProfile = asset.visualProfile ? JSON.parse(asset.visualProfile) : {}
      const physicsProfile = asset.physicsProfile ? JSON.parse(asset.physicsProfile) : {}
      const behaviorProfile = asset.behaviorProfile ? JSON.parse(asset.behaviorProfile) : {}
      const meta = asset.meta ? JSON.parse(asset.meta) : {}

      return {
        _id: asset.id,
        assetTypeId: asset.assetType,
        name: asset.name,
        geometry,
        visualProfile,
        physicsProfile,
        behaviorProfile,
        meta,
        createdBy: '', // GraphQL doesn't return this yet
        createdAt: asset.createdAt ? new Date(asset.createdAt).getTime() : Date.now(),
        updatedAt: asset.updatedAt ? new Date(asset.updatedAt).getTime() : Date.now(),
      } as Asset
    })
  } catch (error) {
    console.error('Failed to list assets via GraphQL:', error)
    throw error
  }
}

/**
 * Get asset by ID
 */
export async function getAsset(assetId: string): Promise<Asset> {
  const gqlQuery = `
    query GetAsset($id: String!) {
      asset(id: $id) {
        id
        name
        assetType
        geometry
        visualProfile
        physicsProfile
        behaviorProfile
        meta
        createdAt
        updatedAt
      }
    }
  `

  try {
    const data = await query<{ asset: any }>(gqlQuery, { id: assetId })
    
    if (!data?.asset) {
      throw new Error('Asset not found')
    }

    const asset = data.asset

    // Parse JSON string fields
    const geometry = asset.geometry ? JSON.parse(asset.geometry) : undefined
    const visualProfile = asset.visualProfile ? JSON.parse(asset.visualProfile) : {}
    const physicsProfile = asset.physicsProfile ? JSON.parse(asset.physicsProfile) : {}
    const behaviorProfile = asset.behaviorProfile ? JSON.parse(asset.behaviorProfile) : {}
    const meta = asset.meta ? JSON.parse(asset.meta) : {}

    return {
      _id: asset.id,
      assetTypeId: asset.assetType,
      name: asset.name,
      geometry,
      visualProfile,
      physicsProfile,
      behaviorProfile,
      meta,
      createdBy: '', // GraphQL doesn't return this yet
      createdAt: asset.createdAt ? new Date(asset.createdAt).getTime() : Date.now(),
      updatedAt: asset.updatedAt ? new Date(asset.updatedAt).getTime() : Date.now(),
    } as Asset
  } catch (error) {
    console.error('Failed to get asset via GraphQL:', error)
    throw error
  }
}

/**
 * Create a new asset via GraphQL
 */
export async function createAsset(request: CreateAssetRequest): Promise<{ id: string; name: string }> {
  const gqlMutation = `
    mutation CreateAsset($input: AssetInput!) {
      createAsset(input: $input) {
        id
        name
      }
    }
  `

  const variables = {
    input: {
      projectId: request.projectId,
      assetTypeKey: request.assetTypeKey,
      name: request.name,
      slug: request.slug,
      thumbnailUrl: request.thumbnailUrl,
      modelUrl: request.modelUrl,
      geometry: request.geometry ? JSON.stringify(request.geometry) : null,
      visualProfile: request.visualProfile ? JSON.stringify(request.visualProfile) : null,
      physicsProfile: request.physicsProfile ? JSON.stringify(request.physicsProfile) : null,
      behaviorProfile: request.behaviorProfile ? JSON.stringify(request.behaviorProfile) : null,
      meta: request.meta ? JSON.stringify(request.meta) : null,
    },
  }

  try {
    const data = await mutate<{ createAsset: { id: string; name: string } }>(gqlMutation, variables)
    
    if (!data?.createAsset) {
      throw new Error('Failed to create asset')
    }

    return {
      id: data.createAsset.id,
      name: data.createAsset.name,
    }
  } catch (error) {
    console.error('Failed to create asset via GraphQL:', error)
    throw error
  }
}

