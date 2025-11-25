# Grid World Component System

## Overview

The Grid World system uses a **component-based architecture** (similar to Unity/Unreal) where everything is an entity with components. This allows for maximum flexibility and reusability.

## Core Concepts

### 1. Entities = Instances of Assets

Every entity in the grid is an instance of an asset:
- **Asset** = Reusable template (e.g., "Dog Agent", "Wall Tile", "Key")
- **Entity** = Instance placed in the grid (e.g., "Dog at position (3, 5)")

### 2. Components = Behavior & Properties

Each entity has components that define its behavior:
- `GridTransform` - Position in grid (row, col, layer)
- `Render2D` - How to draw it (shape, color, size)
- `Collision2D` - Physics properties (solid, trigger)
- `Agent` - RL agent configuration
- `GridMovement` - Movement capabilities
- `Inventory` - Item storage
- `TriggerZone` - Event triggers
- `Pickable`, `Door`, `Portal` - Special behaviors

## Component Definitions

All components are defined in `app/lib/components/gridComponents.ts`:

```typescript
// Position in grid
GridTransform: { row: number, col: number, layer?: number }

// Visual representation
Render2D: { 
  shape: 'square' | 'circle' | 'sprite',
  size?: number,
  radius?: number,
  color: string,
  opacity?: number
}

// Physics
Collision2D: { isSolid: boolean, isTrigger?: boolean }

// Movement
GridMovement: { allowDiagonal?: boolean, canFly?: boolean, speed?: number }

// RL Agent
Agent: { 
  observation: { radius: number, type: 'partial' | 'full' },
  actionSpace: 'grid_moves_4' | 'grid_moves_8' | 'none' | 'custom'
}
```

## Asset to Component Mapping

The `assetToComponents()` function in `app/lib/components/assetToComponents.ts` converts assets to component sets:

```typescript
import { assetToComponents } from '~/lib/components/assetToComponents'

const components = assetToComponents(asset, row, col, layer, {
  actionSpace: 'grid_moves_4',
  triggerType: 'goal',
  overrideColor: '#ff0000'
})
// Returns: { GridTransform, Render2D, Collision2D, Agent, ... }
```

## Procedural Rendering

All rendering is procedural - no PNGs or 3D models needed:

```typescript
import { renderEntity } from '~/lib/procedural/gridRenderer'

const mesh = renderEntity(
  render2D,      // Render2D component
  gridTransform, // GridTransform component
  gridSize,      // Size of each grid cell
  scene          // Three.js scene
)
```

The renderer supports:
- **Square** - For tiles, walls, goals
- **Circle** - For agents, pickups, keys
- **Sprite** - For custom images (optional)

## Canonical Assets

All canonical grid world assets are defined in `convex/seed.ts`:

### Base Tiles
- `asset_floor` - Empty walkable cell
- `asset_wall` - Solid, blocks movement
- `asset_water` - Slows movement
- `asset_hazard` - Causes negative reward
- `asset_checkpoint` - Intermediate reward
- `asset_goal` - Goal tile (terminal)

### Agents
- `asset_agent_human` - Default RL agent
- `asset_agent_dog` - Dog agent
- `asset_agent_drone` - Drone (can fly)
- `asset_agent_robot` - Robot agent

### Interactive Props
- `asset_key` - Collectable key
- `asset_door` - Door (open/closed)
- `asset_button` - Pressable switch
- `asset_portal` - Teleporter
- `asset_pickup` - Collectible item

### NPCs
- `asset_guard` - Patrolling guard
- `asset_moving_obstacle` - Moves back and forth
- `asset_random_walker` - Random movement

### Logic Assets
- `asset_reward_trigger` - Invisible reward zone
- `asset_penalty_trigger` - Invisible penalty zone
- `asset_episode_end_trigger` - Terminates episode

## Usage Examples

### Creating an Entity from an Asset

```typescript
// 1. Get asset from backend
const asset = await getAsset('asset_dog_agent')

// 2. Convert to components
const components = assetToComponents(asset, row: 3, col: 5, layer: 1, {
  actionSpace: 'grid_moves_4'
})

// 3. Create entity in scene graph
const entity = {
  id: 'entity_123',
  assetId: asset._id,
  name: 'Dog',
  transform: { position: [5, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  components
}
```

### Rendering an Entity

```typescript
// Get components from entity
const render2D = entity.components.Render2D
const gridTransform = entity.components.GridTransform

// Render procedurally
renderEntity(render2D, gridTransform, gridSize, scene)
```

## Adding New Assets

To add a new asset type (e.g., "Dragon Agent"):

1. **Add to seed.ts**:
```typescript
{
  name: "Dragon Agent",
  assetTypeKey: "agent",
  geometry: { primitive: "circle", params: { radius: 0.5 } },
  visualProfile: { color: "#fa4444" },
  physicsProfile: { collider: "box", dynamic: true },
  behaviorProfile: { canFly: true, speed: 2.0 },
  meta: { tags: ["agent", "dragon", "flying"] }
}
```

2. **Add default render** (optional, in `gridRenderer.ts`):
```typescript
'asset_agent_dragon': { shape: 'circle', radius: 0.5, color: '#fa4444' }
```

3. **Use it**:
```typescript
const dragonAsset = await getAsset('asset_agent_dragon')
const components = assetToComponents(dragonAsset, row, col, 1)
// Automatically gets: GridTransform, Render2D, Collision2D, Agent, GridMovement (with canFly: true)
```

## System Architecture

```
Asset (Database)
    ↓
assetToComponents()
    ↓
Components (GridTransform, Render2D, Collision2D, ...)
    ↓
Entity (in Scene Graph)
    ↓
renderEntity()
    ↓
Three.js Mesh (Visual)
```

## Benefits

1. **Reusability** - Any asset can be used anywhere
2. **Flexibility** - Components can be mixed and matched
3. **Procedural** - No images/models needed
4. **Extensible** - Easy to add new asset types
5. **Type-Safe** - Full TypeScript support

## Next Steps

- Test rendering with all canonical assets
- Add more component types as needed
- Enhance procedural rendering (animations, effects)
- Add component validation
- Create visual component editor

