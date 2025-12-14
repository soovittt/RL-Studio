import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'
import { updateScene } from '~/lib/sceneClient'

interface EnvironmentCardProps {
  env: {
    _id: Id<'environments'>
    name: string
    description?: string
    type?: string
    envType?: string
    createdAt: number
  }
  onUpdate?: () => void
}

export function EnvironmentCard({ env, onUpdate }: EnvironmentCardProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editName, setEditName] = useState(env.name)
  const [editDescription, setEditDescription] = useState(env.description || '')
  const menuRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const descInputRef = useRef<HTMLTextAreaElement>(null)

  const updateMutation = useMutation(api.environments.update)
  const deleteMutation = useMutation(api.environments.deleteEnvironment)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Sync edit state with env changes
  useEffect(() => {
    setEditName(env.name)
    setEditDescription(env.description || '')
  }, [env.name, env.description])

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  useEffect(() => {
    if (isEditingDescription && descInputRef.current) {
      descInputRef.current.focus()
      // Place cursor at end
      descInputRef.current.setSelectionRange(
        descInputRef.current.value.length,
        descInputRef.current.value.length
      )
    }
  }, [isEditingDescription])

  const handleSaveName = async () => {
    if (editName.trim() && editName !== env.name) {
      const newName = editName.trim()

      // Update in old system (environments table)
      await updateMutation({
        id: env._id,
        name: newName,
      })

      // Also update in Scene Service if this environment has been migrated
      // Note: env._id is an environment ID, we need to find the scene with projectId = env._id
      try {
        const { getSceneByProjectId } = await import('~/lib/sceneClient')
        const sceneData = await getSceneByProjectId(env._id)
        if (sceneData?.scene) {
          // Use the scene ID (not environment ID) for update
          await updateScene(sceneData.scene._id, {
            name: newName,
          })
        }
      } catch (err) {
        // Scene not found in new system - that's okay, just update old system
        // This is expected for environments that haven't been migrated to Scene Service yet
        console.log('Environment not in Scene Service, updating old system only:', err)
      }

      if (onUpdate) onUpdate()
    }
    setIsEditingName(false)
  }

  const handleSaveDescription = async () => {
    const newDesc = editDescription.trim()
    if (newDesc !== (env.description || '')) {
      // Update in old system (environments table)
      await updateMutation({
        id: env._id,
        description: newDesc || undefined,
      })

      // Also update in Scene Service if this environment has been migrated
      // Note: env._id is an environment ID, we need to find the scene with projectId = env._id
      try {
        const { getSceneByProjectId } = await import('~/lib/sceneClient')
        const sceneData = await getSceneByProjectId(env._id)
        if (sceneData?.scene) {
          // Use the scene ID (not environment ID) for update
          await updateScene(sceneData.scene._id, {
            description: newDesc || undefined,
          })
        }
      } catch (err) {
        // Scene not found in new system - that's okay, just update old system
        // This is expected for environments that haven't been migrated to Scene Service yet
        console.log('Environment not in Scene Service, updating old system only:', err)
      }

      if (onUpdate) onUpdate()
    }
    setIsEditingDescription(false)
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${env.name}"? This action cannot be undone.`)) {
      await deleteMutation({ id: env._id })
      if (onUpdate) onUpdate()
    }
    setShowMenu(false)
  }

  const envType = env.envType || env.type || 'grid'

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on editable areas or menu
    const target = e.target as HTMLElement
    if (
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('h3') ||
      target.closest('[title="Click to edit title"]') ||
      target.closest('[title="Click to edit description"]') ||
      target.closest('[ref]') ||
      isEditingName ||
      isEditingDescription
    ) {
      return
    }
    // Navigate to environment view
    navigate({ to: '/environments/$id', params: { id: env._id } })
  }

  return (
    <div
      className="group relative bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* 3-dot menu button */}
      <div className="absolute top-3 right-3" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Options"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute right-0 mt-1 w-48 bg-popover border border-border rounded-md shadow-lg z-10">
            <div className="py-1">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsEditingName(true)
                  setShowMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Edit title
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsEditingDescription(true)
                  setShowMenu(false)
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Edit description
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDelete()
                }}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card content - editable title and description, clickable footer */}
      <div className="block">
        {/* Title */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveName()
              } else if (e.key === 'Escape') {
                setEditName(env.name)
                setIsEditingName(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-lg font-semibold mb-2 bg-background border-b-2 border-primary focus:outline-none px-1"
          />
        ) : (
          <h3
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingName(true)
            }}
            className="text-lg font-semibold mb-2 text-foreground cursor-text hover:bg-muted/30 rounded px-1 -mx-1 transition-colors"
            title="Click to edit title"
          >
            {env.name}
          </h3>
        )}

        {/* Description */}
        {isEditingDescription ? (
          <textarea
            ref={descInputRef}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={handleSaveDescription}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditDescription(env.description || '')
                setIsEditingDescription(false)
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                // Cmd/Ctrl+Enter to save
                handleSaveDescription()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm text-muted-foreground mb-4 bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-primary resize-none"
            rows={3}
            placeholder="Add a description..."
          />
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingDescription(true)
            }}
            className="text-sm text-muted-foreground mb-4 min-h-[2.5rem] cursor-text hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group"
            title="Click to edit description"
          >
            {env.description ? (
              <p className="whitespace-pre-wrap">{env.description}</p>
            ) : (
              <span className="italic text-muted-foreground/60 flex items-center gap-1">
                <svg
                  className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                No description - click to add
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs font-medium px-2 py-1 bg-muted rounded text-foreground">
            {envType}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(env.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
