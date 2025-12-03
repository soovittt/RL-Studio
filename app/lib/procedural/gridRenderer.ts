/**
 * Procedural Grid World Renderer
 *
 * Renders grid entities using Three.js based on their Render2D components.
 * No PNGs or 3D models needed - everything is procedurally generated.
 */

import * as THREE from 'three'
import { Render2D, GridTransform } from '../components/gridComponents'

/**
 * Render a square tile/entity
 */
export function renderSquare(
  render2D: Render2D,
  gridTransform: GridTransform,
  gridSize: number,
  scene: THREE.Scene
): THREE.Mesh {
  const size = render2D.size || 1.0
  const color = render2D.color || '#aaa'
  const opacity = render2D.opacity ?? 1.0

  const geometry = new THREE.PlaneGeometry(size, size)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1.0,
    opacity,
    side: THREE.DoubleSide,
  })

  // Add outline if specified
  if (render2D.outline) {
    const outlineGeometry = new THREE.EdgesGeometry(geometry)
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: render2D.outline.color,
      linewidth: render2D.outline.width,
    })
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    const mesh = new THREE.Mesh(geometry, material)

    const group = new THREE.Group()
    group.add(mesh)
    group.add(outline)

    // Position based on grid coordinates
    group.position.x = gridTransform.col * gridSize
    group.position.y = -gridTransform.row * gridSize
    group.position.z = gridTransform.layer || 0

    scene.add(group)
    return mesh // Return the main mesh for reference
  }

  const mesh = new THREE.Mesh(geometry, material)

  // Position based on grid coordinates
  mesh.position.x = gridTransform.col * gridSize
  mesh.position.y = -gridTransform.row * gridSize
  mesh.position.z = gridTransform.layer || 0

  scene.add(mesh)
  return mesh
}

/**
 * Render a circle entity (agent, pickup, key, etc.)
 */
export function renderCircle(
  render2D: Render2D,
  gridTransform: GridTransform,
  gridSize: number,
  scene: THREE.Scene
): THREE.Mesh {
  const radius = render2D.radius || render2D.size || 0.4
  const color = render2D.color || '#fff'
  const opacity = render2D.opacity ?? 1.0

  const geometry = new THREE.CircleGeometry(radius, 32)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1.0,
    opacity,
    side: THREE.DoubleSide,
  })

  // Add outline if specified
  if (render2D.outline) {
    const outlineGeometry = new THREE.RingGeometry(radius, radius + render2D.outline.width, 32)
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: render2D.outline.color,
      transparent: true,
      opacity: render2D.outline.width / radius,
    })
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial)
    const mesh = new THREE.Mesh(geometry, material)

    const group = new THREE.Group()
    group.add(mesh)
    group.add(outline)

    // Position based on grid coordinates
    group.position.x = gridTransform.col * gridSize
    group.position.y = -gridTransform.row * gridSize
    group.position.z = (gridTransform.layer || 0) + 0.1 // Slightly above tiles

    scene.add(group)
    return mesh
  }

  const mesh = new THREE.Mesh(geometry, material)

  // Position based on grid coordinates
  mesh.position.x = gridTransform.col * gridSize
  mesh.position.y = -gridTransform.row * gridSize
  mesh.position.z = (gridTransform.layer || 0) + 0.1 // Slightly above tiles

  scene.add(mesh)
  return mesh
}

/**
 * Render a sprite (optional - for future use with custom images)
 */
export function renderSprite(
  render2D: Render2D,
  gridTransform: GridTransform,
  gridSize: number,
  scene: THREE.Scene
): THREE.Sprite | null {
  if (!render2D.sprite) return null

  const loader = new THREE.TextureLoader()
  const texture = loader.load(render2D.sprite)
  const material = new THREE.SpriteMaterial({ map: texture })
  const sprite = new THREE.Sprite(material)

  const size = render2D.size || 1.0
  sprite.scale.set(size, size, 1)

  // Position based on grid coordinates
  sprite.position.x = gridTransform.col * gridSize
  sprite.position.y = -gridTransform.row * gridSize
  sprite.position.z = (gridTransform.layer || 0) + 0.1

  scene.add(sprite)
  return sprite
}

/**
 * Rendering registry - maps shape types to render functions
 */
const RENDERERS = {
  square: renderSquare,
  circle: renderCircle,
  sprite: renderSprite,
} as const

/**
 * Render an entity based on its Render2D component
 */
export function renderEntity(
  render2D: Render2D,
  gridTransform: GridTransform,
  gridSize: number,
  scene: THREE.Scene
): THREE.Object3D | null {
  const renderer = RENDERERS[render2D.shape]
  if (!renderer) {
    console.warn(`Unknown render shape: ${render2D.shape}`)
    return null
  }

  return renderer(render2D, gridTransform, gridSize, scene)
}

/**
 * Get default Render2D component for an asset type
 */
export function getDefaultRender2D(assetType: string, assetData?: any): Render2D {
  // Default colors and shapes based on asset type
  const defaults: Record<string, Render2D> = {
    // Base tiles
    asset_floor: { shape: 'square', size: 1.0, color: '#f0f0f0' },
    asset_wall: { shape: 'square', size: 1.0, color: '#333333' },
    asset_water: { shape: 'square', size: 1.0, color: '#2196F3', opacity: 0.7 },
    asset_hazard: { shape: 'square', size: 1.0, color: '#f44336' },
    asset_checkpoint: { shape: 'square', size: 1.0, color: '#9C27B0' },
    asset_goal: { shape: 'square', size: 1.0, color: '#4CAF50' },

    // Agents
    asset_agent_human: { shape: 'circle', radius: 0.4, color: '#4a90e2' },
    asset_agent_dog: { shape: 'circle', radius: 0.4, color: '#e86' },
    asset_agent_drone: { shape: 'circle', radius: 0.4, color: '#21b6ff' },
    asset_agent_robot: { shape: 'square', size: 0.8, color: '#9E9E9E' },

    // Interactive props
    asset_key: { shape: 'circle', radius: 0.2, color: '#ffd700' },
    asset_door: { shape: 'square', size: 1.0, color: '#8b4513' },
    asset_button: { shape: 'circle', radius: 0.3, color: '#FF5722' },
    asset_portal: { shape: 'circle', radius: 0.5, color: '#9C27B0', opacity: 0.8 },
    asset_pickup: { shape: 'circle', radius: 0.2, color: '#FFC107' },

    // NPCs
    asset_guard: { shape: 'square', size: 0.8, color: '#607D8B' },
    asset_moving_obstacle: { shape: 'square', size: 0.9, color: '#795548' },
    asset_random_walker: { shape: 'circle', radius: 0.3, color: '#9E9E9E' },
  }

  // Check if assetData has visualProfile
  if (assetData?.visualProfile?.color) {
    return {
      shape: defaults[assetType]?.shape || 'square',
      size: defaults[assetType]?.size || 1.0,
      color: assetData.visualProfile.color,
      opacity: assetData.visualProfile.opacity,
    }
  }

  return defaults[assetType] || { shape: 'square', size: 1.0, color: '#aaa' }
}
