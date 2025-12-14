/**
 * RL Analysis Tab Component
 * Clean, professional UI for scientific analysis of rollout data
 */

import { useMemo } from 'react'
import { EnvSpec } from '~/lib/envSpec'
import { RewardDecompositionHeatmap } from './RewardDecompositionHeatmap'
import { TrajectoryPathVisualizer } from './TrajectoryPathVisualizer'
import { PolicyEntropyChart } from './PolicyEntropyChart'
import { TerminationAnalysisChart } from './TerminationAnalysisChart'
import type { SimulatorResult } from '~/lib/universalSimulator'

interface RLAnalysisTabProps {
  rolloutResult: SimulatorResult | null
  rolloutHistory?: Array<{
    result: any
    policy: string
    _metadata?: { hasFullData?: boolean; totalSteps?: number }
  }>
  recentRolloutsWithData?: SimulatorResult[] // Recent rollouts with full step data
  envSpec: EnvSpec
  policy?: string
}

export function RLAnalysisTab({
  rolloutResult,
  rolloutHistory: _rolloutHistory,
  recentRolloutsWithData = [],
  envSpec,
  policy = 'random',
}: RLAnalysisTabProps) {
  // Calculate stats from rollout
  const stats = useMemo(() => {
    if (!rolloutResult || !rolloutResult.steps || rolloutResult.steps.length === 0) {
      return null
    }

    const steps = rolloutResult.steps
    const rewards = steps.map((s) => s.reward || 0)
    const actions = steps.map((s) => s.action).filter(Boolean)

    // Action distribution
    const actionCounts: Record<string, number> = {}
    actions.forEach((action) => {
      const actionStr = typeof action === 'string' ? action : JSON.stringify(action)
      actionCounts[actionStr] = (actionCounts[actionStr] || 0) + 1
    })

    // Path efficiency
    let pathEfficiency = 0
    if (steps.length > 0 && steps[0].state?.agents?.[0]?.position) {
      const startPos = steps[0].state.agents[0].position
      const endPos = steps[steps.length - 1].state.agents[0].position
      if (startPos && endPos) {
        const straightLineDist = Math.sqrt(
          Math.pow(endPos[0] - startPos[0], 2) + Math.pow(endPos[1] - startPos[1], 2)
        )
        pathEfficiency = straightLineDist > 0 ? (straightLineDist / steps.length) * 100 : 0
      }
    }

    // Reward stats
    const positiveRewards = rewards.filter((r) => r > 0)
    const negativeRewards = rewards.filter((r) => r < 0)
    const avgStepReward = rewards.reduce((a, b) => a + b, 0) / rewards.length

    // Oscillations
    const positions = steps
      .map((s) => s.state?.agents?.[0]?.position)
      .filter((p) => p && Array.isArray(p))
    const uniquePositions = new Set(positions.map((p) => `${p[0]},${p[1]}`))
    const oscillationRate = positions.length > 0 ? 1 - uniquePositions.size / positions.length : 0

    return {
      totalReward: rolloutResult.totalReward,
      episodeLength: rolloutResult.episodeLength,
      success: rolloutResult.success,
      terminationReason: rolloutResult.terminationReason,
      avgStepReward,
      positiveRewardCount: positiveRewards.length,
      negativeRewardCount: negativeRewards.length,
      maxReward: rewards.length > 0 ? Math.max(...rewards) : 0,
      minReward: rewards.length > 0 ? Math.min(...rewards) : 0,
      actionDistribution: actionCounts,
      pathEfficiency,
      oscillationRate,
      uniquePositions: uniquePositions.size,
      totalPositions: positions.length,
    }
  }, [rolloutResult])

  // Generate insights
  const insights = useMemo(() => {
    if (!stats) return []
    const items: Array<{ type: 'success' | 'warning' | 'info'; text: string }> = []

    if (stats.success) {
      items.push({ type: 'success', text: `Goal reached in ${stats.episodeLength} steps` })
    } else {
      items.push({ type: 'warning', text: `Episode ended: ${stats.terminationReason || 'timeout'}` })
    }

    if (stats.pathEfficiency < 20) {
      items.push({ type: 'warning', text: `Low path efficiency (${stats.pathEfficiency.toFixed(1)}%)` })
    }

    if (stats.oscillationRate > 0.3) {
      items.push({ type: 'warning', text: `High oscillation rate (${(stats.oscillationRate * 100).toFixed(0)}%)` })
    }

    return items
  }, [stats])

  if (!rolloutResult) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <p className="text-muted-foreground mb-2">No rollout data available</p>
          <p className="text-xs text-muted-foreground">
            Run a rollout from the Rollout Preview tab to see analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-6 max-w-6xl mx-auto">
        {/* Episode Summary */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Episode Summary</h2>
            <span className="text-xs text-muted-foreground capitalize">Policy: {policy}</span>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            <MetricCard
              label="Total Reward"
              value={stats?.totalReward.toFixed(2) || '0'}
              positive={stats ? stats.totalReward >= 0 : true}
            />
            <MetricCard label="Episode Length" value={String(stats?.episodeLength || 0)} unit="steps" />
            <MetricCard
              label="Success"
              value={stats?.success ? '✓' : '✗'}
              positive={stats?.success}
            />
            <MetricCard
              label="Avg Reward/Step"
              value={stats?.avgStepReward.toFixed(4) || '0'}
              positive={stats ? stats.avgStepReward >= 0 : true}
            />
            <MetricCard
              label="Path Efficiency"
              value={`${stats?.pathEfficiency.toFixed(1) || 0}%`}
            />
            <MetricCard
              label="Unique Positions"
              value={`${stats?.uniquePositions || 0}/${stats?.totalPositions || 0}`}
            />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {insights.map((insight, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-1 rounded ${
                    insight.type === 'success'
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : insight.type === 'warning'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {insight.text}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Action Distribution */}
        {stats && Object.keys(stats.actionDistribution).length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-3">Action Distribution</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Action</th>
                    <th className="text-right px-3 py-2 font-medium">Count</th>
                    <th className="text-right px-3 py-2 font-medium">%</th>
                    <th className="px-3 py-2 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.actionDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([action, count]) => {
                      const pct = (count / stats.episodeLength) * 100
                      return (
                        <tr key={action} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{action}</td>
                          <td className="px-3 py-2 text-right font-mono">{count}</td>
                          <td className="px-3 py-2 text-right font-mono">{pct.toFixed(1)}%</td>
                          <td className="px-3 py-2">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-foreground/20"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Reward Analysis */}
        <section>
          <h3 className="text-sm font-medium mb-3">Reward Analysis</h3>
          <div className="border border-border rounded-lg p-4">
            <RewardDecompositionHeatmap rolloutSteps={rolloutResult.steps} envSpec={envSpec} />
          </div>
        </section>

        {/* Trajectory Analysis */}
        <section>
          <h3 className="text-sm font-medium mb-3">Trajectory Analysis</h3>
          <div className="border border-border rounded-lg p-4">
            <TrajectoryPathVisualizer rolloutSteps={rolloutResult.steps} envSpec={envSpec} />
          </div>
        </section>

        {/* Policy Entropy (Multiple Rollouts) */}
        {recentRolloutsWithData.length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-3">Policy Entropy Over Time</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Analyzing {recentRolloutsWithData.length} recent rollout{recentRolloutsWithData.length !== 1 ? 's' : ''} with full step data
            </p>
            <div className="border border-border rounded-lg p-4">
              <PolicyEntropyChart
                rollouts={recentRolloutsWithData
                  .filter((r) => r && r.steps && r.steps.length > 0)
                  .map((r) =>
                    r.steps
                      .filter((s: any) => s && s.state && s.action !== undefined)
                      .map((s: any) => ({
                        state: s.state || {},
                        action: s.action,
                        reward: s.reward || 0,
                        done: s.done || false,
                      }))
                  )
                  .filter((rollout) => rollout.length > 0)}
                envSpec={envSpec}
              />
            </div>
          </section>
        )}

        {/* Termination Analysis (Multiple Rollouts) */}
        {recentRolloutsWithData.length > 1 && (
          <section>
            <h3 className="text-sm font-medium mb-3">Termination Analysis</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Analyzing {recentRolloutsWithData.length} recent rollout{recentRolloutsWithData.length !== 1 ? 's' : ''} for termination patterns
            </p>
            <div className="border border-border rounded-lg p-4">
              <TerminationAnalysisChart
                rollouts={recentRolloutsWithData
                  .filter((r) => r && r.steps && r.steps.length > 0)
                  .map((r) =>
                    r.steps
                      .filter((s: any) => s && s.state && s.action !== undefined)
                      .map((s: any) => ({
                        state: s.state || {},
                        action: s.action,
                        reward: s.reward || 0,
                        done: s.done || false,
                      }))
                  )
                  .filter((rollout) => rollout.length > 0)}
                envSpec={envSpec}
              />
            </div>
          </section>
        )}

        {/* Advanced Analytics Section */}
        <section>
          <h3 className="text-sm font-medium mb-3">Advanced Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* State Coverage */}
            <div className="border border-border rounded-lg p-4">
              <h4 className="text-xs font-medium mb-2">State Coverage</h4>
              {stats && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Unique positions</span>
                    <span className="font-mono">{stats.uniquePositions}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total positions</span>
                    <span className="font-mono">{stats.totalPositions}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Coverage ratio</span>
                    <span className="font-mono">{((stats.uniquePositions / stats.totalPositions) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(stats.uniquePositions / stats.totalPositions) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reward Statistics */}
            <div className="border border-border rounded-lg p-4">
              <h4 className="text-xs font-medium mb-2">Reward Statistics</h4>
              {stats && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Max step reward</span>
                    <span className={`font-mono ${stats.maxReward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.maxReward.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Min step reward</span>
                    <span className={`font-mono ${stats.minReward >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.minReward.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Positive rewards</span>
                    <span className="font-mono text-green-600">{stats.positiveRewardCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Negative rewards</span>
                    <span className="font-mono text-red-600">{stats.negativeRewardCount}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Behavior Analysis */}
            <div className="border border-border rounded-lg p-4">
              <h4 className="text-xs font-medium mb-2">Behavior Analysis</h4>
              {stats && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Path efficiency</span>
                    <span className="font-mono">{stats.pathEfficiency.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Oscillation rate</span>
                    <span className={`font-mono ${stats.oscillationRate > 0.3 ? 'text-amber-600' : ''}`}>
                      {(stats.oscillationRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Steps/unique position</span>
                    <span className="font-mono">{(stats.totalPositions / stats.uniquePositions).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Export Options */}
            <div className="border border-border rounded-lg p-4">
              <h4 className="text-xs font-medium mb-2">Export Data</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const data = rolloutResult?.steps.map((s, i) => ({
                      step: i + 1,
                      action: s.action,
                      reward: s.reward,
                      cumulative: s.state.totalReward,
                      position: s.state.agents[0]?.position,
                    }))
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'rollout_data.json'
                    a.click()
                  }}
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                >
                  JSON
                </button>
                <button
                  onClick={() => {
                    const data = rolloutResult?.steps || []
                    const csv = 'Step,Action,Reward,Cumulative,Position_X,Position_Y\n' +
                      data.map((s, i) => {
                        const pos = s.state.agents[0]?.position || [0, 0]
                        return `${i + 1},${s.action},${s.reward},${s.state.totalReward},${pos[0]},${pos[1]}`
                      }).join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'rollout_data.csv'
                    a.click()
                  }}
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                >
                  CSV
                </button>
                <button
                  onClick={() => {
                    const summary = {
                      totalReward: rolloutResult?.totalReward,
                      episodeLength: rolloutResult?.episodeLength,
                      success: rolloutResult?.success,
                      terminationReason: rolloutResult?.terminationReason,
                      stats: stats,
                      env: {
                        type: envSpec.world?.coordinateSystem,
                        width: envSpec.world?.width,
                        height: envSpec.world?.height,
                      }
                    }
                    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'episode_summary.json'
                    a.click()
                  }}
                  className="px-2 py-1 text-xs border border-border rounded hover:bg-muted"
                >
                  Summary
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// Simple metric card component
function MetricCard({
  label,
  value,
  unit,
  positive,
}: {
  label: string
  value: string
  unit?: string
  positive?: boolean
}) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={`text-lg font-semibold font-mono ${
          positive === true
            ? 'text-green-600 dark:text-green-500'
            : positive === false
              ? 'text-red-600 dark:text-red-500'
              : ''
        }`}
      >
        {value}
      </div>
      {unit && <div className="text-xs text-muted-foreground">{unit}</div>}
    </div>
  )
}
