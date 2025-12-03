/**
 * Trajectory Path Visualizer Component
 * REQUIRES Python backend - NO FALLBACKS
 * Real calculations use NumPy, SciPy, sklearn in backend
 */

import { useEffect, useState, useRef } from 'react'
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
  width?: number
  height?: number
}

export function TrajectoryPathVisualizer({
  rolloutSteps,
  envSpec,
  width = 600,
  height = 400,
}: TrajectoryPathVisualizerProps) {
  const [analysis, setAnalysis] = useState<TrajectoryAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ progress: number; message: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (rolloutSteps.length === 0) return

    setLoading(true)
    setError(null)
    setProgress(null)

    // Use streaming for real-time updates
    const cleanup = analyzeTrajectoryStreaming(
      { rollout_steps: rolloutSteps, env_spec: envSpec },
      {
        onProgress: (prog, msg) => {
          setProgress({ progress: prog, message: msg })
        },
        onComplete: (backendAnalysis) => {
          setAnalysis(backendAnalysis)
          setProgress(null)
          setLoading(false)
          console.log(
            '✅ Trajectory analysis complete - Real Python calculations (NumPy, SciPy, sklearn)'
          )
        },
        onError: (err) => {
          setError(err.message)
          setLoading(false)
          setProgress(null)
          console.error('❌ Trajectory analysis failed:', err)
        },
      }
    )

    return cleanup
  }, [rolloutSteps, envSpec])

  useEffect(() => {
    if (!analysis || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get world bounds
    const world = envSpec.world || {}
    const worldWidth = world.width || 10
    const worldHeight = world.height || 10
    const isGrid = world.coordinateSystem === 'grid'
    const cellSize = world.cellSize || 1

    // Coordinate transformation with padding
    const padding = 20
    const drawWidth = width - padding * 2
    const drawHeight = height - padding * 2
    const scaleX = drawWidth / (worldWidth * cellSize)
    const scaleY = drawHeight / (worldHeight * cellSize)
    const scale = Math.min(scaleX, scaleY) // Maintain aspect ratio

    const worldToCanvas = (wx: number, wy: number): [number, number] => {
      if (isGrid) {
        const x = padding + wx * scale
        const y = padding + wy * scale
        return [x, y]
      } else {
        const x = width / 2 + wx * scale
        const y = height / 2 - wy * scale // Flip Y axis
        return [x, y]
      }
    }

    // Draw obstacles
    envSpec.objects
      ?.filter((o) => o.type === 'wall' || o.type === 'obstacle')
      .forEach((obj) => {
        const [x, y] = worldToCanvas(obj.position[0], obj.position[1])
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      })

    // Draw goals
    envSpec.objects
      ?.filter((o) => o.type === 'goal')
      .forEach((obj) => {
        const [x, y] = worldToCanvas(obj.position[0], obj.position[1])
        ctx.fillStyle = '#10b981'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      })

    // Draw trajectory path from backend analysis
    if (analysis.trajectory_path && analysis.trajectory_path.length > 0) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()

      analysis.trajectory_path.forEach((point, idx) => {
        if (
          point &&
          point.position &&
          Array.isArray(point.position) &&
          point.position.length >= 2
        ) {
          const [x, y] = worldToCanvas(point.position[0], point.position[1])
          if (idx === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
      })

      ctx.stroke()

      // Draw path points
      analysis.trajectory_path.forEach((point) => {
        if (
          point &&
          point.position &&
          Array.isArray(point.position) &&
          point.position.length >= 2
        ) {
          const [x, y] = worldToCanvas(point.position[0], point.position[1])
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Draw start point
      const start = analysis.trajectory_path[0]
      if (start && start.position && Array.isArray(start.position) && start.position.length >= 2) {
        const [x, y] = worldToCanvas(start.position[0], start.position[1])
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw end point
      const end = analysis.trajectory_path[analysis.trajectory_path.length - 1]
      if (end && end.position && Array.isArray(end.position) && end.position.length >= 2) {
        const [x, y] = worldToCanvas(end.position[0], end.position[1])
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw suboptimal attractors (from sklearn DBSCAN clustering)
      if (analysis.suboptimal_attractors && Array.isArray(analysis.suboptimal_attractors)) {
        analysis.suboptimal_attractors.forEach((attractor) => {
          if (
            attractor &&
            attractor.position &&
            Array.isArray(attractor.position) &&
            attractor.position.length >= 2
          ) {
            const [x, y] = worldToCanvas(attractor.position[0], attractor.position[1])
            ctx.strokeStyle = '#ef4444'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(x, y, 15, 0, Math.PI * 2)
            ctx.stroke()
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'
            ctx.beginPath()
            ctx.arc(x, y, 15, 0, Math.PI * 2)
            ctx.fill()
          }
        })
      }
    }
  }, [analysis, envSpec, width, height])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-sm mb-2">Running Python analysis (NumPy, SciPy, sklearn)...</div>
        {progress && (
          <div className="text-xs text-muted-foreground">
            {progress.message}{' '}
            {progress.progress > 0 && `(${Math.round(progress.progress * 100)}%)`}
          </div>
        )}
        <div className="mt-4 w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(progress?.progress || 0) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive border border-destructive/50 rounded-lg p-4 bg-destructive/10">
        <div className="font-semibold mb-2">❌ Backend Required</div>
        <div className="text-sm text-center">{error}</div>
        <div className="text-xs mt-2 text-muted-foreground">
          Real Python calculations (NumPy, SciPy, sklearn) are required. Backend:{' '}
          <code className="bg-muted px-1 rounded">
            {import.meta.env.VITE_ROLLOUT_SERVICE_URL || 'http://localhost:8000'}
          </code>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No trajectory data available
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Professional Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-xl font-bold text-foreground">Trajectory Path Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Agent movement visualization with RL metrics
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">
            {analysis.trajectory_length} steps
          </div>
          <div className="text-xs text-muted-foreground">
            Efficiency: {(analysis.path_efficiency * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-green-600 font-mono mt-1">✓ NumPy/SciPy/sklearn</div>
        </div>
      </div>

      {/* Professional Canvas Visualization */}
      <div className="border border-border rounded-lg bg-gradient-to-br from-muted/10 to-muted/5 p-4 shadow-sm">
        <canvas ref={canvasRef} width={width} height={height} className="w-full h-auto rounded" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-500" />
          <span>End</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span>Goal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span>Obstacle</span>
        </div>
        {analysis.suboptimal_attractors && analysis.suboptimal_attractors.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-red-500 bg-red-500/20" />
            <span>Attractor ({analysis.suboptimal_attractors.length})</span>
          </div>
        )}
      </div>

      {/* Professional Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Policy Entropy</div>
          <div className="text-2xl font-bold text-foreground">
            {(analysis.policy_entropy || 0).toFixed(3)}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            scipy.stats.entropy
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Path Efficiency</div>
          <div className="text-2xl font-bold text-foreground">
            {(analysis.path_efficiency * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            scipy.spatial.distance
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Oscillations</div>
          <div
            className={`text-2xl font-bold ${analysis.oscillation_detection?.detected ? 'text-orange-600' : 'text-green-600'}`}
          >
            {analysis.oscillation_detection?.detected ? 'Detected' : 'None'}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">
            scipy.signal.correlate
          </div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Suboptimal Attractors</div>
          <div className="text-2xl font-bold text-foreground">
            {analysis.suboptimal_attractors?.length || 0}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">sklearn.DBSCAN</div>
        </div>
      </div>

      {/* Action Distribution */}
      {analysis.action_distribution && Object.keys(analysis.action_distribution).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Action Distribution</h4>
          <div className="space-y-2">
            {Object.entries(analysis.action_distribution)
              .sort(([, a], [, b]) => (b || 0) - (a || 0))
              .map(([action, count]) => {
                const total = Object.values(analysis.action_distribution).reduce(
                  (a: number, b: number) => a + (b || 0),
                  0
                )
                const percentage = total > 0 ? ((count || 0) / total) * 100 : 0
                return (
                  <div key={action} className="flex items-center gap-2">
                    <div className="w-32 text-xs text-muted-foreground truncate" title={action}>
                      {action.length > 20 ? action.substring(0, 20) + '...' : action}
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="w-20 text-xs text-right">
                      {count || 0} ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
