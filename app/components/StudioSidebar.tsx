import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { TEMPLATES } from './EnvironmentTemplates'

interface StudioSidebarProps {
  currentEnvId?: string
  onNewEnvironment: () => void
  onNewFromTemplate: (template: any) => void
  onDuplicate: (envId: string) => void
  onImportFromPaper: () => void
}

export function StudioSidebar({
  currentEnvId,
  onNewEnvironment,
  onNewFromTemplate,
  onDuplicate,
  onImportFromPaper,
}: StudioSidebarProps) {
  const envs = useQuery(api.environments.listRecent, {})
  const [showTemplates, setShowTemplates] = useState(false)

  return (
    <div className="p-4">
      <div className="mb-4">
        <button
          onClick={onNewEnvironment}
          className="w-full px-3 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:opacity-90"
        >
          New Environment
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={() => onNewFromTemplate()}
          className="w-full px-3 py-2 border border-border rounded text-sm hover:bg-muted font-medium"
        >
          📋 Templates & Assets
        </button>
      </div>

      <div className="mb-4">
        <button
          onClick={onImportFromPaper}
          className="w-full px-3 py-2 border border-border rounded text-sm hover:bg-muted"
        >
          Import from Paper
        </button>
      </div>

      <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Environments
      </div>

      <div className="space-y-1">
        {envs === undefined ? (
          <div className="text-sm text-muted-foreground p-2">Loading...</div>
        ) : envs.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">No environments yet</div>
        ) : (
          envs.map((env) => (
            <Link
              key={env._id}
              to="/environments/$id"
              params={{ id: env._id }}
              className={`block px-3 py-2 rounded text-sm hover:bg-muted ${
                currentEnvId === env._id ? 'bg-muted font-medium' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{env.name}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDuplicate(env._id)
                  }}
                  className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Duplicate"
                >
                  ⧉
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {env.envType || env.type || 'grid'}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

