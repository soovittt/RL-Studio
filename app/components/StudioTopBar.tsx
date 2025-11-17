import { Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

interface StudioTopBarProps {
  envName: string
  envType: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom'
  onNameChange: (name: string) => void
  onEnvTypeChange: (type: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom') => void
  onTestRollout: () => void
  onLaunchTraining: () => void
  onExport: () => void
  onValidateCode?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function StudioTopBar({
  envName,
  envType,
  onNameChange,
  onEnvTypeChange,
  onTestRollout,
  onLaunchTraining,
  onExport,
  onValidateCode,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: StudioTopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingValue, setEditingValue] = useState(envName)

  // Update editing value when envName prop changes (but not while editing)
  useEffect(() => {
    if (!isEditingName) {
      setEditingValue(envName)
    }
  }, [envName, isEditingName])

  const handleStartEdit = () => {
    setEditingValue(envName)
    setIsEditingName(true)
  }

  const handleEndEdit = () => {
    if (editingValue !== envName) {
      onNameChange(editingValue)
    }
    setIsEditingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEndEdit()
    } else if (e.key === 'Escape') {
      setEditingValue(envName) // Reset to original value
      setIsEditingName(false)
    }
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link
          to="/environments"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        
        {isEditingName ? (
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={handleEndEdit}
            onKeyDown={handleKeyDown}
            className="text-lg font-semibold bg-background border-b-2 border-primary focus:outline-none px-2 min-w-[200px]"
            autoFocus
            style={{ zIndex: 10 }}
          />
        ) : (
          <h1
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors select-none"
            onClick={handleStartEdit}
            style={{ userSelect: 'none' }}
          >
            {envName || 'Untitled Environment'}
          </h1>
        )}

        <select
          value={envType}
          onChange={(e) => onEnvTypeChange(e.target.value as any)}
          className="px-2 py-1 text-sm border border-border rounded bg-background"
        >
          <option value="grid">Grid</option>
          <option value="continuous2d">Continuous 2D</option>
          <option value="graph">Graph</option>
          <option value="bandit">Bandit</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        {onUndo && onRedo && (
          <>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo (Ctrl/Cmd+Y)"
            >
              ↷ Redo
            </button>
            <div className="w-px h-6 bg-border" />
          </>
        )}
        {onValidateCode && (
          <button
            onClick={onValidateCode}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
            title="Validate environment code"
          >
            🔍 Validate Code
          </button>
        )}
        <button
          onClick={onTestRollout}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
        >
          Test Rollout
        </button>
        <button
          onClick={onLaunchTraining}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Launch Training
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
        >
          Export
        </button>
      </div>
    </div>
  )
}

