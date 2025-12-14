/**
 * Termination Analysis Chart Component
 * Clean professional visualization of termination patterns
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

export function TerminationAnalysisChart({ rollouts, envSpec }: TerminationAnalysisChartProps) {
  const [analysis, setAnalysis] = useState<TerminationAnalysisMultiple | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rollouts.length === 0) return

    setLoading(true)
    setError(null)

    const cleanup = analyzeMultipleTerminationsStreaming(rollouts, envSpec, {
      onProgress: () => {},
      onComplete: (backendAnalysis) => {
        setAnalysis(backendAnalysis)
        setLoading(false)
      },
      onError: (err) => {
        setError(err.message)
        setLoading(false)
      },
    })

    return cleanup
  }, [rollouts, envSpec])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">Analyzing terminations...</div>
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

  if (!analysis || !analysis.top_causes || analysis.top_causes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">
          Run multiple rollouts to see termination analysis
        </div>
      </div>
    )
  }

  // Prepare data
  const terminationData = (analysis.top_causes || [])
    .filter((item) => Array.isArray(item) && item.length >= 2)
    .map(([reason, count]) => ({
      reason: (reason || 'unknown').length > 15 ? (reason || 'unknown').substring(0, 15) + '...' : reason || 'unknown',
      count: count || 0,
      fullReason: reason || 'unknown',
    }))

  const stepData = (analysis.heatmap_data || [])
    .filter((item) => item && item.reason)
    .map((item) => ({
      reason: (item.reason || 'unknown').length > 15 ? (item.reason || 'unknown').substring(0, 15) + '...' : item.reason || 'unknown',
      mean: item.mean_step || 0,
      std: item.std_step || 0,
      count: item.count || 0,
    }))

  return (
    <div className="space-y-6">
      {/* Termination Frequency */}
      <div>
        <h4 className="text-xs font-medium mb-3">Termination Frequency</h4>
        {terminationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={terminationData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="reason"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={60}
                tickLine={false}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [value, 'Episodes']}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
            No termination data
          </div>
        )}
      </div>

      {/* Step Statistics Table */}
      {stepData.length > 0 && (
        <div>
          <h4 className="text-xs font-medium mb-3">Termination Step Statistics</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Reason</th>
                  <th className="text-right px-3 py-2 font-medium">Count</th>
                  <th className="text-right px-3 py-2 font-medium">Mean Step</th>
                  <th className="text-right px-3 py-2 font-medium">Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {stepData.map((row, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-3 py-2">{row.reason}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.count}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.mean.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.std.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {analysis.premature_terminations && analysis.premature_terminations.length > 0 && (
        <div className="text-xs text-amber-600">
          ⚠ {analysis.premature_terminations.length} premature termination(s) detected
        </div>
      )}
    </div>
  )
}
