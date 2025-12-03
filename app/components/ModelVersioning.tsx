import { useState, useEffect } from 'react'
import {
  listCheckpoints,
  listModelVersions,
  createModelVersion,
  type Checkpoint,
  type ModelVersion,
  type CreateVersionRequest,
} from '~/lib/researchClient'

interface ModelVersioningProps {
  runId: string
}

export function ModelVersioning({ runId }: ModelVersioningProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [versions, setVersions] = useState<ModelVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateVersion, setShowCreateVersion] = useState(false)
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null)
  const [versionName, setVersionName] = useState('')
  const [versionTags, setVersionTags] = useState('')
  const [versionDescription, setVersionDescription] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [runId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [checkpointsData, versionsData] = await Promise.all([
        listCheckpoints(runId),
        listModelVersions(runId),
      ])
      setCheckpoints(checkpointsData)
      setVersions(versionsData)
    } catch (error) {
      console.error('Failed to load model versioning data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!selectedCheckpoint) return

    setCreating(true)
    try {
      const request: CreateVersionRequest = {
        run_id: runId,
        checkpoint_name: selectedCheckpoint,
        version_name: versionName || undefined,
        tags: versionTags
          ? versionTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        description: versionDescription || undefined,
      }

      await createModelVersion(request)
      await loadData()
      setShowCreateVersion(false)
      setSelectedCheckpoint(null)
      setVersionName('')
      setVersionTags('')
      setVersionDescription('')
    } catch (error) {
      console.error('Failed to create version:', error)
      alert(`Failed to create version: ${(error as Error).message}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Checkpoints Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Checkpoints</h3>
          <span className="text-sm text-muted-foreground">
            {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}
          </span>
        </div>

        {checkpoints.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No checkpoints available yet. Checkpoints are automatically saved during training.
          </div>
        ) : (
          <div className="space-y-2">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.checkpoint_name}
                className="flex items-center justify-between p-3 border border-border rounded hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{checkpoint.checkpoint_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(checkpoint.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCheckpoint(checkpoint.checkpoint_name)
                    setShowCreateVersion(true)
                  }}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
                >
                  Create Version
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Versions Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Model Versions</h3>
          <span className="text-sm text-muted-foreground">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {versions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No versions created yet. Create a version from a checkpoint above.
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.version_name}
                className="p-4 border border-border rounded hover:bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{version.version_name}</span>
                      {version.tags.length > 0 && (
                        <div className="flex gap-1">
                          {version.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {version.description && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {version.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      From checkpoint: {version.checkpoint_name} • Created:{' '}
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Version Modal */}
      {showCreateVersion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 text-foreground">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create Model Version</h3>
              <button
                onClick={() => {
                  setShowCreateVersion(false)
                  setSelectedCheckpoint(null)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Checkpoint</label>
                <div className="px-3 py-2 bg-muted rounded text-sm">{selectedCheckpoint}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Version Name (optional)</label>
                <input
                  type="text"
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="v1.0.0 or leave empty for auto-generated"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={versionTags}
                  onChange={(e) => setVersionTags(e.target.value)}
                  placeholder="production, best-model, baseline"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Description (optional)</label>
                <textarea
                  value={versionDescription}
                  onChange={(e) => setVersionDescription(e.target.value)}
                  placeholder="Describe this model version..."
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateVersion(false)
                    setSelectedCheckpoint(null)
                  }}
                  className="px-4 py-2 border border-border rounded hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={creating}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Version'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
