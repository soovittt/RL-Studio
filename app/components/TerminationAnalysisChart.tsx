/**
 * Termination Analysis Chart Component
 * REQUIRES Python backend - NO FALLBACKS
 * Real calculations use scipy.stats in backend
 */

import { useEffect, useState } from 'react'
import {
  analyzeMultipleTerminationsStreaming,
  type TerminationAnalysisMultiple,
} from '~/lib/analysisClient'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { EnvSpec } from '~/lib/envSpec'

interface TerminationAnalysisChartProps {
  rollouts: Array<
    Array<{
      state: any
      action: any
      reward: number
      done: boolean
    }>
  >
  envSpec: EnvSpec
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export function TerminationAnalysisChart({ rollouts, envSpec }: TerminationAnalysisChartProps) {
  const [analysis, setAnalysis] = useState<TerminationAnalysisMultiple | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ progress: number; message: string } | null>(null)

  useEffect(() => {
    if (rollouts.length === 0) return

    setLoading(true)
    setError(null)
    setProgress(null)

    // Use streaming for real-time updates
    const cleanup = analyzeMultipleTerminationsStreaming(rollouts, envSpec, {
      onProgress: (prog, msg) => {
        setProgress({ progress: prog, message: msg })
      },
      onComplete: (backendAnalysis) => {
        setAnalysis(backendAnalysis)
        setProgress(null)
        setLoading(false)
        console.log('✅ Termination analysis complete - Real Python calculations (scipy.stats)')
      },
      onError: (err) => {
        setError(err.message)
        setLoading(false)
        setProgress(null)
        console.error('❌ Termination analysis failed:', err)
      },
    })

    return cleanup
  }, [rollouts, envSpec])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-sm mb-2">Running Python analysis (scipy.stats)...</div>
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
          Real Python calculations (scipy.stats) are required. Backend:{' '}
          <code className="bg-muted px-1 rounded">
            {import.meta.env.VITE_ROLLOUT_SERVICE_URL || 'http://localhost:8000'}
          </code>
        </div>
      </div>
    )
  }

  if (!analysis || !analysis.top_causes || analysis.top_causes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No termination data available. Run multiple rollouts to see termination analysis.
      </div>
    )
  }

  // Prepare chart data
  const terminationCountsData = (analysis.top_causes || [])
    .filter((item) => Array.isArray(item) && item.length >= 2)
    .map(([reason, count], idx) => ({
      reason:
        (reason || 'unknown').length > 20
          ? (reason || 'unknown').substring(0, 20) + '...'
          : reason || 'unknown',
      count: count || 0,
      fullReason: reason || 'unknown',
      color: COLORS[idx % COLORS.length],
    }))

  const heatmapData = (analysis.heatmap_data || [])
    .filter((item) => item && item.reason)
    .map((item, idx) => ({
      reason:
        (item.reason || 'unknown').length > 20
          ? (item.reason || 'unknown').substring(0, 20) + '...'
          : item.reason || 'unknown',
      meanStep: item.mean_step || 0,
      medianStep: item.median_step || 0,
      stdStep: item.std_step || 0,
      minStep: item.min_step || 0,
      maxStep: item.max_step || 0,
      count: item.count || 0,
      fullReason: item.reason || 'unknown',
      color: COLORS[idx % COLORS.length],
    }))

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-xl font-bold text-foreground">Termination Pattern Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Statistical analysis of episode termination causes
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">{rollouts.length} rollouts</div>
          <div className="text-xs text-green-600 font-mono mt-1">✓ scipy.stats</div>
        </div>
      </div>

      {/* Termination Counts Bar Chart - Professional */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-bold text-foreground">Termination Frequency Distribution</h4>
          <span className="text-xs text-muted-foreground font-mono">Count</span>
        </div>
        {terminationCountsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={terminationCountsData}
              margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis
                dataKey="reason"
                stroke="hsl(var(--muted-foreground))"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Frequency',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
                labelStyle={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [value, 'Episodes']}
                labelFormatter={(label) => {
                  const item = terminationCountsData.find((d) => d.reason === label)
                  return item?.fullReason || label
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No termination data available
          </div>
        )}
      </div>

      {/* Termination Step Distribution - Professional Statistical Chart */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-bold text-foreground">Termination Step Statistics</h4>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-muted-foreground">Mean (tmean)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-muted-foreground">Median</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-purple-500" />
              <span className="text-muted-foreground">Std (tstd)</span>
            </div>
          </div>
        </div>
        {heatmapData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={heatmapData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis
                dataKey="reason"
                stroke="hsl(var(--muted-foreground))"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                label={{
                  value: 'Step',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
                labelStyle={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'meanStep') return [value.toFixed(1), 'Mean (scipy.stats.tmean)']
                  if (name === 'medianStep') return [value.toFixed(1), 'Median']
                  if (name === 'stdStep') return [value.toFixed(1), 'Std Dev (scipy.stats.tstd)']
                  return [value, name]
                }}
                labelFormatter={(label) => {
                  const item = heatmapData.find((d) => d.reason === label)
                  return item?.fullReason || label
                }}
              />
              <Bar dataKey="meanStep" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="medianStep" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
              <Bar dataKey="stdStep" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No step distribution data available
          </div>
        )}
      </div>

      {/* Pie Chart */}
      {terminationCountsData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-md font-semibold mb-4">Termination Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={terminationCountsData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ reason, percent }) => `${reason}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {terminationCountsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conflicting Rules */}
      {analysis.conflicting_rules &&
        Array.isArray(analysis.conflicting_rules) &&
        analysis.conflicting_rules.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-4">
            <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
              ⚠️ Conflicting Termination Rules
            </h4>
            <div className="space-y-2">
              {analysis.conflicting_rules
                .filter((conflict) => conflict && conflict.rule)
                .map((conflict, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium">{conflict.rule}</div>
                    <div className="text-muted-foreground">
                      Frequency: {((conflict.frequency || 0) * 100).toFixed(1)}% | Conflicts with:{' '}
                      {(conflict.conflict_with || []).join(', ')}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Premature Terminations */}
      {analysis.premature_terminations &&
        Array.isArray(analysis.premature_terminations) &&
        analysis.premature_terminations.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-md p-4">
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">
              ⚠️ Premature Terminations (scipy.stats.percentile)
            </h4>
            <div className="space-y-2">
              {analysis.premature_terminations
                .filter((premature) => premature && premature.reason)
                .map((premature, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium">{premature.reason}</div>
                    <div className="text-muted-foreground">
                      {premature.count || 0} episodes | Mean step:{' '}
                      {(premature.mean_step || 0).toFixed(1)} | Threshold:{' '}
                      {(premature.threshold || 0).toFixed(1)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  )
}
