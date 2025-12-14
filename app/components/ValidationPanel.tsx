/**
 * Validation Panel - Shows errors, warnings, and suggestions for action space configuration
 */

import { ActionSpaceValidation } from '~/lib/actionSpaceValidation'

interface ValidationPanelProps {
  validation: ActionSpaceValidation
  title?: string
}

export function ValidationPanel({ validation, title = 'Configuration Status' }: ValidationPanelProps) {
  if (validation.valid && validation.warnings.length === 0 && validation.errors.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400 text-lg">✅</span>
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {title}: Valid configuration
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {validation.errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 dark:text-red-400 text-lg">❌</span>
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Errors</span>
          </div>
          <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 ml-6 list-disc">
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</span>
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Warnings</span>
          </div>
          <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1 ml-6 list-disc">
            {validation.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.suggestions.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-600 dark:text-blue-400 text-lg">💡</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Suggestions</span>
          </div>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 ml-6 list-disc">
            {validation.suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

