/**
 * Sphere Renderer
 * Renders a 3D sphere
 */

import * as THREE from 'three'
import { AssetGeometry, RenderContext, RendererFunction } from './renderer'

export const renderSphere: RendererFunction = (
  geometry: AssetGeometry,
  context: RenderContext
): THREE.Mesh => {
  const params = geometry.params || {}
  const radius = params.radius || 0.5
  const widthSegments = params.widthSegments || 16
  const heightSegments = params.heightSegments || 16
  const phiStart = params.phiStart || 0
  const phiLength = params.phiLength || Math.PI * 2
  const thetaStart = params.thetaStart || 0
  const thetaLength = params.thetaLength || Math.PI

  const geo = new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
    phiStart,
    phiLength,
    thetaStart,
    thetaLength
  )
  const material = new THREE.MeshStandardMaterial({
    color: context.color || '#9ca3af',
    emissive: context.emissive || '#000000',
    metalness: context.metalness ?? 0.3,
    roughness: context.roughness ?? 0.6,
  })

  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(...context.position)
  mesh.rotation.set(...context.rotation)
  mesh.scale.set(...context.scale)

  return mesh
}
