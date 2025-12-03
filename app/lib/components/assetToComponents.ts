/**
 * Asset to Components Mapper
 *
 * Converts asset data into component sets for entities.
 * This is the bridge between the asset library and the component system.
 */

import { Asset } from '../assetClient'
import {
  GridTransform,
  Render2D,
  Collision2D,
  Agent,
  GridMovement,
  Pickable,
  Door,
  Portal,
  TriggerZone,
  Inventory,
} from './gridComponents'
import { getDefaultRender2D } from '../procedural/gridRenderer'

/**
 * Convert asset data to Render2D component
 */
export function assetToRender2D(asset: Asset, overrideColor?: string): Render2D {
  const defaultRender = getDefaultRender2D(
    `asset_${asset.name.toLowerCase().replace(/\s+/g, '_')}`,
    asset
  )

  return {
    shape: defaultRender.shape,
    size: defaultRender.size,
    radius: defaultRender.radius,
    color:
      overrideColor ||
      asset.meta?.paletteColor ||
      asset.visualProfile?.color ||
      defaultRender.color,
    opacity: (asset.visualProfile?.opacity || defaultRender.opacity) ?? 1.0,
    sprite: asset.modelUrl || defaultRender.sprite,
  }
}

/**
 * Convert asset physics profile to Collision2D component
 */
export function assetToCollision2D(asset: Asset): Collision2D {
  const physics = asset.physicsProfile || {}

  return {
    isSolid: physics.static === true || (physics.collider && physics.collider !== 'none'),
    isTrigger: physics.trigger === true,
  }
}

/**
 * Convert asset behavior profile to GridMovement component
 */
export function assetToGridMovement(asset: Asset): GridMovement | null {
  const behavior = asset.behaviorProfile || {}

  // Only create GridMovement for agents or moving entities
  if (asset.meta?.tags?.includes('agent') || behavior.speed !== undefined) {
    return {
      allowDiagonal: behavior.allowDiagonal || false,
      canFly: behavior.canFly || asset.meta?.tags?.includes('flying') || false,
      speed: behavior.speed || 1.0,
    }
  }

  return null
}

/**
 * Convert asset to Agent component (if it's an agent)
 */
export function assetToAgent(
  asset: Asset,
  actionSpace: 'grid_moves_4' | 'grid_moves_8' | 'none' | 'custom' = 'grid_moves_4'
): Agent | null {
  // Only create Agent component for agent assets
  if (!asset.meta?.tags?.includes('agent') && !asset.assetTypeId?.toString().includes('agent')) {
    return null
  }

  return {
    observation: {
      radius: 2,
      type: 'partial',
    },
    actionSpace,
    team: asset.meta?.tags?.find((tag) => tag.includes('team'))?.replace('team_', ''),
  }
}

/**
 * Convert asset to Pickable component (if it's a collectible)
 */
export function assetToPickable(asset: Asset, itemId: string): Pickable | null {
  if (!asset.behaviorProfile?.collectible && !asset.meta?.tags?.includes('collectible')) {
    return null
  }

  return {
    itemId,
    onPickup: [],
  }
}

/**
 * Convert asset to Door component (if it's a door)
 */
export function assetToDoor(asset: Asset, doorId: string): Door | null {
  if (!asset.name.toLowerCase().includes('door') && !asset.meta?.tags?.includes('door')) {
    return null
  }

  return {
    doorId,
    isOpen: false,
    requiresKey: asset.behaviorProfile?.requiresKey || undefined,
  }
}

/**
 * Convert asset to Portal component (if it's a portal)
 */
export function assetToPortal(asset: Asset, targetRow: number, targetCol: number): Portal | null {
  if (!asset.name.toLowerCase().includes('portal') && !asset.meta?.tags?.includes('portal')) {
    return null
  }

  return {
    targetRow,
    targetCol,
  }
}

/**
 * Convert asset to TriggerZone component (if it has trigger behavior)
 */
export function assetToTriggerZone(
  asset: Asset,
  triggerType: 'goal' | 'trap' | 'reward' | 'penalty'
): TriggerZone | null {
  if (triggerType === 'goal') {
    return {
      onEnter: ['reward:+10', 'endEpisode'],
      once: true,
    }
  } else if (triggerType === 'trap') {
    return {
      onEnter: ['penalty:-1'],
      once: false,
    }
  } else if (triggerType === 'reward') {
    return {
      onEnter: ['reward:+1'],
      once: false,
    }
  } else if (triggerType === 'penalty') {
    return {
      onEnter: ['penalty:-1'],
      once: false,
    }
  }

  return null
}

/**
 * Create Inventory component (for agents)
 */
export function createInventory(): Inventory {
  return {
    items: [],
  }
}

/**
 * Create GridTransform component from position
 */
export function createGridTransform(row: number, col: number, layer: number = 0): GridTransform {
  return {
    row,
    col,
    layer,
  }
}

/**
 * Convert asset to full component set for an entity
 * This is the main function that creates all components from an asset
 */
export function assetToComponents(
  asset: Asset,
  row: number,
  col: number,
  layer: number = 0,
  options: {
    actionSpace?: 'grid_moves_4' | 'grid_moves_8' | 'none' | 'custom'
    triggerType?: 'goal' | 'trap' | 'reward' | 'penalty'
    portalTarget?: { row: number; col: number }
    overrideColor?: string
  } = {}
): Record<string, any> {
  const components: Record<string, any> = {}

  // Always add GridTransform for grid entities
  components.GridTransform = createGridTransform(row, col, layer)

  // Always add Render2D
  components.Render2D = assetToRender2D(asset, options.overrideColor)

  // Always add Collision2D
  components.Collision2D = assetToCollision2D(asset)

  // Add GridMovement if applicable
  const gridMovement = assetToGridMovement(asset)
  if (gridMovement) {
    components.GridMovement = gridMovement
  }

  // Add Agent component if it's an agent
  const agent = assetToAgent(asset, options.actionSpace || 'grid_moves_4')
  if (agent) {
    components.Agent = agent
    components.Inventory = createInventory()
  }

  // Add Pickable if it's a collectible
  const pickable = assetToPickable(asset, asset._id)
  if (pickable) {
    components.Pickable = pickable
  }

  // Add Door if it's a door
  const door = assetToDoor(asset, asset._id)
  if (door) {
    components.Door = door
  }

  // Add Portal if it's a portal
  if (options.portalTarget) {
    const portal = assetToPortal(asset, options.portalTarget.row, options.portalTarget.col)
    if (portal) {
      components.Portal = portal
    }
  }

  // Add TriggerZone if specified
  if (options.triggerType) {
    const trigger = assetToTriggerZone(asset, options.triggerType)
    if (trigger) {
      components.TriggerZone = trigger
    }
  }

  return components
}

/**
 * Helper to determine trigger type from asset
 */
export function getTriggerTypeFromAsset(
  asset: Asset
): 'goal' | 'trap' | 'reward' | 'penalty' | null {
  const name = asset.name.toLowerCase()
  const tags = asset.meta?.tags || []

  if (name.includes('goal') || tags.includes('goal')) {
    return 'goal'
  } else if (name.includes('trap') || tags.includes('trap') || tags.includes('hazard')) {
    return 'trap'
  } else if (name.includes('reward') || tags.includes('reward')) {
    return 'reward'
  } else if (name.includes('penalty') || tags.includes('penalty')) {
    return 'penalty'
  }

  return null
}
