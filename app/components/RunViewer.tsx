import { useParams, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { exportProject } from '~/lib/universalExporter'
import { useState, useMemo, useEffect } from 'react'
import { TrainingVisualization } from './TrainingVisualization'
import { LiveMetricsVisualization } from './LiveMetricsVisualization'
import { EvaluationResults } from './EvaluationResults'
import { FailureAnalysis } from './FailureAnalysis'
import { CreateRun } from './CreateRun'
import { ModelVersioning } from './ModelVersioning'
import { EnvSpec, createDefaultEnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { stopTrainingJob, getTrainingJobStatus } from '~/lib/trainingClient'
import { getExperimentTrackingSettings, fetchWandbRun } from '~/lib/researchClient'

export function RunViewer() {
  const { id } = useParams({ from: '/runs/$id' })
  const [exporting, setExporting] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'metrics' | 'evaluation' | 'model' | 'versions'>('metrics')
  const [wandbMetrics, setWandbMetrics] = useState<any>(null)
  const [loadingWandb, setLoadingWandb] = useState(false)

  const run = useQuery(api.runs.get, { id: id as any })
  const metrics = useQuery(api.metrics.get, { runId: id as any })
  const latestFrame = useQuery(api.rolloutFrames.getLatest, { runId: id as any })
  const model = useQuery(api.models.get, { runId: id as any })
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

  // Load W&B metrics if authenticated
  useEffect(() => {
    const loadWandbMetrics = async () => {
      const trackingSettings = getExperimentTrackingSettings()
      const trackingUrl = (run as any)?.experimentTrackingUrl
      
      if (trackingSettings.backend === 'wandb' && 
          trackingSettings.wandbAuthenticated && 
          trackingUrl) {
        // Extract run ID from W&B URL (format: https://wandb.ai/.../runs/RUN_ID)
        const match = trackingUrl.match(/\/runs\/([^\/\?]+)/)
        if (match && match[1]) {
          setLoadingWandb(true)
          try {
            const metrics = await fetchWandbRun(match[1])
            if (metrics) {
              setWandbMetrics(metrics)
            }
          } catch (error) {
            console.error('Failed to load W&B metrics:', error)
          } finally {
            setLoadingWandb(false)
          }
        }
      }
    }
    
    if (run) {
      loadWandbMetrics()
    }
  }, [run])

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
          <div className="flex gap-4 text-sm text-muted-foreground items-center">
            <span>Algorithm: {run.algorithm.toUpperCase()}</span>
            <span>Status: {run.status}</span>
            {run.startedAt && <span>Started: {new Date(run.startedAt).toLocaleString()}</span>}
            {/* Experiment Tracking Link */}
            {(() => {
              const trackingSettings = getExperimentTrackingSettings()
              const trackingUrl = (run as any).experimentTrackingUrl
              if (trackingUrl && trackingSettings.backend !== 'local') {
                return (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 flex items-center gap-1"
                  >
                    {trackingSettings.backend === 'wandb' ? '🔗 View in W&B' : '🔗 View in MLflow'}
                  </a>
                )
              }
              return null
            })()}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDuplicateDialog(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Create Similar Run
          </button>
          {run.status === 'completed' && (
            <>
              {model && (
                <>
                  <button
                    onClick={async () => {
                      if (!envSpec) {
                        alert('Environment not loaded')
                        return
                      }
                      
                      // Navigate to environment editor with rollout using trained model
                      // For now, we'll open a dialog or navigate
                      // This will be handled by the rollout UI
                      const envId = run.envId
                      if (envId) {
                        window.location.href = `/environments/${envId}?testModel=${id}&policy=trained_model`
                      } else {
                        alert('Cannot test model: environment ID not found')
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Test Trained Model
                  </button>
                  <button
                    onClick={async () => {
                      if (!model.modelUrl) return
                      
                      try {
                        // For S3 URLs, we'd need a backend endpoint to generate signed URLs
                        // For now, show the URL or download via backend
                        if (model.modelUrl.startsWith('s3://') || model.modelUrl.startsWith('gs://')) {
                          alert(`Model stored at: ${model.modelUrl}\n\nTo download, configure backend with storage credentials and use the download API.`)
                        } else {
                          // For file:// URLs or direct URLs, try to download
                          window.open(model.modelUrl, '_blank')
                        }
                      } catch (error) {
                        console.error('Failed to download model:', error)
                        alert('Failed to download model. Please check backend configuration.')
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Download Model
                  </button>
                </>
              )}
          <button
            onClick={handleExport}
            disabled={exporting || !environment}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Project'}
          </button>
            </>
        )}
        </div>
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

      {/* Tabs */}
      <div className="mb-6 border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'metrics'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Metrics
          </button>
          {run.status === 'completed' && (
            <>
              <button
                onClick={() => setActiveTab('evaluation')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'evaluation'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Evaluation
              </button>
              <button
                onClick={() => setActiveTab('model')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'model'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Model
              </button>
              <button
                onClick={() => setActiveTab('versions')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'versions'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Versions
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* W&B Metrics (if authenticated) */}
          {(() => {
            const trackingSettings = getExperimentTrackingSettings()
            if (trackingSettings.backend === 'wandb' && trackingSettings.wandbAuthenticated && wandbMetrics) {
              return (
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <span>📊</span>
                      <span>Weights & Biases Metrics</span>
                      <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                        Authenticated
                      </span>
                    </h2>
                    {wandbMetrics.url && (
                      <a
                        href={wandbMetrics.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View in W&B →
                      </a>
                    )}
                  </div>
                  
                  {loadingWandb ? (
                    <div className="text-center py-8 text-muted-foreground">Loading W&B metrics...</div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Metrics */}
                      {wandbMetrics.summary && Object.keys(wandbMetrics.summary).length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Summary</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(wandbMetrics.summary).slice(0, 8).map(([key, value]) => (
                              <div key={key} className="bg-muted/50 rounded p-3">
                                <div className="text-xs text-muted-foreground">{key}</div>
                                <div className="text-lg font-semibold mt-1">
                                  {typeof value === 'number' ? value.toFixed(4) : String(value)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Metrics Charts */}
                      {wandbMetrics.metrics && Object.keys(wandbMetrics.metrics).length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">Metrics Over Time</h3>
                          <div className="space-y-4">
                            {Object.entries(wandbMetrics.metrics).slice(0, 5).map(([metricName, values]) => (
                              <div key={metricName} className="bg-muted/30 rounded p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">{metricName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {Array.isArray(values) ? `${values.length} points` : 'N/A'}
                                  </span>
                                </div>
                                {Array.isArray(values) && values.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    Latest: {typeof values[values.length - 1] === 'number' 
                                      ? values[values.length - 1].toFixed(4) 
                                      : String(values[values.length - 1])}
                                    {' | '}
                                    Max: {typeof Math.max(...values.filter(v => typeof v === 'number')) === 'number'
                                      ? Math.max(...values.filter(v => typeof v === 'number')).toFixed(4)
                                      : 'N/A'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            }
            return null
          })()}
          
          {/* Local Metrics */}
          <div className="bg-card border border-border rounded-lg p-6">
            <LiveMetricsVisualization runId={id} autoRefresh={run.status === 'running'} />
          </div>
        </div>
      )}

      {activeTab === 'evaluation' && run.status === 'completed' && (
        <>
          <EvaluationResults runId={id} />
          <div className="mb-6">
            <FailureAnalysis runId={id} />
          </div>
        </>
      )}

      {activeTab === 'model' && model && run.status === 'completed' && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Trained Model</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Algorithm:</span>
              <span className="ml-2 font-medium">{model.algorithm.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Storage:</span>
              <span className="ml-2 font-medium font-mono text-xs">
                {model.modelUrl.startsWith('s3://') ? 'AWS S3' : 
                 model.modelUrl.startsWith('gs://') ? 'Google Cloud Storage' : 
                 'Local File'}
              </span>
            </div>
            {model.fileSize && (
              <div>
                <span className="text-muted-foreground">File Size:</span>
                <span className="ml-2 font-medium">
                  {(model.fileSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Uploaded:</span>
              <span className="ml-2 font-medium">
                {new Date(model.uploadedAt).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-muted-foreground text-xs">Model URL:</span>
            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto font-mono">
              {model.modelUrl}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'versions' && run.status === 'completed' && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <ModelVersioning runId={id} />
        </div>
      )}

      {showDuplicateDialog && run.envId && (
        <CreateRun
          envId={run.envId}
          duplicateFromRunId={id}
          onClose={() => setShowDuplicateDialog(false)}
        />
      )}

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

