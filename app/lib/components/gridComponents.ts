/**
 * Grid World Component System
 *
 * This file defines all components used in grid worlds.
 * Components are stored in sceneGraph.entities[n].components
 *
 * Design Philosophy:
 * - Everything is an entity with components
 * - Assets define default components
 * - Entities override/extend asset components
 * - Procedural rendering based on components
 */

// ============================================================================
// COMPONENT TYPE DEFINITIONS
// ============================================================================

/**
 * GridTransform - Position in grid space
 */
export interface GridTransform {
  row: number
  col: number
  layer?: number // For stacking (default: 0)
}

/**
 * Render2D - Procedural visual representation
 */
export interface Render2D {
  shape: 'square' | 'circle' | 'sprite'
  size: number // For square/circle
  radius?: number // For circle (alternative to size)
  color: string // Hex color
  opacity?: number // 0-1 (default: 1)
  sprite?: string | null // Sprite URL (if shape is 'sprite')
  outline?: {
    color: string
    width: number
  }
}

/**
 * Collision2D - Physics/collision properties
 */
export interface Collision2D {
  isSolid: boolean // Blocks movement
  isTrigger?: boolean // Trigger zone (doesn't block but detects)
}

/**
 * GridMovement - Movement capabilities
 */
export interface GridMovement {
  allowDiagonal?: boolean // Can move diagonally (default: false)
  canFly?: boolean // Can pass through solid tiles (default: false)
  speed?: number // Movement speed multiplier (default: 1.0)
}

/**
 * Agent - RL agent configuration
 */
export interface Agent {
  observation?: {
    radius?: number // Observation radius in grid cells
    type?: 'partial' | 'full' // Partial or full observability
  }
  actionSpace: 'grid_moves_4' | 'grid_moves_8' | 'none' | 'custom'
  customActions?: string[] // Custom action names (if actionSpace is 'custom')
  team?: string // Team identifier for multi-agent
}

/**
 * Inventory - Item storage
 */
export interface Inventory {
  items: string[] // Array of item IDs (e.g., ['key_1', 'gem_2'])
  maxItems?: number // Maximum capacity (default: unlimited)
}

/**
 * TriggerZone - Event triggers
 */
export interface TriggerZone {
  onEnter?: string[] // Actions when entity enters (e.g., ['reward:+1', 'openDoor:door1'])
  onExit?: string[] // Actions when entity exits
  onStay?: string[] // Actions while entity stays (per step)
  once?: boolean // Trigger only once (default: false)
}

/**
 * StateMachine - Scripted behavior
 */
export interface StateMachine {
  states: string[] // List of state names
  transitions: Array<[string, string, string]> // [fromState, toState, condition]
  initialState?: string // Starting state (default: first state)
  currentState?: string // Current state (runtime)
}

/**
 * Pickable - Can be picked up
 */
export interface Pickable {
  itemId: string // Unique item identifier
  onPickup?: string[] // Actions when picked up
}

/**
 * Door - Door state
 */
export interface Door {
  doorId: string // Unique door identifier
  isOpen: boolean // Current state
  requiresKey?: string // Key item ID required to open
}

/**
 * Portal - Teleporter
 */
export interface Portal {
  targetRow: number
  targetCol: number
  targetSceneId?: string // Optional: teleport to different scene
}

// ============================================================================
// COMPONENT SCHEMAS (for validation)
// ============================================================================

