/**
 * Geometry Editor - Custom geometry editor with polyline drawing
 * Allows users to draw custom walkable/non-walkable regions
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { EnvSpec, Vec2, GeometrySpec } from '~/lib/envSpec'

interface GeometryEditorProps {
  envSpec: EnvSpec
  onGeometryChange: (geometry: GeometrySpec) => void
  onClose: () => void
}

export function GeometryEditor({ envSpec, onGeometryChange, onClose }: GeometryEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPolyline, setCurrentPolyline] = useState<Vec2[]>([])
  const [polylines, setPolylines] = useState<Vec2[][]>([])
  const [mode, setMode] = useState<'walkable' | 'nonWalkable'>('walkable')
  const [isEditing, setIsEditing] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const world = envSpec.world
  const width = world.width
  const height = world.height
  const coordinateSystem = world.coordinateSystem

  // Initialize from existing geometry
  useEffect(() => {
    if (envSpec.world.geometry) {
      const existingPolylines: Vec2[][] = []
      if (envSpec.world.geometry.walkableRegions) {
        existingPolylines.push(...envSpec.world.geometry.walkableRegions)
      }
      if (envSpec.world.geometry.nonWalkableRegions) {
        existingPolylines.push(...envSpec.world.geometry.nonWalkableRegions)
      }
      setPolylines(existingPolylines)
    }
  }, [envSpec.world.geometry])

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    drawCanvas(ctx)
  }, [polylines, currentPolyline, mode, width, height, coordinateSystem])

  const drawCanvas = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const canvas = ctx.canvas
      const rect = canvas.getBoundingClientRect()
      const displayWidth = rect.width
      const displayHeight = rect.height

      // Clear canvas
      ctx.clearRect(0, 0, displayWidth, displayHeight)

      // Draw background
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 0, displayWidth, displayHeight)

      // Draw grid if grid coordinate system
      if (coordinateSystem === 'grid') {
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 1
        const cellSize = Math.min(displayWidth / width, displayHeight / height)
        for (let i = 0; i <= width; i++) {
          const x = (i / width) * displayWidth
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, displayHeight)
          ctx.stroke()
        }
        for (let i = 0; i <= height; i++) {
          const y = (i / height) * displayHeight
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(displayWidth, y)
          ctx.stroke()
        }
      }

      // Draw existing polylines
      polylines.forEach((polyline, idx) => {
        if (polyline.length < 2) return

        ctx.strokeStyle =
          idx === editingIndex ? '#fbbf24' : mode === 'walkable' ? '#10b981' : '#ef4444'
        ctx.lineWidth = 2
        ctx.beginPath()
        const [firstX, firstY] = worldToCanvas(polyline[0])
        ctx.moveTo(firstX, firstY)
        for (let i = 1; i < polyline.length; i++) {
          const [x, y] = worldToCanvas(polyline[i])
          ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Fill region
        ctx.fillStyle =
          idx === editingIndex
            ? 'rgba(251, 191, 36, 0.2)'
            : mode === 'walkable'
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(239, 68, 68, 0.2)'
        ctx.fill()

        // Draw points
        polyline.forEach((point) => {
          const [x, y] = worldToCanvas(point)
          ctx.fillStyle =
            idx === editingIndex ? '#fbbf24' : mode === 'walkable' ? '#10b981' : '#ef4444'
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
        })
      })

      // Draw current polyline being drawn
      if (currentPolyline.length > 0) {
        ctx.strokeStyle = mode === 'walkable' ? '#10b981' : '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        const [firstX, firstY] = worldToCanvas(currentPolyline[0])
        ctx.moveTo(firstX, firstY)
        for (let i = 1; i < currentPolyline.length; i++) {
          const [x, y] = worldToCanvas(currentPolyline[i])
          ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])

        // Draw points
        currentPolyline.forEach((point) => {
          const [x, y] = worldToCanvas(point)
          ctx.fillStyle = mode === 'walkable' ? '#10b981' : '#ef4444'
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    },
    [polylines, currentPolyline, mode, editingIndex, width, height, coordinateSystem]
  )

  const worldToCanvas = (worldPos: Vec2): [number, number] => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]

    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width
    const displayHeight = rect.height

    if (coordinateSystem === 'grid') {
      const x = (worldPos[0] / width) * displayWidth
      const y = (worldPos[1] / height) * displayHeight
      return [x, y]
    } else {
      // Cartesian: center at (0,0), map to canvas
      const x = ((worldPos[0] + width / 2) / width) * displayWidth
      const y = ((worldPos[1] + height / 2) / height) * displayHeight
      return [x, y]
    }
  }

  const canvasToWorld = (canvasX: number, canvasY: number): Vec2 => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]

    const rect = canvas.getBoundingClientRect()
    const displayWidth = rect.width
    const displayHeight = rect.height

    if (coordinateSystem === 'grid') {
      const x = (canvasX / displayWidth) * width
      const y = (canvasY / displayHeight) * height
      return [Math.max(0, Math.min(width - 1, x)), Math.max(0, Math.min(height - 1, y))]
    } else {
      // Cartesian: center at (0,0)
      const x = (canvasX / displayWidth) * width - width / 2
      const y = (canvasY / displayHeight) * height - height / 2
      return [
        Math.max(-width / 2, Math.min(width / 2, x)),
        Math.max(-height / 2, Math.min(height / 2, y)),
      ]
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isEditing && editingIndex !== null) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const worldPos = canvasToWorld(x, y)

    if (e.button === 0) {
      // Left click: add point
      setIsDrawing(true)
      setCurrentPolyline([...currentPolyline, worldPos])
    } else if (e.button === 2) {
      // Right click: finish polyline
      e.preventDefault()
      if (currentPolyline.length >= 3) {
        setPolylines([...polylines, currentPolyline])
        setCurrentPolyline([])
        setIsDrawing(false)
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const worldPos = canvasToWorld(x, y)

    // Update last point
    if (currentPolyline.length > 0) {
      const newPolyline = [...currentPolyline]
      newPolyline[newPolyline.length - 1] = worldPos
      setCurrentPolyline(newPolyline)
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
  }

  const handleFinishPolyline = () => {
    if (currentPolyline.length >= 3) {
      setPolylines([...polylines, currentPolyline])
      setCurrentPolyline([])
    }
  }

  const handleClearCurrent = () => {
    setCurrentPolyline([])
    setIsDrawing(false)
  }

  const handleDeletePolyline = (index: number) => {
    const newPolylines = polylines.filter((_, i) => i !== index)
    setPolylines(newPolylines)
    if (editingIndex === index) {
      setEditingIndex(null)
      setIsEditing(false)
    }
  }

  const handleSave = () => {
    // Separate walkable and non-walkable regions
    const walkableRegions: Vec2[][] = []
    const nonWalkableRegions: Vec2[][] = []

    // For now, all regions are based on current mode
    // In a full implementation, each polyline would have its own mode
    if (mode === 'walkable') {
      walkableRegions.push(...polylines)
    } else {
      nonWalkableRegions.push(...polylines)
    }

    const geometry: GeometrySpec = {
      walkableRegions: walkableRegions.length > 0 ? walkableRegions : undefined,
      nonWalkableRegions: nonWalkableRegions.length > 0 ? nonWalkableRegions : undefined,
    }

    onGeometryChange(geometry)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Geometry Editor</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('walkable')}
              className={`px-4 py-2 rounded ${
                mode === 'walkable' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              Walkable Region
            </button>
            <button
              onClick={() => setMode('nonWalkable')}
              className={`px-4 py-2 rounded ${
                mode === 'nonWalkable' ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              Non-Walkable Region
            </button>
          </div>

          <div className="text-sm text-muted-foreground">
            {mode === 'walkable' ? 'Green' : 'Red'} regions will be{' '}
            {mode === 'walkable' ? 'walkable' : 'blocked'}
          </div>
        </div>

        <div className="mb-4">
          <div className="bg-muted/50 border border-border rounded p-4 mb-2">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Left-click to add points to a polyline</li>
              <li>• Right-click or click "Finish" to complete the current polyline</li>
              <li>• Click "Clear Current" to start over</li>
              <li>• Click "Delete" on a region to remove it</li>
              <li>• At least 3 points are required to form a region</li>
            </ul>
          </div>
        </div>

        <div className="mb-4 border border-border rounded overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-96 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Regions ({polylines.length})</h3>
            <div className="flex gap-2">
              <button
                onClick={handleFinishPolyline}
                disabled={currentPolyline.length < 3}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                Finish Current
              </button>
              <button
                onClick={handleClearCurrent}
                disabled={currentPolyline.length === 0}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50"
              >
                Clear Current
              </button>
            </div>
          </div>

          {polylines.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {polylines.map((polyline, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <span className="text-sm">
                    Region {idx + 1} ({polyline.length} points)
                  </span>
                  <button
                    onClick={() => handleDeletePolyline(idx)}
                    className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {currentPolyline.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              Current: {currentPolyline.length} point{currentPolyline.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
          >
            Save Geometry
          </button>
        </div>
      </div>
    </div>
  )
}
