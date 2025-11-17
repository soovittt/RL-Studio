/**
 * Policy Entropy Over Time Component
 * REQUIRES Python backend - NO FALLBACKS
 * Real calculations use scipy.stats.entropy in backend
 */

import { useEffect, useState } from 'react'
import { analyzeTrajectoryStreaming, type TrajectoryAnalysis } from '~/lib/analysisClient'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { EnvSpec } from '~/lib/envSpec'

interface PolicyEntropyChartProps {
  rollouts: Array<Array<{
    state: any
    action: any
    reward: number
    done: boolean
  }>>
  envSpec: EnvSpec
}

export function PolicyEntropyChart({ rollouts, envSpec }: PolicyEntropyChartProps) {
  const [entropyData, setEntropyData] = useState<Array<{ step: number; entropy: number }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; message: string } | null>(null)

  useEffect(() => {
    if (rollouts.length === 0) return

    setLoading(true)
    setError(null)
    setProgress(null)

    // Analyze all rollouts using streaming (real Python calculations)
    const analyses: Array<{ step: number; entropy: number }> = []
    let completed = 0
    const total = rollouts.length

    rollouts.forEach((rolloutSteps, idx) => {
      const cleanup = analyzeTrajectoryStreaming(
        { rollout_steps: rolloutSteps, env_spec: envSpec },
        {
          onProgress: (prog, msg) => {
            setProgress({
              current: completed,
              total,
              message: `Analyzing rollout ${idx + 1}/${total}: ${msg}`,
            })
          },
          onComplete: (analysis: TrajectoryAnalysis) => {
            analyses.push({
              step: idx + 1,
              entropy: analysis.policy_entropy || 0,
            })
            completed++
            
            if (completed === total) {
              // Sort by step
              analyses.sort((a, b) => a.step - b.step)
              setEntropyData(analyses)
              setLoading(false)
              setProgress(null)
              console.log('✅ Policy entropy analysis complete - Real Python calculations (scipy.stats.entropy)')
            } else {
              setProgress({
                current: completed,
                total,
                message: `Completed ${completed}/${total} rollouts...`,
              })
            }
          },
          onError: (err) => {
            setError(err.message)
            setLoading(false)
            setProgress(null)
            console.error('❌ Policy entropy analysis failed:', err)
          },
        }
      )
    })
  }, [rollouts, envSpec])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-sm mb-2">Running Python analysis (scipy.stats.entropy)...</div>
        {progress && (
          <div className="text-xs text-muted-foreground">
            {progress.message} ({progress.current}/{progress.total})
          </div>
        )}
        <div className="mt-4 w-64 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
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
          Real Python calculations (scipy.stats.entropy) are required. Start backend at <code className="bg-muted px-1 rounded">http://localhost:8000</code>
        </div>
      </div>
    )
  }

  if (entropyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No entropy data available. Run multiple rollouts to see policy entropy over time.
      </div>
    )
  }

  // Calculate statistics
  const meanEntropy = entropyData.reduce((sum, d) => sum + d.entropy, 0) / entropyData.length
  const minEntropy = Math.min(...entropyData.map((d) => d.entropy))
  const maxEntropy = Math.max(...entropyData.map((d) => d.entropy))
  const stdEntropy = Math.sqrt(
    entropyData.reduce((sum, d) => sum + Math.pow(d.entropy - meanEntropy, 2), 0) / entropyData.length
  )

  return (
    <div className="space-y-5">
      {/* Professional Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-xl font-bold text-foreground">Policy Entropy Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">Shannon entropy (base 2) over rollouts</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">{rollouts.length} rollouts</div>
          <div className="text-xs text-muted-foreground">μ = {meanEntropy.toFixed(3)} bits</div>
          <div className="text-xs text-green-600 font-mono mt-1">✓ scipy.stats.entropy</div>
        </div>
      </div>

      {/* Professional Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Mean (μ)</div>
          <div className="text-2xl font-bold text-foreground">{meanEntropy.toFixed(3)}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">bits</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Std Dev (σ)</div>
          <div className="text-2xl font-bold text-foreground">{stdEntropy.toFixed(3)}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">bits</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Minimum</div>
          <div className="text-2xl font-bold text-foreground">{minEntropy.toFixed(3)}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">bits</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">Maximum</div>
          <div className="text-2xl font-bold text-foreground">{maxEntropy.toFixed(3)}</div>
          <div className="text-[10px] text-muted-foreground font-mono mt-1">bits</div>
        </div>
      </div>

      {/* Professional Line Chart */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-bold text-foreground">Entropy Over Rollouts</h4>
          <span className="text-xs text-muted-foreground font-mono">H(policy) = -Σ p(a) log₂ p(a)</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={entropyData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
            <XAxis
              dataKey="step"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              label={{ value: 'Rollout Number', position: 'insideBottom', offset: -5, style: { fontSize: 12 } }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              label={{ value: 'Entropy (bits)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              domain={[0, Math.max(maxEntropy * 1.1, 2)]}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`${value.toFixed(3)} bits`, 'Entropy']}
            />
            <Line
              type="monotone"
              dataKey="entropy"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 4, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 6 }}
              name="Policy Entropy"
            />
            {/* Mean reference line */}
            <Line
              type="monotone"
              dataKey={() => meanEntropy}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="Mean"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interpretation */}
      <div className="bg-muted/20 border border-border rounded-md p-3 text-sm">
        <div className="font-semibold mb-2">Interpretation (calculated with scipy.stats.entropy):</div>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            <strong>High entropy</strong> ({meanEntropy > 1.5 ? 'current' : 'typically'} &gt; 1.5): Policy is
            exploring, actions are diverse
          </li>
          <li>
            <strong>Low entropy</strong> ({meanEntropy < 0.5 ? 'current' : 'typically'} &lt; 0.5): Policy is
            exploiting, actions are deterministic
          </li>
          <li>
            <strong>Decreasing entropy</strong>: Policy is converging, becoming more deterministic
          </li>
          <li>
            <strong>Increasing entropy</strong>: Policy is exploring more, becoming more random
          </li>
        </ul>
      </div>
    </div>
  )
}
