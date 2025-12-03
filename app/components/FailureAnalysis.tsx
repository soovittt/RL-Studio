import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

interface FailureAnalysisProps {
  runId: string
}

export function FailureAnalysis({ runId }: FailureAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const analyzeFailure = useAction(api.coderabbit.analyzeFailure)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await analyzeFailure({ runId: runId as any })
      if (result.success) {
        setAnalysis(result.analysis)
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze')
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!analysis && !isAnalyzing && !error) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-2">Failure Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Get AI-powered insights into why your training run may have failed or underperformed.
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Why did this fail?'}
          </button>
        </div>
      </div>
    )
  }

  if (isAnalyzing) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Analyzing training run...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card border border-red-200 rounded-lg p-6">
        <div className="text-red-800">
          <h3 className="text-lg font-semibold mb-2">Analysis Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Failure Analysis</h3>
        <button
          onClick={handleAnalyze}
          className="px-3 py-1 text-sm border border-border rounded hover:bg-muted transition-colors"
        >
          Re-analyze
        </button>
      </div>

      <div className="p-4 bg-muted rounded-md">
        <p className="text-sm">{analysis.summary}</p>
      </div>

      {analysis.issues && analysis.issues.length > 0 && (
        <div>
          <h4 className="text-md font-semibold mb-3">Issues Found</h4>
          <div className="space-y-3">
            {analysis.issues.map((issue: any, idx: number) => (
              <div
                key={idx}
                className={`p-4 border rounded-md ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium">{issue.type.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className="text-xs px-2 py-1 rounded bg-white/50">{issue.severity}</span>
                </div>
                <p className="text-sm mb-2">{issue.message}</p>
                <p className="text-xs italic">{issue.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div>
          <h4 className="text-md font-semibold mb-3">Recommendations</h4>
          <div className="space-y-2">
            {analysis.recommendations.map((rec: any, idx: number) => (
              <div key={idx} className={`p-3 border rounded-md ${getSeverityColor(rec.priority)}`}>
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-sm">{rec.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs px-2 py-1 rounded bg-white/50">{rec.priority}</span>
                </div>
                <p className="text-xs">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.issues.length === 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          <p className="text-sm">
            ✅ No major issues detected. Training appears to be progressing normally.
          </p>
        </div>
      )}
    </div>
  )
}