export const ComponentSchemas = {
  GridTransform: {
    type: 'object',
    properties: {
      row: { type: 'integer', minimum: 0 },
      col: { type: 'integer', minimum: 0 },
      layer: { type: 'integer', default: 0 },
    },
    required: ['row', 'col'],
  },
  Render2D: {
    type: 'object',
    properties: {
      shape: { type: 'string', enum: ['square', 'circle', 'sprite'] },
      size: { type: 'number', minimum: 0.1 },
      radius: { type: 'number', minimum: 0.1 },
      color: { type: 'string' },
      opacity: { type: 'number', minimum: 0, maximum: 1 },
      sprite: { type: ['string', 'null'] },
      outline: {
        type: 'object',
        properties: {
          color: { type: 'string' },
          width: { type: 'number', minimum: 0 },
        },
      },
    },
    required: ['shape', 'color'],
  },
  Collision2D: {
    type: 'object',
    properties: {
      isSolid: { type: 'boolean' },
      isTrigger: { type: 'boolean' },
    },
    required: ['isSolid'],
  },
  GridMovement: {
    type: 'object',
    properties: {
      allowDiagonal: { type: 'boolean' },
      canFly: { type: 'boolean' },
      speed: { type: 'number', minimum: 0 },
    },
  },
  Agent: {
    type: 'object',
    properties: {
      observation: {
        type: 'object',
        properties: {
          radius: { type: 'integer', minimum: 0 },
          type: { type: 'string', enum: ['partial', 'full'] },
        },
      },
      actionSpace: {
        type: 'string',
        enum: ['grid_moves_4', 'grid_moves_8', 'none', 'custom'],
      },
      customActions: { type: 'array', items: { type: 'string' } },
      team: { type: 'string' },
    },
    required: ['actionSpace'],
  },
  Inventory: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'string' } },
      maxItems: { type: 'integer', minimum: 1 },
    },
    required: ['items'],
  },
  TriggerZone: {
    type: 'object',
    properties: {
      onEnter: { type: 'array', items: { type: 'string' } },
      onExit: { type: 'array', items: { type: 'string' } },
      onStay: { type: 'array', items: { type: 'string' } },
      once: { type: 'boolean' },
    },
  },
  StateMachine: {
    type: 'object',
    properties: {
      states: { type: 'array', items: { type: 'string' } },
      transitions: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
        },
      },
      initialState: { type: 'string' },
      currentState: { type: 'string' },
    },
    required: ['states'],
  },
  Pickable: {
    type: 'object',
    properties: {
      itemId: { type: 'string' },
      onPickup: { type: 'array', items: { type: 'string' } },
    },
    required: ['itemId'],
  },
  Door: {
    type: 'object',
    properties: {
      doorId: { type: 'string' },
      isOpen: { type: 'boolean' },
      requiresKey: { type: 'string' },
    },
    required: ['doorId', 'isOpen'],
  },
  Portal: {
    type: 'object',
    properties: {
      targetRow: { type: 'integer' },
      targetCol: { type: 'integer' },
      targetSceneId: { type: 'string' },
    },
    required: ['targetRow', 'targetCol'],
  },
} as const

// ============================================================================
// COMPONENT TYPE UNION
// ============================================================================

export type Component =
  | { type: 'GridTransform'; data: GridTransform }
  | { type: 'Render2D'; data: Render2D }
  | { type: 'Collision2D'; data: Collision2D }
  | { type: 'GridMovement'; data: GridMovement }
  | { type: 'Agent'; data: Agent }
  | { type: 'Inventory'; data: Inventory }
  | { type: 'TriggerZone'; data: TriggerZone }
  | { type: 'StateMachine'; data: StateMachine }
  | { type: 'Pickable'; data: Pickable }
  | { type: 'Door'; data: Door }
  | { type: 'Portal'; data: Portal }

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get component from entity by type
 */
export function getComponent<T extends Component['type']>(
  entity: { components: Record<string, any> },
  componentType: T
): Extract<Component, { type: T }>['data'] | null {
  return entity.components[componentType] || null
}

/**
 * Set component on entity
 */
export function setComponent(
  entity: { components: Record<string, any> },
  componentType: Component['type'],
  data: any
): void {
  entity.components[componentType] = data
}

/**
 * Remove component from entity
 */
export function removeComponent(
  entity: { components: Record<string, any> },
  componentType: Component['type']
): void {
  delete entity.components[componentType]
}

/**
 * Check if entity has component
 */
export function hasComponent(
  entity: { components: Record<string, any> },
  componentType: Component['type']
): boolean {
  return componentType in entity.components
}
