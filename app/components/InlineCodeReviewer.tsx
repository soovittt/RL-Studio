/**
 * Inline Code Reviewer
 * Reviews custom reward/termination scripts with CodeRabbit
 */

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

interface InlineCodeReviewerProps {
  script: string
  scriptType: 'reward' | 'termination' | 'custom'
  onReviewComplete?: (review: any) => void
}

export function InlineCodeReviewer({
  script,
  scriptType,
  onReviewComplete,
}: InlineCodeReviewerProps) {
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const reviewAction = useAction(api.coderabbit.reviewCustomScript)

  const handleReview = async () => {
    if (!script.trim()) {
      setError('Script is empty')
      return
    }

    setIsReviewing(true)
    setError(null)
    setReviewResult(null)

    try {
      const result = await reviewAction({
        script,
        scriptType,
      })

      setReviewResult(result)
      if (onReviewComplete) {
        onReviewComplete(result)
      }
    } catch (err) {
      setError((err as Error).message || 'Review failed')
    } finally {
      setIsReviewing(false)
    }
  }

  if (!script.trim()) {
    return null
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={handleReview}
        disabled={isReviewing}
        className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isReviewing ? (
          <>
            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Reviewing...
          </>
        ) : (
          <>🔍 Review Script with CodeRabbit</>
        )}
      </button>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {reviewResult?.review && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs">
          <div className="font-medium text-gray-900 mb-2">
            Review Results ({reviewResult.review.score}/100)
          </div>
          {reviewResult.review.issues.length > 0 ? (
            <div className="space-y-1.5">
              {reviewResult.review.issues.map((issue: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-2 rounded border-l-2 ${
                    issue.severity === 'error'
                      ? 'bg-red-50 border-red-500'
                      : issue.severity === 'warning'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-xs font-medium ${
                        issue.severity === 'error'
                          ? 'text-red-700'
                          : issue.severity === 'warning'
                            ? 'text-yellow-700'
                            : 'text-blue-700'
                      }`}
                    >
                      {issue.severity.toUpperCase()}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-900">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-xs text-gray-600 italic mt-1">
                          💡 {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-green-700">✓ No issues found!</div>
          )}
        </div>
      )}
    </div>
  )
}
