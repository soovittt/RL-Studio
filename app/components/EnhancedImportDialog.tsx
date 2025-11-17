/**
 * Enhanced Import Dialog
 * Comprehensive Firecrawl integration with all import types and features
 */

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvSpec } from '~/lib/envSpec'
import { convertToEnvSpec } from '~/lib/firecrawlConverter'

interface EnhancedImportDialogProps {
  onClose: () => void
  onImport: (envSpec: EnvSpec) => void
}

type ImportType = 'paper' | 'github' | 'search' | 'diagram'

export function EnhancedImportDialog({ onClose, onImport }: EnhancedImportDialogProps) {
  const [importType, setImportType] = useState<ImportType>('paper')
  const [url, setUrl] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [showRewardSuggestions, setShowRewardSuggestions] = useState(false)
  const [rewardSuggestions, setRewardSuggestions] = useState<any[]>([])

  const importFromPaperAction = useAction(api.firecrawl.importFromPaper)
  const importFromGitHubAction = useAction(api.firecrawl.importFromGitHub)
  const searchSimilarAction = useAction(api.firecrawl.searchSimilarEnvironments)
  const suggestRewardsAction = useAction(api.firecrawl.suggestRewardRules)
  const parseDiagramAction = useAction(api.firecrawl.parseDiagram)

  const handleImport = async () => {
    setIsImporting(true)
    setError(null)
    setImportResult(null)

    try {
      let result
      
      if (importType === 'paper') {
        if (!url.trim()) {
          setError('Please enter a URL')
          return
        }
        result = await importFromPaperAction({ url })
      } else if (importType === 'github') {
        if (!url.trim()) {
          setError('Please enter a GitHub repository URL')
          return
        }
        result = await importFromGitHubAction({ repoUrl: url })
      } else if (importType === 'search') {
        if (!searchQuery.trim()) {
          setError('Please enter a search query')
          return
        }
        result = await searchSimilarAction({ query: searchQuery })
        setImportResult(result)
        return // Search results are displayed, not imported directly
      } else if (importType === 'diagram') {
        if (!url.trim()) {
          setError('Please enter a URL with diagram/image')
          return
        }
        result = await parseDiagramAction({ url })
      }

      if (result && result.success && result.extracted) {
        setImportResult(result)
        const envSpec = convertToEnvSpec(result.extracted)
        onImport(envSpec)
        onClose()
      } else {
        setError('Failed to extract environment from source')
      }
    } catch (err) {
      console.error('Import failed:', err)
      setError((err as Error).message || 'Failed to import')
    } finally {
      setIsImporting(false)
    }
  }

  const handleGetRewardSuggestions = async () => {
    if (!importResult?.extracted) {
      setError('Please import an environment first')
      return
    }

    try {
      const suggestions = await suggestRewardsAction({
        envDescription: importResult.extracted.description || '',
        envType: importResult.extracted.envType,
      })
      setRewardSuggestions(suggestions.suggestions || [])
      setShowRewardSuggestions(true)
    } catch (err) {
      console.error('Failed to get suggestions:', err)
      setError('Failed to get reward suggestions')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Import Environment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Import Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setImportType('paper')}
              className={`px-4 py-2 rounded border transition-colors ${
                importType === 'paper'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              📄 Paper/Blog
            </button>
            <button
              onClick={() => setImportType('github')}
              className={`px-4 py-2 rounded border transition-colors ${
                importType === 'github'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              🔗 GitHub
            </button>
            <button
              onClick={() => setImportType('search')}
              className={`px-4 py-2 rounded border transition-colors ${
                importType === 'search'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              🔍 Search
            </button>
            <button
              onClick={() => setImportType('diagram')}
              className={`px-4 py-2 rounded border transition-colors ${
                importType === 'diagram'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              🖼️ Diagram
            </button>
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-4 mb-6">
          {importType === 'search' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., grid navigation, continuous control, multi-agent pursuit"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                disabled={isImporting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Find similar environments from papers, blogs, and GitHub repos
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {importType === 'github' ? 'GitHub Repository URL' : 'URL'}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  importType === 'github'
                    ? 'https://github.com/owner/repo'
                    : importType === 'diagram'
                    ? 'URL with diagram/image'
                    : 'https://arxiv.org/abs/... or blog URL'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                disabled={isImporting}
              />
              <p className="text-xs text-gray-500 mt-1">
                {importType === 'github'
                  ? 'Imports environment from GitHub repository README'
                  : importType === 'diagram'
                  ? 'Extracts environment layout from images/diagrams'
                  : 'Supports arXiv papers, blog posts, and other web pages'}
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Search Results */}
        {importType === 'search' && importResult?.data && (
          <div className="mb-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Similar Environments Found</h3>
            {importResult.data.map((result: any, idx: number) => (
              <div
                key={idx}
                className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setUrl(result.url)
                  setImportType('paper')
                }}
              >
                <div className="font-medium text-gray-900">{result.title || result.url}</div>
                {result.description && (
                  <div className="text-sm text-gray-600 mt-1">{result.description.substring(0, 150)}...</div>
                )}
                <div className="text-xs text-gray-500 mt-1">{result.url}</div>
              </div>
            ))}
          </div>
        )}

        {/* Import Result Preview */}
        {importResult && importResult.extracted && importType !== 'search' && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="font-semibold text-gray-900 mb-3">Extracted Environment</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {importResult.extracted.name}
              </div>
              <div>
                <span className="font-medium">Type:</span> {importResult.extracted.envType}
              </div>
              {importResult.extracted.world && (
                <div>
                  <span className="font-medium">Size:</span>{' '}
                  {importResult.extracted.world.width} × {importResult.extracted.world.height}
                </div>
              )}
              {importResult.extracted.objects && importResult.extracted.objects.length > 0 && (
                <div>
                  <span className="font-medium">Objects:</span> {importResult.extracted.objects.length}
                </div>
              )}
              {importResult.extracted.rewards && importResult.extracted.rewards.length > 0 && (
                <div>
                  <span className="font-medium">Rewards:</span> {importResult.extracted.rewards.length} rules
                </div>
              )}
            </div>
            
            <button
              onClick={handleGetRewardSuggestions}
              className="mt-3 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              💡 Get Reward Suggestions
            </button>
          </div>
        )}

        {/* Reward Suggestions */}
        {showRewardSuggestions && rewardSuggestions.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-gray-900 mb-3">Suggested Reward Rules</h3>
            <div className="space-y-2">
              {rewardSuggestions.map((suggestion, idx) => (
                <div key={idx} className="p-2 bg-white border border-gray-200 rounded text-sm">
                  <div className="font-medium">{suggestion.description}</div>
                  <div className="text-gray-600">
                    Value: {suggestion.value > 0 ? '+' : ''}{suggestion.value}
                  </div>
                  {suggestion.source && (
                    <div className="text-xs text-gray-500 mt-1">Source: {suggestion.source}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            disabled={isImporting}
          >
            Cancel
          </button>
          {importType !== 'search' && (
            <button
              onClick={handleImport}
              disabled={isImporting || (!url.trim() && !searchQuery.trim())}
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                'Import Environment'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

