/**
 * Trajectory Path Visualizer Component
 * High-quality SVG-based visualization with clean, minimal design
 */

import { useEffect, useState, useMemo, useRef } from 'react'
import { analyzeTrajectoryStreaming, type TrajectoryAnalysis } from '~/lib/analysisClient'
import { EnvSpec } from '~/lib/envSpec'

interface TrajectoryPathVisualizerProps {
  rolloutSteps: Array<{
    state: any
    action: any
    reward: number
    done: boolean
  }>
  envSpec: EnvSpec
}

export function TrajectoryPathVisualizer({
  rolloutSteps,
  envSpec,
}: TrajectoryPathVisualizerProps) {
  const [analysis, setAnalysis] = useState<TrajectoryAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (rolloutSteps.length === 0) return

    setLoading(true)
    setError(null)

    const cleanup = analyzeTrajectoryStreaming(
      { rollout_steps: rolloutSteps, env_spec: envSpec },
      {
        onProgress: () => {},
        onComplete: (backendAnalysis) => {
          setAnalysis(backendAnalysis)
          setLoading(false)
        },
        onError: (err) => {
          setError(err.message)
          setLoading(false)
        },
      }
    )

    return cleanup
  }, [rolloutSteps, envSpec])

  // Calculate visualization data
  const vizData = useMemo(() => {
    if (!analysis) return null

    const world = envSpec.world || {}
    const worldWidth = world.width || 10
    const worldHeight = world.height || 10
    const isGrid = world.coordinateSystem === 'grid'

    // SVG dimensions
    const svgWidth = 500
    const svgHeight = 400
    const padding = 40

    const drawWidth = svgWidth - padding * 2
    const drawHeight = svgHeight - padding * 2
    const scaleX = drawWidth / worldWidth
    const scaleY = drawHeight / worldHeight
    const scale = Math.min(scaleX, scaleY)

    const offsetX = padding + (drawWidth - worldWidth * scale) / 2
    const offsetY = padding + (drawHeight - worldHeight * scale) / 2

    const toSVG = (x: number, y: number): [number, number] => {
      if (isGrid) {
        return [offsetX + (x + 0.5) * scale, offsetY + (y + 0.5) * scale]
      }
      return [offsetX + x * scale, svgHeight - offsetY - y * scale]
    }

    // Process trajectory path
    const trajectory = analysis.trajectory_path || []
    const pathPoints: Array<{ x: number; y: number; step: number; reward: number }> = []

    trajectory.forEach((point, idx) => {
      if (point.position && Array.isArray(point.position)) {
        const [svgX, svgY] = toSVG(point.position[0], point.position[1])
        pathPoints.push({
          x: svgX,
          y: svgY,
          step: point.step || idx,
          reward: point.reward || 0,
        })
      }
    })

    // Get objects from envSpec
    const objects = (envSpec.objects || []).map((obj) => {
      if (!obj.position) return null
      const [svgX, svgY] = toSVG(obj.position[0], obj.position[1])
      return { ...obj, svgX, svgY }
    }).filter(Boolean)

    // Get suboptimal attractors
    const attractors = (analysis.suboptimal_attractors || []).map((attr) => {
      if (!attr.position) return null
      const [svgX, svgY] = toSVG(attr.position[0], attr.position[1])
      return { ...attr, svgX, svgY }
    }).filter(Boolean)

    // Create path string for SVG polyline
    const pathString = pathPoints.map((p) => `${p.x},${p.y}`).join(' ')

    return {
      svgWidth,
      svgHeight,
      worldWidth,
      worldHeight,
      scale,
      offsetX,
      offsetY,
      pathPoints,
      pathString,
      objects,
      attractors,
      startPoint: pathPoints[0],
      endPoint: pathPoints[pathPoints.length - 1],
      isGrid,
    }
  }, [analysis, envSpec])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Analyzing trajectory...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (!analysis || !vizData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">No trajectory data</div>
      </div>
    )
  }

  // Export functions
  const exportAsPNG = () => {
    if (!svgRef.current) return
    const svg = svgRef.current
    const canvas = document.createElement('canvas')
    canvas.width = vizData.svgWidth * 2
    canvas.height = vizData.svgHeight * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)
    const data = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'trajectory.png'
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)))
  }

  const exportAsJSON = () => {
    const data = {
      trajectory: analysis?.trajectory_path || [],
      metrics: {
        pathLength: analysis?.trajectory_length,
        pathEfficiency: analysis?.path_efficiency,
        oscillationDetected: analysis?.oscillation_detection?.detected,
        actionDistribution: analysis?.action_distribution,
      },
      env: {
        width: envSpec.world?.width,
        height: envSpec.world?.height,
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trajectory.json'
    a.click()
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            −
          </button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            +
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportAsPNG}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            PNG
          </button>
          <button
            onClick={exportAsJSON}
            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
          >
            JSON
          </button>
        </div>
      </div>

      {/* SVG Visualization */}
      <div 
        className="flex justify-center overflow-hidden border border-border rounded-lg bg-muted/10"
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={vizData.svgWidth}
          height={vizData.svgHeight}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s',
          }}
        >
          {/* Grid lines */}
          {vizData.isGrid && (
            <g className="grid-lines" opacity={0.15}>
              {Array.from({ length: vizData.worldWidth + 1 }, (_, i) => (
                <line
                  key={`v-${i}`}
                  x1={vizData.offsetX + i * vizData.scale}
                  y1={vizData.offsetY}
                  x2={vizData.offsetX + i * vizData.scale}
                  y2={vizData.offsetY + vizData.worldHeight * vizData.scale}
                  stroke="currentColor"
                  strokeWidth={0.5}
                />
              ))}
              {Array.from({ length: vizData.worldHeight + 1 }, (_, i) => (
                <line
                  key={`h-${i}`}
                  x1={vizData.offsetX}
                  y1={vizData.offsetY + i * vizData.scale}
                  x2={vizData.offsetX + vizData.worldWidth * vizData.scale}
                  y2={vizData.offsetY + i * vizData.scale}
                  stroke="currentColor"
                  strokeWidth={0.5}
                />
              ))}
            </g>
          )}

          {/* Objects */}
          {vizData.objects.map((obj: any, idx: number) => {
            const color = obj.type === 'goal' ? '#22c55e' : obj.type === 'trap' ? '#ef4444' : '#6b7280'
            return (
              <g key={idx}>
                <rect
                  x={obj.svgX - vizData.scale * 0.4}
                  y={obj.svgY - vizData.scale * 0.4}
                  width={vizData.scale * 0.8}
                  height={vizData.scale * 0.8}
                  fill={color}
                  opacity={0.3}
                  rx={2}
                />
                <rect
                  x={obj.svgX - vizData.scale * 0.4}
                  y={obj.svgY - vizData.scale * 0.4}
                  width={vizData.scale * 0.8}
                  height={vizData.scale * 0.8}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  rx={2}
                />
              </g>
            )
          })}

          {/* Suboptimal attractors */}
          {vizData.attractors.map((attr: any, idx: number) => (
            <circle
              key={idx}
              cx={attr.svgX}
              cy={attr.svgY}
              r={vizData.scale * 0.6}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.6}
            />
          ))}

          {/* Trajectory path */}
          {vizData.pathString && (
            <polyline
              points={vizData.pathString}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          )}

          {/* Path points (sampled for performance) */}
          {vizData.pathPoints
            .filter((_, i) => i === 0 || i === vizData.pathPoints.length - 1 || i % Math.max(1, Math.floor(vizData.pathPoints.length / 20)) === 0)
            .map((point, idx) => (
              <circle
                key={idx}
                cx={point.x}
                cy={point.y}
                r={3}
                fill="#3b82f6"
                opacity={0.5}
                onMouseEnter={() => setHoveredStep(point.step)}
                onMouseLeave={() => setHoveredStep(null)}
                className="cursor-pointer"
              />
            ))}

          {/* Start point */}
          {vizData.startPoint && (
            <circle
              cx={vizData.startPoint.x}
              cy={vizData.startPoint.y}
              r={8}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={2}
            />
          )}

          {/* End point */}
          {vizData.endPoint && (
            <circle
              cx={vizData.endPoint.x}
              cy={vizData.endPoint.y}
              r={8}
              fill="#f59e0b"
              stroke="white"
              strokeWidth={2}
            />
          )}

          {/* Hovered point tooltip */}
          {hoveredStep !== null && vizData.pathPoints[hoveredStep] && (
            <g>
              <rect
                x={vizData.pathPoints[hoveredStep].x + 10}
                y={vizData.pathPoints[hoveredStep].y - 25}
                width={80}
                height={20}
                fill="hsl(var(--popover))"
                stroke="hsl(var(--border))"
                rx={4}
              />
              <text
                x={vizData.pathPoints[hoveredStep].x + 50}
                y={vizData.pathPoints[hoveredStep].y - 11}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--foreground))"
              >
                Step {hoveredStep}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>End</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/50 border border-green-500" />
          <span>Goal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/50 border border-red-500" />
          <span>Trap</span>
        </div>
        {vizData.attractors.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-dashed border-amber-500" />
            <span>Attractor</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricBox
          label="Path Length"
          value={String(analysis.trajectory_length || 0)}
          unit="steps"
        />
        <MetricBox
          label="Path Efficiency"
          value={`${((analysis.path_efficiency || 0) * 100).toFixed(1)}%`}
        />
        <MetricBox
          label="Oscillations"
          value={analysis.oscillation_detection?.detected ? 'Detected' : 'None'}
          warning={analysis.oscillation_detection?.detected}
        />
        <MetricBox
          label="Attractors"
          value={String(analysis.suboptimal_attractors?.length || 0)}
          warning={analysis.suboptimal_attractors && analysis.suboptimal_attractors.length > 0}
        />
      </div>

      {/* Action Distribution */}
      {analysis.action_distribution && Object.keys(analysis.action_distribution).length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2">Actions Taken</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analysis.action_distribution)
              .sort(([, a], [, b]) => (b || 0) - (a || 0))
              .map(([action, count]) => {
                const total = Object.values(analysis.action_distribution).reduce(
                  (a: number, b: number) => a + (b || 0),
                  0
                )
                const pct = total > 0 ? ((count || 0) / total) * 100 : 0
                return (
                  <div
                    key={action}
                    className="px-2 py-1 bg-muted rounded text-xs font-mono"
                  >
                    {action}: {count} ({pct.toFixed(0)}%)
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricBox({
  label,
  value,
  unit,
  warning,
}: {
  label: string
  value: string
  unit?: string
  warning?: boolean
}) {
  return (
    <div className="border border-border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${warning ? 'text-amber-600' : ''}`}>
        {value}
        {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
      </div>
    </div>
  )
}
