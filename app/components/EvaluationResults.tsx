import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface EvaluationResultsProps {
  runId: string
}

export function EvaluationResults({ runId }: EvaluationResultsProps) {
  const evaluation = useQuery(api.evaluations.get, { runId: runId as any })

  if (!evaluation) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Evaluation Results</h2>
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>Loading evaluation...</p>
          </div>
        </div>
      </div>
    )
  }

  // Determine performance indicator color
  const getPerformanceColor = (meanReward: number) => {
    if (meanReward > 50) return 'text-green-600'
    if (meanReward > 10) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (meanReward: number, successRate?: number) => {
    if (successRate !== undefined && successRate > 0.8) return 'Excellent'
    if (successRate !== undefined && successRate > 0.5) return 'Good'
    if (meanReward > 50) return 'Good'
    if (meanReward > 10) return 'Fair'
    return 'Poor'
  }

  const performanceBadge = getPerformanceBadge(evaluation.meanReward, evaluation.successRate)
  const badgeColor =
    performanceBadge === 'Excellent' || performanceBadge === 'Good'
      ? 'bg-green-100 text-green-800'
      : performanceBadge === 'Fair'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'

  // Prepare data for episode rewards chart
  const episodeRewardsData = evaluation.episodeRewards.map((reward, idx) => ({
    episode: idx + 1,
    reward: reward,
  }))

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Evaluation Results</h2>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badgeColor}`}>
          {performanceBadge}
        </span>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Mean Reward</div>
          <div className={`text-2xl font-bold ${getPerformanceColor(evaluation.meanReward)}`}>
            {evaluation.meanReward.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ± {evaluation.stdReward.toFixed(2)}
          </div>
        </div>

        {evaluation.successRate !== undefined && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
            <div
              className={`text-2xl font-bold ${
                evaluation.successRate > 0.5 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(evaluation.successRate * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {Math.round(evaluation.successRate * evaluation.numEpisodes)} /{' '}
              {evaluation.numEpisodes} episodes
            </div>
          </div>
        )}

        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Mean Episode Length</div>
          <div className="text-2xl font-bold">{evaluation.meanLength.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            ± {evaluation.stdLength.toFixed(1)} steps
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Episodes Evaluated</div>
          <div className="text-2xl font-bold">{evaluation.numEpisodes}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(evaluation.evaluatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Episode Rewards Distribution Chart */}
      {evaluation.episodeRewards.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Episode Rewards Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={episodeRewardsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="episode" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="reward" fill="#8884d8" name="Reward" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Summary</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            The model achieved a mean reward of{' '}
            <span className="font-semibold text-foreground">
              {evaluation.meanReward.toFixed(2)} ± {evaluation.stdReward.toFixed(2)}
            </span>{' '}
            over {evaluation.numEpisodes} evaluation episodes.
          </p>
          {evaluation.successRate !== undefined && (
            <p>
              Success rate:{' '}
              <span className="font-semibold text-foreground">
                {(evaluation.successRate * 100).toFixed(1)}%
              </span>
              {' '}(reached goal in{' '}
              {Math.round(evaluation.successRate * evaluation.numEpisodes)} out of{' '}
              {evaluation.numEpisodes} episodes).
            </p>
          )}
          <p>
            Average episode length:{' '}
            <span className="font-semibold text-foreground">
              {evaluation.meanLength.toFixed(1)} ± {evaluation.stdLength.toFixed(1)} steps
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

