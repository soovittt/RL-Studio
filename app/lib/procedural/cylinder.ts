/**
 * Cylinder Renderer
 * Renders a 3D cylinder
 */

import * as THREE from 'three'
import { AssetGeometry, RenderContext, RendererFunction } from './renderer'

export const renderCylinder: RendererFunction = (
  geometry: AssetGeometry,
  context: RenderContext
): THREE.Mesh => {
  const params = geometry.params || {}
  const radiusTop = params.radiusTop || 0.5
  const radiusBottom = params.radiusBottom || 0.5
  const height = params.height || 1
  const radialSegments = params.radialSegments || 32
  const heightSegments = params.heightSegments || 1
  const openEnded = params.openEnded || false
  const thetaStart = params.thetaStart || 0
  const thetaLength = params.thetaLength || Math.PI * 2

  const geo = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments,
    openEnded,
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

