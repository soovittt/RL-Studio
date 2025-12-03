/**
 * Live Metrics Visualization Component
 * Displays real-time training metrics with auto-refresh
 */

import { useEffect, useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

interface LiveMetricsVisualizationProps {
  runId: string
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
}

export function LiveMetricsVisualization({
  runId,
  autoRefresh = true,
  refreshInterval = 2000, // 2 seconds
}: LiveMetricsVisualizationProps) {
  const [lastUpdate, setLastUpdate] = useState(Date.now())
  const metrics = useQuery(api.metrics.get, { runId: runId as any })
  const run = useQuery(api.runs.get, { id: runId as any })

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh || !run || run.status !== 'running') return

    const interval = setInterval(() => {
      setLastUpdate(Date.now())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, run?.status])

  const chartData = useMemo(() => {
    if (!metrics || metrics.length === 0) return []

    return metrics.map((m) => ({
      step: m.step,
      reward: m.reward || 0,
      loss: m.loss || 0,
      entropy: m.entropy || 0,
      valueLoss: m.valueLoss || 0,
      episodeLength: m.episodeLength || 0,
    }))
  }, [metrics])

  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        avgReward: 0,
        maxReward: 0,
        minReward: 0,
        totalSteps: 0,
        avgLoss: 0,
      }
    }

    const rewards = chartData.map((d) => d.reward).filter((r) => r !== undefined)
    const losses = chartData.map((d) => d.loss).filter((l) => l !== undefined && l > 0)

    return {
      avgReward: rewards.length > 0 ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0,
      maxReward: rewards.length > 0 ? Math.max(...rewards) : 0,
      minReward: rewards.length > 0 ? Math.min(...rewards) : 0,
      totalSteps: chartData.length > 0 ? chartData[chartData.length - 1].step : 0,
      avgLoss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
    }
  }, [chartData])

  if (!run) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading run data...
      </div>
    )
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {run.status === 'running' ? (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>Waiting for metrics...</p>
            <p className="text-xs mt-1">Training is running, metrics will appear here</p>
          </div>
        ) : (
          <p>No metrics available yet</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Reward</div>
          <div className="text-2xl font-bold">{stats.avgReward.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Max Reward</div>
          <div className="text-2xl font-bold text-green-600">{stats.maxReward.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Steps</div>
          <div className="text-2xl font-bold">{stats.totalSteps.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Loss</div>
          <div className="text-2xl font-bold">{stats.avgLoss.toFixed(4)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Status</div>
          <div className="text-2xl font-bold capitalize">{run.status}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reward Chart */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Reward Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="reward"
                stroke="#8884d8"
                fillOpacity={1}
                fill="url(#rewardGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Loss Chart */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Loss Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="#82ca9d"
                strokeWidth={2}
                name="Policy Loss"
              />
              {chartData.some((d) => d.valueLoss && d.valueLoss > 0) && (
                <Line
                  type="monotone"
                  dataKey="valueLoss"
                  stroke="#ffc658"
                  strokeWidth={2}
                  name="Value Loss"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional Metrics */}
      {chartData.some((d) => d.entropy && d.entropy > 0) && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Entropy (Exploration)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="step" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="entropy" stroke="#ff7300" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Status Indicator */}
      {run.status === 'running' && autoRefresh && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live updates every {refreshInterval / 1000}s</span>
          <span className="text-xs">Last update: {new Date(lastUpdate).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  )
}
