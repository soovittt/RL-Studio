/**
 * Procedural Renderer Registry
 * Maps geometry primitives to Three.js renderer functions
 */

import * as THREE from 'three'
import { renderRectangle } from './rectangle'
import { renderBox } from './box'
import { renderSphere } from './sphere'
import { renderCylinder } from './cylinder'
import { renderCurve } from './curve'

export type GeometryPrimitive = 'rectangle' | 'box' | 'sphere' | 'cylinder' | 'curve'

export interface GeometryParams {
  [key: string]: any
}

export interface AssetGeometry {
  primitive: GeometryPrimitive
  params: GeometryParams
}

export interface RenderContext {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color?: string
  emissive?: string
  metalness?: number
  roughness?: number
}

export type RendererFunction = (geometry: AssetGeometry, context: RenderContext) => THREE.Mesh

/**
 * Renderer registry mapping primitives to renderer functions
 */
export const RENDERERS: Record<GeometryPrimitive, RendererFunction> = {
  rectangle: renderRectangle,
  box: renderBox,
  sphere: renderSphere,
  cylinder: renderCylinder,
  curve: renderCurve,
}

/**
 * Render an asset using its geometry definition
 */
export function renderAsset(
  asset: { geometry?: AssetGeometry; visualProfile?: any },
  transform: {
    position: [number, number, number]
    rotation: [number, number, number]
    scale: [number, number, number]
  }
): THREE.Mesh | null {
  if (!asset.geometry || !asset.geometry.primitive) {
    // Fallback: use visualProfile size if available
    const size = asset.visualProfile?.size || [1, 1, 1]
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
    const material = new THREE.MeshStandardMaterial({
      color: asset.visualProfile?.color || '#9ca3af',
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(...transform.position)
    mesh.rotation.set(...transform.rotation)
    mesh.scale.set(...transform.scale)
    return mesh
  }

  const renderer = RENDERERS[asset.geometry.primitive]
  if (!renderer) {
    console.warn(`Unknown geometry primitive: ${asset.geometry.primitive}`)
    return null
  }

  const color = asset.visualProfile?.color || '#9ca3af'
  const emissive = asset.visualProfile?.emissive || '#000000'
  const metalness = asset.visualProfile?.metalness ?? 0.3
  const roughness = asset.visualProfile?.roughness ?? 0.6

  return renderer(asset.geometry, {
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
    color,
    emissive,
    metalness,
    roughness,
  })
}
