import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

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
    }
  }, [isEditingDescription])

  const handleSaveName = async () => {
    if (editName.trim() && editName !== env.name) {
      await updateMutation({
        id: env._id,
        name: editName.trim(),
      })
      if (onUpdate) onUpdate()
    }
    setIsEditingName(false)
  }

  const handleSaveDescription = async () => {
    const newDesc = editDescription.trim()
    if (newDesc !== (env.description || '')) {
      await updateMutation({
        id: env._id,
        description: newDesc || undefined,
      })
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

  return (
    <div className="group relative bg-card border border-border rounded-lg p-5 hover:border-primary/50 transition-all duration-200">
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
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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

      {/* Card content - clickable link */}
      <Link
        to="/environments/$id"
        params={{ id: env._id }}
        className="block"
      >
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
          <h3 className="text-lg font-semibold mb-2 text-foreground">{env.name}</h3>
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
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm text-muted-foreground mb-4 bg-background border border-border rounded px-2 py-1 focus:outline-none focus:border-primary resize-none"
            rows={2}
            placeholder="Add a description..."
          />
        ) : (
          <p className="text-sm text-muted-foreground mb-4 min-h-[2.5rem]">
            {env.description || (
              <span className="italic text-muted-foreground/60">No description</span>
            )}
          </p>
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
      </Link>
    </div>
  )
}

