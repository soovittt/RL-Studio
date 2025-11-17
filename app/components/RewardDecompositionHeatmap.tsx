/**
 * Reward Decomposition Heatmap Component
 * REQUIRES Python backend - NO FALLBACKS
 * Real calculations use NumPy, SciPy in backend
 */

import { useEffect, useState } from 'react'
import { analyzeReward, analyzeRewardStreaming, type RewardAnalysis } from '~/lib/analysisClient'
import { EnvSpec } from '~/lib/envSpec'

interface RewardDecompositionHeatmapProps {
  rolloutSteps: Array<{
    state: any
    action: any
    reward: number
    done: boolean
  }>
  envSpec: EnvSpec
}

export function RewardDecompositionHeatmap({ rolloutSteps, envSpec }: RewardDecompositionHeatmapProps) {
  const [analysis, setAnalysis] = useState<RewardAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ progress: number; message: string } | null>(null)

  useEffect(() => {
    if (rolloutSteps.length === 0) return

    setLoading(true)
    setError(null)
    setProgress(null)
    
    // Use streaming for real-time updates
    const cleanup = analyzeRewardStreaming(
      { rollout_steps: rolloutSteps, env_spec: envSpec },
      {
        onProgress: (prog, msg) => {
          setProgress({ progress: prog, message: msg })
        },
        onComplete: (backendAnalysis) => {
          setAnalysis(backendAnalysis)
          setProgress(null)
          setLoading(false)
          console.log('✅ Reward analysis complete - Real Python calculations')
        },
        onError: (err) => {
          setError(err.message)
          setLoading(false)
          setProgress(null)
          console.error('❌ Reward analysis failed:', err)
        },
      }
    )

    return cleanup
  }, [rolloutSteps, envSpec])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-sm mb-2">Running Python analysis (NumPy, SciPy)...</div>
        {progress && (
          <div className="text-xs text-muted-foreground">
            {progress.message} {progress.progress > 0 && `(${Math.round(progress.progress * 100)}%)`}
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
          Real Python calculations (NumPy, SciPy) are required. Start backend at <code className="bg-muted px-1 rounded">http://localhost:8000</code>
        </div>
      </div>
    )
  }

  if (!analysis || !analysis.heatmap_data || analysis.heatmap_data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No reward data available. Add reward rules to see activity.
      </div>
    )
  }

  const maxStep = Math.max(...analysis.heatmap_data.map((d) => d.step || 0), rolloutSteps.length - 1)
  const rules = Array.from(new Set(analysis.heatmap_data.map((d) => d.rule || 'unknown').filter(Boolean)))
  const maxValue = Math.max(...analysis.heatmap_data.map((d) => Math.abs(d.value || 0)), 1)

  // Create grid data
  const gridData: Record<string, Record<number, number>> = {}
  rules.forEach((rule) => {
    gridData[rule] = {}
    for (let step = 0; step <= maxStep; step++) {
      gridData[rule][step] = 0
    }
  })

  analysis.heatmap_data.forEach((d) => {
    if (!gridData[d.rule]) gridData[d.rule] = {}
    gridData[d.rule][d.step] = (gridData[d.rule][d.step] || 0) + d.value
  })

  // Limit display to reasonable number of steps (sample if too many)
  const displaySteps = maxStep > 100 ? 100 : maxStep + 1
  const stepInterval = maxStep > 100 ? Math.ceil(maxStep / 100) : 1

  return (
    <div className="space-y-5">
      {/* Professional Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-xl font-bold text-foreground">Reward Decomposition Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">Per-rule reward attribution over episode</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">{analysis.episode_length} steps</div>
          <div className="text-xs text-muted-foreground">{rules.length} reward rules</div>
          <div className="text-xs text-green-600 font-mono mt-1">✓ NumPy/SciPy</div>
        </div>
      </div>

      {/* Professional Heatmap Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">Reward Activity Heatmap</span>
          <span className="text-muted-foreground">{maxStep > 100 ? `Sampled: ${displaySteps} of ${maxStep + 1} steps` : 'All steps'}</span>
        </div>
        <div className="overflow-x-auto border border-border rounded-lg bg-gradient-to-br from-muted/20 to-muted/5 p-4 shadow-sm">
          <div className="space-y-2" style={{ minWidth: `${displaySteps * 10}px` }}>
            {rules.map((rule, ruleIdx) => (
              <div key={rule} className="flex items-center gap-3 group">
                <div className="w-36 text-xs font-semibold truncate text-foreground" title={rule}>
                  {ruleIdx + 1}. {rule.length > 25 ? rule.substring(0, 25) + '...' : rule}
                </div>
                <div className="flex gap-0.5 flex-1 h-8 items-center">
                  {Array.from({ length: displaySteps }, (_, idx) => {
                    const step = idx * stepInterval
                    const value = gridData[rule][step] || 0
                    const intensity = Math.min(Math.abs(value) / maxValue, 1)
                    const isPositive = value >= 0
                    const bgColor = isPositive 
                      ? `rgba(34, 197, 94, ${Math.max(intensity, 0.3)})` // green with minimum visibility
                      : `rgba(239, 68, 68, ${Math.max(intensity, 0.3)})` // red with minimum visibility
                    
                    return (
                      <div
                        key={`${rule}-${step}`}
                        className="h-full rounded transition-all hover:scale-y-125 cursor-pointer border border-border/30 shadow-sm"
                        style={{
                          backgroundColor: value !== 0 ? bgColor : 'rgba(0,0,0,0.05)',
                          width: `${100 / displaySteps}%`,
                          minWidth: '3px',
                        }}
                        title={`Rule: ${rule}\nStep: ${step}\nReward: ${value.toFixed(3)}`}
                      />
                    )
                  })}
                </div>
                <div className="w-20 text-xs text-right font-mono text-muted-foreground">
                  {((analysis.per_rule_stats?.[rule]?.total || 0) >= 0 ? '+' : '')}
                  {(analysis.per_rule_stats?.[rule]?.total || 0).toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500/60" />
            <span>Positive reward</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/60" />
            <span>Negative reward</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>No reward</span>
          </div>
        </div>
      </div>

      {/* Professional Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rules.map((rule, idx) => {
          const stats = analysis.per_rule_stats?.[rule]
          if (!stats) return null
          return (
            <div key={rule} className="p-4 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-sm text-foreground truncate flex-1" title={rule}>
                  {idx + 1}. {rule}
                </div>
                <div className={`text-lg font-bold ${(stats.total || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(stats.total || 0) >= 0 ? '+' : ''}{(stats.total || 0).toFixed(2)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Fires</div>
                  <div className="font-mono font-semibold">{stats.fire_count || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rate</div>
                  <div className="font-mono font-semibold">{((stats.fire_rate || 0) * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Mean</div>
                  <div className="font-mono text-xs">{(stats.mean || 0).toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Std</div>
                  <div className="font-mono text-xs">{(stats.std || 0).toFixed(3)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Warnings */}
      {analysis.warnings && Array.isArray(analysis.warnings) && analysis.warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-sm">
          <div className="font-semibold text-yellow-700 dark:text-yellow-400 mb-2">⚠️ Warnings:</div>
          <ul className="list-disc list-inside space-y-1">
            {analysis.warnings.map((warning, i) => (
              <li key={i} className="text-yellow-600 dark:text-yellow-400">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cumulative Contributions Chart - Professional RL Visualization */}
      {analysis.cumulative_contributions && Object.keys(analysis.cumulative_contributions).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Cumulative Reward Contributions</h4>
            <span className="text-xs text-muted-foreground font-mono">NumPy cumsum()</span>
          </div>
          <div className="h-72 border border-border rounded-lg bg-gradient-to-b from-muted/10 to-muted/5 p-4 shadow-sm">
            <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(analysis.episode_length, 100)} 200`} preserveAspectRatio="none" className="overflow-visible">
              {/* Grid lines */}
              {Array.from({ length: 5 }, (_, i) => (
                <line
                  key={`grid-${i}`}
                  x1="0"
                  y1={40 + i * 40}
                  x2={analysis.episode_length}
                  y2={40 + i * 40}
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                  opacity="0.3"
                />
              ))}
              
              {Object.entries(analysis.cumulative_contributions).map(([rule, values], idx) => {
                if (!Array.isArray(values) || values.length === 0) return null
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
                const color = colors[idx % colors.length]
                const maxVal = Math.max(...values.filter(v => typeof v === 'number' && !isNaN(v)), 1)
                const minVal = Math.min(...values.filter(v => typeof v === 'number' && !isNaN(v)), 0)
                const range = maxVal - minVal || 1
                
                const points = values
                  .map((v, step) => {
                    const normalizedValue = ((v || 0) - minVal) / range
                    const x = values.length > 1 ? (step / (values.length - 1)) * analysis.episode_length : 0
                    const y = 190 - (normalizedValue * 170) - 10
                    return `${x},${y}`
                  })
                  .filter((_, idx) => idx === 0 || idx === values.length - 1 || idx % Math.ceil(values.length / 50) === 0) // Sample for performance
                  .join(' ')
                
                if (!points || points.split(' ').length < 2) return null
                
                return (
                  <g key={rule}>
                    <polyline
                      points={points}
                      fill="none"
                      stroke={color}
                      strokeWidth="2.5"
                      opacity="0.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Legend */}
                    <text
                      x={analysis.episode_length - 5}
                      y={190 - (((values[values.length - 1] || 0) - minVal) / range) * 170 - 10}
                      fill={color}
                      fontSize="11"
                      textAnchor="end"
                      className="font-semibold"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                      {rule.length > 18 ? rule.substring(0, 18) + '...' : rule}
                    </text>
                  </g>
                )
              })}
              
              {/* Axes */}
              <line x1="0" y1="190" x2={analysis.episode_length} y2="190" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
              <line x1="0" y1="10" x2="0" y2="190" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Shows cumulative reward contribution from each rule over time</span>
            <span className="font-mono">scipy.stats + numpy</span>
          </div>
        </div>
      )}
    </div>
  )
}
