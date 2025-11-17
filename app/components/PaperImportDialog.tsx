/**
 * Paper Import Dialog - Import environment specs from arXiv/blog URLs via Firecrawl
 */

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvSpec, createDefaultEnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { convertToEnvSpec } from '~/lib/firecrawlConverter'

interface PaperImportDialogProps {
  onClose: () => void
  onImport: (envSpec: EnvSpec) => void
}

export function PaperImportDialog({ onClose, onImport }: PaperImportDialogProps) {
  const [url, setUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<any>(null)

  const importAction = useAction(api.import.fromPaper)

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setIsImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const result = await importAction({ url })
      setImportResult(result)

      // Try to create a basic EnvSpec from the extracted data
      const envSpec = createEnvSpecFromImport(result)
      onImport(envSpec)
      onClose()
    } catch (err) {
      console.error('Import failed:', err)
      setError((err as Error).message || 'Failed to import paper')
    } finally {
      setIsImporting(false)
    }
  }

  const createEnvSpecFromImport = (result: any): EnvSpec => {
    // Use enhanced converter if available
    if (result.enhanced?.extracted) {
      try {
        const envSpec = convertToEnvSpec(result.enhanced.extracted)
        // Update name with source URL
        envSpec.name = `Imported from ${url}`
        return envSpec
      } catch (error) {
        console.warn('Failed to use enhanced converter, falling back to basic:', error)
      }
    }

    // Fallback to basic conversion
    const envSpec = createDefaultEnvSpec(
      result.type === 'continuous' ? 'continuous2d' : 'grid',
      `Imported from ${url}`
    )

    // Add metadata
    if (result.summary) {
      envSpec.metadata = {
        ...envSpec.metadata,
        notes: result.summary.substring(0, 500),
        tags: ['imported', result.type],
      }
    }

    // If the import extracted specific information, use it
    if (result.extracted) {
      // Add reward rules if mentioned
      if (result.extracted.hasRewards) {
        envSpec.rules.rewards.push({
          id: `imported-reward-${Date.now()}`,
          condition: {
            type: 'agent_at_object',
            objectId: 'goal',
          },
          value: 10,
        })
      }

      // Add termination rules if mentioned
      if (result.extracted.hasTermination) {
        envSpec.rules.terminations.push({
          id: `imported-termination-${Date.now()}`,
          condition: {
            type: 'timeout',
            steps: 100,
          },
        })
      }
    }

    return envSpec
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Import from Paper/Blog</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              URL (arXiv, blog post, etc.)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://arxiv.org/abs/..."
              className="w-full px-3 py-2 border border-border rounded-md"
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports arXiv papers, blog posts, and other web pages
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {importResult && (
            <div className="bg-muted/50 border border-border rounded-md p-4 space-y-2">
              <h3 className="font-semibold">Import Summary</h3>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">Type:</span> {importResult.type}
                </p>
                {importResult.extracted && (
                  <>
                    <p>
                      <span className="font-medium">Has Rewards:</span>{' '}
                      {importResult.extracted.hasRewards ? 'Yes' : 'No'}
                    </p>
                    <p>
                      <span className="font-medium">Has Termination:</span>{' '}
                      {importResult.extracted.hasTermination ? 'Yes' : 'No'}
                    </p>
                  </>
                )}
              </div>
              {importResult.summary && (
                <div className="text-xs text-muted-foreground mt-2 max-h-32 overflow-y-auto">
                  <p className="font-medium mb-1">Extracted Content:</p>
                  <p>{importResult.summary}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-muted"
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting || !url.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

