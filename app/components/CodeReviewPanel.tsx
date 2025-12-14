/**
 * Code Review Panel
 * Shows CodeRabbit review results after code export
 */

import { useState, useEffect } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

interface CodeReviewPanelProps {
  files: Record<string, string>
  onClose: () => void
  onFixAll?: () => void
}

interface ReviewIssue {
  severity: 'error' | 'warning' | 'info'
  file: string
  line?: number
  message: string
  suggestion?: string
  category: string
}

interface ReviewSuggestion {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

interface ReviewResult {
  success: boolean
  review?: {
    score: number
    issues: ReviewIssue[]
    summary: string
    suggestions?: ReviewSuggestion[]
  }
  error?: string
}

export function CodeReviewPanel({ files, onClose, onFixAll }: CodeReviewPanelProps) {
  const [isReviewing, setIsReviewing] = useState(true)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reviewAction = useAction(api.coderabbit.reviewExportedCode)

  useEffect(() => {
    const runReview = async () => {
      try {
        const fileArray = Object.entries(files).map(([path, content]) => ({
          path,
          content,
        }))

        const result = await reviewAction({
          files: fileArray,
          context: 'RL environment code export',
        })

        setReviewResult(result)
      } catch (err) {
        setError((err as Error).message || 'Review failed')
      } finally {
        setIsReviewing(false)
      }
    }

    runReview()
  }, [files, reviewAction])

  if (isReviewing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            <div>
              <div className="font-semibold">Running Code Review...</div>
              <div className="text-sm text-gray-600">
                Analyzing code quality and potential issues
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="text-red-600 mb-4">Review Error: {error}</div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const review = reviewResult?.review
  if (!review) {
    return null
  }

  const errorCount = review.issues.filter((i) => i.severity === 'error').length
  const warningCount = review.issues.filter((i) => i.severity === 'warning').length
  const infoCount = review.issues.filter((i) => i.severity === 'info').length

  const scoreColor =
    review.score >= 80 ? 'text-green-600' : review.score >= 60 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Code Review Results</h2>
            <p className="text-sm text-gray-600 mt-1">{review.summary}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        {/* Score Card */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Code Quality Score</div>
              <div className={`text-4xl font-bold ${scoreColor}`}>{review.score}/100</div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                <div className="text-xs text-gray-600">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
                <div className="text-xs text-gray-600">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
                <div className="text-xs text-gray-600">Info</div>
              </div>
            </div>
          </div>
        </div>

        {/* Issues List */}
        {review.issues.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Issues Found</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {review.issues.map((issue, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded border-l-4 ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-500'
                      : issue.severity === 'warning'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            issue.severity === 'error'
                              ? 'bg-red-100 text-red-700'
                              : issue.severity === 'warning'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {issue.severity.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{issue.file}</span>
                        {issue.line && (
                          <span className="text-xs text-gray-500">Line {issue.line}</span>
                        )}
                        <span className="text-xs text-gray-500">• {issue.category}</span>
                      </div>
                      <div className="text-sm text-gray-700 mb-1">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {review.suggestions && review.suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Suggestions</h3>
            <div className="space-y-2">
              {review.suggestions.map((suggestion, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded border ${
                    suggestion.priority === 'high'
                      ? 'bg-red-50 border-red-200'
                      : suggestion.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="font-medium text-gray-900 mb-1">{suggestion.title}</div>
                  <div className="text-sm text-gray-600">{suggestion.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
          >
            Close
          </button>
          {onFixAll && (
            <button
              onClick={onFixAll}
              className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
            >
              View Inline Comments
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
