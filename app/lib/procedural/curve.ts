/**
 * Curve Renderer
 * Renders a 3D shape by extruding along a curve
 */

import * as THREE from 'three'
import { AssetGeometry, RenderContext, RendererFunction } from './renderer'

export const renderCurve: RendererFunction = (
  geometry: AssetGeometry,
  context: RenderContext
): THREE.Mesh => {
  const params = geometry.params || {}

  // Default: simple straight path
  const points = params.points || [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, params.length || 1),
  ]

  // Create curve from points
  const curve = new THREE.CatmullRomCurve3(points)

  // Shape to extrude (default: circle)
  const shapeRadius = params.shapeRadius || 0.1
  const shape = new THREE.Shape()
  shape.moveTo(shapeRadius, 0)
  shape.arc(0, 0, shapeRadius, 0, Math.PI * 2, false)

  // Extrude along curve
  const extrudeSettings = {
    steps: params.steps || 100,
    bevelEnabled: params.bevelEnabled || false,
    extrudePath: curve,
  }

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
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
