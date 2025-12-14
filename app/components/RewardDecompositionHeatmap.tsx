/**
 * Reward Decomposition Heatmap Component
 * Clean, professional visualization of reward attribution
 */

import { useEffect, useState, useMemo } from 'react'
import { analyzeRewardStreaming, type RewardAnalysis } from '~/lib/analysisClient'
import { EnvSpec } from '~/lib/envSpec'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface RewardDecompositionHeatmapProps {
  rolloutSteps: Array<{
    state: any
    action: any
    reward: number
    done: boolean
  }>
  envSpec: EnvSpec
}

export function RewardDecompositionHeatmap({
  rolloutSteps,
  envSpec,
}: RewardDecompositionHeatmapProps) {
  const [analysis, setAnalysis] = useState<RewardAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rolloutSteps.length === 0) return

    setLoading(true)
    setError(null)

    const cleanup = analyzeRewardStreaming(
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

  // Process chart data
  const chartData = useMemo(() => {
    if (!analysis?.cumulative_contributions) return []

    const contributions = analysis.cumulative_contributions
    const maxLength = Math.max(
      ...Object.values(contributions).map((v: any) => (Array.isArray(v) ? v.length : 0))
    )

    // Sample data for performance (max 200 points)
    const sampleRate = Math.max(1, Math.floor(maxLength / 200))

    return Array.from({ length: Math.ceil(maxLength / sampleRate) }, (_, idx) => {
      const step = idx * sampleRate
      const dataPoint: Record<string, number> = { step }
      Object.entries(contributions).forEach(([rule, values]: [string, any]) => {
        if (Array.isArray(values) && values[step] !== undefined) {
          const shortRule = rule.length > 15 ? rule.substring(0, 15) + '...' : rule
          dataPoint[shortRule] = typeof values[step] === 'number' ? values[step] : 0
        }
      })
      return dataPoint
    })
  }, [analysis])

  // Get rule names for chart
  const ruleNames = useMemo(() => {
    if (!analysis?.cumulative_contributions) return []
    return Object.keys(analysis.cumulative_contributions).map((rule) =>
      rule.length > 15 ? rule.substring(0, 15) + '...' : rule
    )
  }, [analysis])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">Analyzing rewards...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (!analysis || !analysis.heatmap_data || analysis.heatmap_data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">
          No reward data. Add reward rules to see activity.
        </div>
      </div>
    )
  }

  const rules = Object.keys(analysis.per_rule_stats || {})
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Total Reward</div>
          <div className={`text-lg font-semibold font-mono ${analysis.episode_total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {analysis.episode_total >= 0 ? '+' : ''}{analysis.episode_total.toFixed(2)}
          </div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Episode Length</div>
          <div className="text-lg font-semibold font-mono">{analysis.episode_length}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs text-muted-foreground">Reward Density</div>
          <div className="text-lg font-semibold font-mono">{analysis.reward_density.toFixed(4)}</div>
        </div>
      </div>

      {/* Rule Performance Table */}
      {rules.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2">Reward Rules Performance</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Rule</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                  <th className="text-right px-3 py-2 font-medium">Fires</th>
                  <th className="text-right px-3 py-2 font-medium">Rate</th>
                  <th className="text-right px-3 py-2 font-medium">Mean</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => {
                  const stats = analysis.per_rule_stats[rule]
                  if (!stats) return null
                  return (
                    <tr key={rule} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: colors[idx % colors.length] }}
                          />
                          <span className="truncate max-w-[150px]" title={rule}>
                            {rule}
                          </span>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${stats.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stats.total >= 0 ? '+' : ''}{stats.total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{stats.fire_count}</td>
                      <td className="px-3 py-2 text-right font-mono">{(stats.fire_rate * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-mono">{stats.mean.toFixed(3)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cumulative Reward Chart */}
      {chartData.length > 0 && ruleNames.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-2">Cumulative Rewards Over Time</h4>
          <div className="border border-border rounded-lg p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="step"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => value.toFixed(2)}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconSize={8}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" opacity={0.5} />
                {ruleNames.map((rule, idx) => (
                  <Line
                    key={rule}
                    type="monotone"
                    dataKey={rule}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Warnings */}
      {analysis.warnings && analysis.warnings.length > 0 && (
        <div className="text-xs text-amber-600 space-y-1">
          {analysis.warnings.map((warning, i) => (
            <div key={i}>⚠ {warning}</div>
          ))}
        </div>
      )}
    </div>
  )
}

