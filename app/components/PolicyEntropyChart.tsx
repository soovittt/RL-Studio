/**
 * Policy Entropy Over Time Component
 * Clean professional visualization of policy entropy
 */

import { useEffect, useState } from 'react'
import { analyzeTrajectoryStreaming, type TrajectoryAnalysis } from '~/lib/analysisClient'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { EnvSpec } from '~/lib/envSpec'

interface PolicyEntropyChartProps {
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

export function PolicyEntropyChart({ rollouts, envSpec }: PolicyEntropyChartProps) {
  const [entropyData, setEntropyData] = useState<Array<{ step: number; entropy: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rollouts.length === 0) return

    setLoading(true)
    setError(null)

    const analyses: Array<{ step: number; entropy: number }> = []
    let completed = 0
    const total = rollouts.length

    rollouts.forEach((rolloutSteps, idx) => {
      analyzeTrajectoryStreaming(
        { rollout_steps: rolloutSteps, env_spec: envSpec },
        {
          onProgress: () => {},
          onComplete: (analysis: TrajectoryAnalysis) => {
            analyses.push({
              step: idx + 1,
              entropy: analysis.policy_entropy || 0,
            })
            completed++

            if (completed === total) {
              analyses.sort((a, b) => a.step - b.step)
              setEntropyData(analyses)
              setLoading(false)
            }
          },
          onError: (err) => {
            setError(err.message)
            setLoading(false)
          },
        }
      )
    })
  }, [rollouts, envSpec])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">Analyzing entropy...</div>
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

  if (entropyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-sm text-muted-foreground">
          Run multiple rollouts to see entropy analysis
        </div>
      </div>
    )
  }

  const meanEntropy = entropyData.reduce((sum, d) => sum + d.entropy, 0) / entropyData.length
  const minEntropy = Math.min(...entropyData.map((d) => d.entropy))
  const maxEntropy = Math.max(...entropyData.map((d) => d.entropy))

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-border rounded p-2">
          <div className="text-xs text-muted-foreground">Rollouts</div>
          <div className="text-lg font-mono font-semibold">{rollouts.length}</div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-xs text-muted-foreground">Mean</div>
          <div className="text-lg font-mono font-semibold">{meanEntropy.toFixed(3)}</div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-xs text-muted-foreground">Min</div>
          <div className="text-lg font-mono font-semibold">{minEntropy.toFixed(3)}</div>
        </div>
        <div className="border border-border rounded p-2">
          <div className="text-xs text-muted-foreground">Max</div>
          <div className="text-lg font-mono font-semibold">{maxEntropy.toFixed(3)}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={entropyData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="step"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            label={{ value: 'Rollout', position: 'insideBottom', offset: -5, fontSize: 11 }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            domain={[0, Math.max(maxEntropy * 1.1, 2)]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value.toFixed(3)} bits`, 'Entropy']}
          />
          <ReferenceLine
            y={meanEntropy}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="3 3"
            opacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="entropy"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3, fill: '#6366f1' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Interpretation */}
      <div className="text-xs text-muted-foreground">
        <p>
          <strong>High entropy (&gt;1.5):</strong> Exploring, diverse actions. <strong>Low entropy (&lt;0.5):</strong> Exploiting, deterministic.
        </p>
      </div>
    </div>
  )
}
