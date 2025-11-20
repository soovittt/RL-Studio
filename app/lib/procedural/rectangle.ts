/**
 * Rectangle Renderer
 * Renders a flat rectangle (2D plane)
 */

import * as THREE from 'three'
import { AssetGeometry, RenderContext, RendererFunction } from './renderer'

export const renderRectangle: RendererFunction = (
  geometry: AssetGeometry,
  context: RenderContext
): THREE.Mesh => {
  const params = geometry.params || {}
  const width = params.width || 1
  const height = params.height || 1
  const widthSegments = params.widthSegments || 1
  const heightSegments = params.heightSegments || 1

  const geo = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments)
  const material = new THREE.MeshStandardMaterial({
    color: context.color || '#9ca3af',
    emissive: context.emissive || '#000000',
    metalness: context.metalness ?? 0.3,
    roughness: context.roughness ?? 0.6,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(...context.position)
  mesh.rotation.set(...context.rotation)
  mesh.scale.set(...context.scale)

  return mesh
}

