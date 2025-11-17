import { useParams, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { exportProject } from '~/lib/universalExporter'
import { useState, useMemo } from 'react'
import { TrainingVisualization } from './TrainingVisualization'
import { LiveMetricsVisualization } from './LiveMetricsVisualization'
import { EnvSpec, createDefaultEnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { stopTrainingJob, getTrainingJobStatus } from '~/lib/trainingClient'

export function RunViewer() {
  const { id } = useParams({ from: '/runs/$id' })
  const [exporting, setExporting] = useState(false)

  const run = useQuery(api.runs.get, { id: id as any })
  const metrics = useQuery(api.metrics.get, { runId: id as any })
  const latestFrame = useQuery(api.rolloutFrames.getLatest, { runId: id as any })
  // Only query environment if run exists and has envId
  const environment = useQuery(
    api.environments.get,
    run?.envId ? { id: run.envId } : { id: '' as any }
  )

  // Load EnvSpec from environment
  const envSpec = useMemo(() => {
    if (!environment) return null
    
    // If already in universal format, return as-is
    if (environment.envSpec) {
      return environment.envSpec as EnvSpec
    }
    
    // Migrate from legacy format using SceneGraphManager
    return SceneGraphManager.migrateFromLegacy(environment)
  }, [environment])

  // Extract agent position from latest metrics or frame
  const agentPosition = useMemo(() => {
    if (latestFrame?.frameUrl) {
      // If we have a frame URL, try to extract position from it
      // For now, we'll use the latest metric step to estimate position
      // In a real implementation, the frame would contain position data
    }
    // Use latest metric to estimate position (this is a placeholder)
    // In real implementation, metrics would include position data
    return undefined
  }, [latestFrame, metrics])

  const handleExport = () => {
    if (!run || !environment) return
    
    setExporting(true)
    
    // Load EnvSpec from environment
    const envSpec = environment.envSpec || environment
    
    const files = exportProject({
      envSpec,
      algorithm: run.algorithm,
      hyperparams: run.hyperparams,
      run: {
        concepts: run.concepts,
      },
    })

    // Create zip or download files
    Object.entries(files).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    })
    
    setExporting(false)
  }

  if (!run) {
    return <div className="max-w-7xl mx-auto px-4 py-8">Loading...</div>
  }

  const chartData = metrics?.map((m) => ({
    step: m.step,
    reward: m.reward,
    loss: m.loss || 0,
    entropy: m.entropy || 0,
  })) || []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link to="/runs" className="text-muted-foreground hover:text-foreground">
          ← Back to runs
        </Link>
      </div>

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Run {id.slice(0, 8)}</h1>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Algorithm: {run.algorithm.toUpperCase()}</span>
            <span>Status: {run.status}</span>
            {run.startedAt && <span>Started: {new Date(run.startedAt).toLocaleString()}</span>}
          </div>
        </div>
        {run.status === 'completed' && (
          <button
            onClick={handleExport}
            disabled={exporting || !environment}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Project'}
          </button>
        )}
      </div>

      {/* Live Training Visualization */}
      {envSpec && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Live Training Visualization</h2>
          <div className="h-96 border border-border rounded bg-muted/20">
            <TrainingVisualization
              envSpec={envSpec}
              agentPosition={agentPosition}
              agentId={envSpec.agents[0]?.id}
              readonly={true}
            />
          </div>
          {run.status === 'running' && (
            <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Training in progress... Updates every few seconds</span>
            </div>
          )}
        </div>
      )}

      {/* Live Metrics Visualization */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <LiveMetricsVisualization runId={id} autoRefresh={run.status === 'running'} />
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">RL Concepts:</span>
            <ul className="mt-1 space-y-1">
              {run.concepts.rewardShaping && <li>• Reward Shaping</li>}
              {run.concepts.curriculum && <li>• Curriculum</li>}
              {run.concepts.imitation && <li>• Imitation Learning</li>}
              {run.concepts.explorationBonus && <li>• Exploration Bonus</li>}
            </ul>
          </div>
          <div>
            <span className="text-muted-foreground">Hyperparameters:</span>
            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(run.hyperparams, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

