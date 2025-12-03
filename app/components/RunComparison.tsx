import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { compareRuns, type StatisticalComparison } from '~/lib/researchClient'

interface RunComparisonProps {
  runIds: string[]
}

export function RunComparison({ runIds }: RunComparisonProps) {
  const [statisticalComparison, setStatisticalComparison] = useState<StatisticalComparison | null>(
    null
  )
  const [loadingStats, setLoadingStats] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<'mean_reward' | 'success_rate'>(
    'mean_reward'
  )

  // Query all runs
  const runs = useQuery(api.runs.listRecent, {})
  const selectedRuns = useMemo(() => {
    if (!runs) return []
    return runs.filter((run) => runIds.includes(run._id))
  }, [runs, runIds])

  // Query metrics for each run
  const metricsQueries = runIds.map((runId) => useQuery(api.metrics.get, { runId: runId as any }))

  // Query evaluations for each run
  const evaluationQueries = runIds.map((runId) =>
    useQuery(api.evaluations.get, { runId: runId as any })
  )

  // Prepare comparison data
  const comparisonData = useMemo(() => {
    return selectedRuns.map((run, idx) => {
      const metrics = metricsQueries[idx]
      const evaluation = evaluationQueries[idx]

      // Calculate training duration
      const duration =
        run.completedAt && run.startedAt
          ? Math.round((run.completedAt - run.startedAt) / 1000 / 60) // minutes
          : null

      // Get hyperparameters
      const hyperparams = run.hyperparams || {}

      return {
        runId: run._id,
        algorithm: run.algorithm,
        status: run.status,
        startedAt: run.startedAt,
        duration,
        hyperparams,
        metrics,
        evaluation,
        finalReward: metrics && metrics.length > 0 ? metrics[metrics.length - 1].reward || 0 : null,
        avgReward:
          metrics && metrics.length > 0
            ? metrics.reduce((sum, m) => sum + (m.reward || 0), 0) / metrics.length
            : null,
        maxReward:
          metrics && metrics.length > 0 ? Math.max(...metrics.map((m) => m.reward || 0)) : null,
        totalSteps: metrics && metrics.length > 0 ? metrics[metrics.length - 1].step || 0 : null,
        meanReward: evaluation?.meanReward || null,
        successRate: evaluation?.successRate || null,
        meanLength: evaluation?.meanLength || null,
      }
    })
  }, [selectedRuns, metricsQueries, evaluationQueries])

  // Prepare training curves data
  const trainingCurvesData = useMemo(() => {
    if (!metricsQueries || metricsQueries.length === 0) return []

    // Find max step across all runs
    const maxStep = Math.max(
      ...metricsQueries.filter((m) => m && m.length > 0).map((m) => m![m!.length - 1].step || 0)
    )

    // Create data points for each step
    const data: any[] = []
    for (let step = 0; step <= maxStep; step += Math.max(1, Math.floor(maxStep / 100))) {
      const point: any = { step }

      selectedRuns.forEach((run, idx) => {
        const metrics = metricsQueries[idx]
        if (metrics && metrics.length > 0) {
          // Find closest metric to this step
          const closest = metrics.reduce((prev, curr) => {
            const prevDiff = Math.abs((prev.step || 0) - step)
            const currDiff = Math.abs((curr.step || 0) - step)
            return currDiff < prevDiff ? curr : prev
          })

          if (Math.abs((closest.step || 0) - step) < maxStep / 50) {
            point[`reward_${run._id.slice(0, 8)}`] = closest.reward || 0
          }
        }
      })

      data.push(point)
    }

    return data
  }, [metricsQueries, selectedRuns])

  // Find best/worst for each metric
  const getBestWorst = (metric: string) => {
    const values = comparisonData
      .map((d) => d[metric as keyof typeof d])
      .filter((v) => v !== null && v !== undefined) as number[]

    if (values.length === 0) return { best: null, worst: null }

    const max = Math.max(...values)
    const min = Math.min(...values)

    return {
      best: max,
      worst: min,
    }
  }

  const rewardBestWorst = getBestWorst('meanReward')
  const successBestWorst = getBestWorst('successRate')

  if (!runs || selectedRuns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading comparison data...
      </div>
    )
  }

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Run Comparison</h2>
        <div className="text-sm text-muted-foreground">
          Comparing {selectedRuns.length} run{selectedRuns.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Run
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Algorithm
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Mean Reward
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Success Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Episode Length
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Total Steps
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {comparisonData.map((data, idx) => (
              <tr key={data.runId} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors[idx % colors.length] }}
                    />
                    <span className="font-mono text-sm">{data.runId.slice(0, 8)}...</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{data.algorithm.toUpperCase()}</td>
                <td className="px-4 py-3">
                  {data.meanReward !== null ? (
                    <span
                      className={
                        data.meanReward === rewardBestWorst.best
                          ? 'font-bold text-green-600'
                          : data.meanReward === rewardBestWorst.worst
                            ? 'text-red-600'
                            : ''
                      }
                    >
                      {data.meanReward.toFixed(2)}
                      {data.evaluation?.stdReward !== undefined && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ±{data.evaluation.stdReward.toFixed(2)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {data.successRate !== null ? (
                    <span
                      className={
                        data.successRate === successBestWorst.best
                          ? 'font-bold text-green-600'
                          : data.successRate === successBestWorst.worst
                            ? 'text-red-600'
                            : ''
                      }
                    >
                      {(data.successRate * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {data.meanLength !== null ? (
                    <>
                      {data.meanLength.toFixed(1)}
                      {data.evaluation?.stdLength !== undefined && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ±{data.evaluation.stdLength.toFixed(1)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {data.duration !== null ? `${data.duration} min` : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {data.totalSteps !== null ? data.totalSteps.toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Training Curves Overlay */}
      {trainingCurvesData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Training Curves</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trainingCurvesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedRuns.map((run, idx) => (
                <Line
                  key={run._id}
                  type="monotone"
                  dataKey={`reward_${run._id.slice(0, 8)}`}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  name={`${run.algorithm.toUpperCase()} (${run._id.slice(0, 8)})`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Statistical Analysis */}
      {comparisonData.length >= 2 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Statistical Analysis</h3>
            <div className="flex gap-2">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="px-3 py-1.5 text-sm border border-border rounded bg-background"
              >
                <option value="mean_reward">Mean Reward</option>
                <option value="success_rate">Success Rate</option>
              </select>
              <button
                onClick={async () => {
                  setLoadingStats(true)
                  try {
                    const runResults = comparisonData.map((d) => ({
                      run_id: d.runId,
                      mean_reward: d.meanReward,
                      std_reward: d.evaluation?.stdReward,
                      success_rate: d.successRate,
                      episode_rewards: d.evaluation?.episodeRewards || [],
                    }))
                    const result = await compareRuns({
                      run_results: runResults,
                      metric: selectedMetric,
                    })
                    setStatisticalComparison(result.comparison)
                  } catch (error) {
                    console.error('Statistical comparison failed:', error)
                    alert(`Failed to run statistical analysis: ${(error as Error).message}`)
                  } finally {
                    setLoadingStats(false)
                  }
                }}
                disabled={loadingStats}
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {loadingStats ? 'Analyzing...' : 'Run Statistical Test'}
              </button>
            </div>
          </div>

          {statisticalComparison && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground mb-1">Best Run</div>
                  <div className="font-bold text-green-600">
                    {statisticalComparison.best_run.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {statisticalComparison.means[statisticalComparison.best_run]?.toFixed(2)}
                  </div>
                </div>
                <div className="bg-muted/50 border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground mb-1">Overall Mean</div>
                  <div className="font-bold">{statisticalComparison.overall_mean.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ±{statisticalComparison.overall_std.toFixed(2)}
                  </div>
                </div>
                <div className="bg-muted/50 border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground mb-1">Test</div>
                  <div className="font-bold text-sm">
                    {statisticalComparison.statistical_test.test}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    p = {statisticalComparison.statistical_test.p_value.toFixed(4)}
                  </div>
                </div>
                <div className="bg-muted/50 border border-border rounded p-3">
                  <div className="text-xs text-muted-foreground mb-1">Significant</div>
                  <div
                    className={`font-bold ${
                      statisticalComparison.statistical_test.significant
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {statisticalComparison.statistical_test.significant ? 'Yes' : 'No'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">α = 0.05</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded p-3">
                <strong>Interpretation:</strong> The {statisticalComparison.statistical_test.test}{' '}
                test shows{' '}
                {statisticalComparison.statistical_test.significant
                  ? 'a statistically significant difference'
                  : 'no statistically significant difference'}{' '}
                between runs (p = {statisticalComparison.statistical_test.p_value.toFixed(4)}).
                {statisticalComparison.statistical_test.significant &&
                  ' This suggests the performance difference is likely real and not due to chance.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hyperparameters Comparison */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Hyperparameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['learning_rate', 'gamma', 'batch_size', 'n_steps', 'n_epochs'].map((param) => {
            const values = comparisonData.map((d) => ({
              runId: d.runId.slice(0, 8),
              value: d.hyperparams[param],
            }))

            if (values.every((v) => v.value === undefined)) return null

            return (
              <div key={param} className="border border-border rounded p-3">
                <div className="text-sm font-medium mb-2 capitalize">
                  {param.replace(/_/g, ' ')}
                </div>
                <div className="space-y-1">
                  {values.map((v, idx) => (
                    <div key={v.runId} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedRuns[idx].algorithm.toUpperCase()}:
                      </span>
                      <span className="font-mono">
                        {v.value !== undefined ? String(v.value) : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
