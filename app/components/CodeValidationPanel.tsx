/**
 * Code Validation Panel
 * Validates environment code and shows issues
 */

import { useState, useEffect } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvSpec } from '~/lib/envSpec'

interface CodeValidationPanelProps {
  envSpec: EnvSpec
  onClose: () => void
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

export function CodeValidationPanel({ envSpec, onClose }: CodeValidationPanelProps) {
  const [isValidating, setIsValidating] = useState(true)
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validateAction = useAction(api.coderabbit.validateEnvironmentCode)

  useEffect(() => {
    const runValidation = async () => {
      try {
        const result = await validateAction({ envSpec })
        setReviewResult(result)
      } catch (err) {
        setError((err as Error).message || 'Validation failed')
      } finally {
        setIsValidating(false)
      }
    }

    runValidation()
  }, [envSpec, validateAction])

  if (isValidating) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            <div>
              <div className="font-semibold">Validating Environment Code...</div>
              <div className="text-sm text-gray-600">
                Checking for logic errors, bugs, and issues
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
          <div className="text-red-600 mb-4">Validation Error: {error}</div>
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

  // Filter issues by category
  const logicErrors = review.issues.filter((i) => i.category === 'logic')
  const rewardIssues = review.issues.filter(
    (i) => i.message.toLowerCase().includes('reward') || i.category === 'security'
  )
  const terminationIssues = review.issues.filter(
    (i) =>
      i.message.toLowerCase().includes('terminat') || i.message.toLowerCase().includes('step')
  )
  const apiIssues = review.issues.filter((i) => i.category === 'api_compliance')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Environment Code Validation</h2>
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
              <div className="text-sm text-gray-600">Validation Score</div>
              <div
                className={`text-4xl font-bold ${
                  review.score >= 80
                    ? 'text-green-600'
                    : review.score >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`}
              >
                {review.score}/100
              </div>
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

        {/* Category Sections */}
        {logicErrors.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">🔍 Logic Errors</h3>
            <div className="space-y-2">
              {logicErrors.map((issue, idx: number) => (
                <div key={idx} className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                  <div className="text-sm font-medium text-gray-900 mb-1">{issue.message}</div>
                  {issue.suggestion && (
                    <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {rewardIssues.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">🎯 Reward-Related Issues</h3>
            <div className="space-y-2">
              {rewardIssues.map((issue, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 border-l-4 rounded ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 mb-1">{issue.message}</div>
                  {issue.suggestion && (
                    <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {terminationIssues.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">⏱️ Termination Issues</h3>
            <div className="space-y-2">
              {terminationIssues.map((issue, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 border-l-4 rounded ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 mb-1">{issue.message}</div>
                  {issue.suggestion && (
                    <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {apiIssues.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">🔌 API Compliance Issues</h3>
            <div className="space-y-2">
              {apiIssues.map((issue, idx: number) => (
                <div key={idx} className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                  <div className="text-sm font-medium text-gray-900 mb-1">{issue.message}</div>
                  {issue.suggestion && (
                    <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Other Issues */}
        {review.issues.filter(
          (i) =>
            !logicErrors.includes(i) &&
            !rewardIssues.includes(i) &&
            !terminationIssues.includes(i) &&
            !apiIssues.includes(i)
        ).length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Other Issues</h3>
            <div className="space-y-2">
              {review.issues
                .filter(
                  (i) =>
                    !logicErrors.includes(i) &&
                    !rewardIssues.includes(i) &&
                    !terminationIssues.includes(i) &&
                    !apiIssues.includes(i)
                )
                .map((issue, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 border-l-4 rounded ${
                      issue.severity === 'error'
                        ? 'bg-red-50 border-red-500'
                        : issue.severity === 'warning'
                          ? 'bg-yellow-50 border-yellow-500'
                          : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{issue.message}</span>
                      {issue.file && <span className="text-xs text-gray-500">({issue.file})</span>}
                    </div>
                    {issue.suggestion && (
                      <div className="text-xs text-gray-600 italic">💡 {issue.suggestion}</div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {review.suggestions && review.suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">💡 Suggestions</h3>
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
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
