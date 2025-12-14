import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useAuth } from '~/lib/auth'
import { EnvSpec, createDefaultEnvSpec, Vec2 } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { SelectionProvider } from '~/lib/selectionManager.js'
import { HistoryManager } from '~/lib/historyManager'
import { createScene, createSceneVersion, updateScene, getScene } from '~/lib/sceneClient'
import { envSpecToSceneGraph, envSpecToRLConfig } from '~/lib/envSpecToSceneGraph'
import { sceneGraphToEnvSpec } from '~/lib/sceneGraphToEnvSpec'
import { CreateRun } from './CreateRun'
import { EnhancedImportDialog } from './EnhancedImportDialog'
import { CodeReviewPanel } from './CodeReviewPanel'
import { CodeValidationPanel } from './CodeValidationPanel'
import { TemplateSelector } from './TemplateSelector'
import { EnvironmentEditorInner } from './EnvironmentEditorInner'

interface EnvironmentEditorProps {
  id?: string
}

// Helper to load/migrate environment to universal EnvSpec
function loadEnvSpec(env: any): EnvSpec {
  if (!env) {
    return createDefaultEnvSpec('grid', 'Untitled Environment')
  }

  // If already in universal format, return as-is
  if (env.envSpec) {
    return env.envSpec as EnvSpec
  }

  // Migrate from legacy format using SceneGraphManager
  return SceneGraphManager.migrateFromLegacy(env)
}

export function EnvironmentEditor({ id: propId }: EnvironmentEditorProps = {}) {
  const id = propId || 'new'
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showCreateRun, setShowCreateRun] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showCodeReview, setShowCodeReview] = useState(false)
  const [exportedFiles, setExportedFiles] = useState<Record<string, string> | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>()
  const [rolloutState, setRolloutState] = useState<{
    agents: Array<{ id: string; position: Vec2 }>
  } | null>(null)

  // Try to load from Scene Service first, fallback to old system
  const [sceneData, setSceneData] = useState<{ scene: any; activeVersion: any } | null>(null)
  const [sceneLoading, setSceneLoading] = useState(false)

  // Load from Scene Service if id is provided
  useEffect(() => {
    if (id !== 'new' && user?._id) {
      setSceneLoading(true)
      getScene(id)
        .then((data) => {
          setSceneData(data)
          setSceneLoading(false)
        })
        .catch((err) => {
          // Scene not found in new system - fallback to old system
          console.log('Scene not found in Scene Service, falling back to old system:', err)
          setSceneLoading(false)
        })
    }
  }, [id, user?._id])

  // Old system fallback
  const env = id !== 'new' && !sceneData ? useQuery(api.environments.get, { id: id as any }) : null
  const isLoading = id !== 'new' && sceneLoading && !sceneData && env === undefined

  const createMutation = useMutation(api.environments.create)
  const updateMutation = useMutation(api.environments.update)

  // Load/migrate to universal EnvSpec format
  const envSpec = useMemo(() => {
    if (id === 'new') {
      // Check for template in sessionStorage
      const templateData = sessionStorage.getItem('rl_studio_template')
      if (templateData) {
        sessionStorage.removeItem('rl_studio_template')
        const template = JSON.parse(templateData)
        // If template is already EnvSpec, use it; otherwise migrate
        if (template.id && template.world) {
          return template as EnvSpec
        }
        return SceneGraphManager.migrateFromLegacy(template)
      }
      return createDefaultEnvSpec('grid', 'Untitled Environment')
    }

    // Priority 1: Load from Scene Service (new system)
    if (sceneData?.activeVersion) {
      try {
        const spec = sceneGraphToEnvSpec(
          sceneData.activeVersion.sceneGraph,
          sceneData.activeVersion.rlConfig,
          sceneData.scene.name
        )
        return spec
      } catch (err) {
        console.error('Failed to convert scene to EnvSpec:', err)
        // Fall through to old system
      }
    }

    // Priority 2: Load from old system (backward compatibility)
    if (env) {
      const spec = loadEnvSpec(env)
      // Always sync top-level name with envSpec.name
      if (env && env.name && spec) {
        spec.name = env.name
      }
      return spec
    }

    // Default fallback
    return createDefaultEnvSpec('grid', 'Untitled Environment')
  }, [id, env, sceneData])

  const [localEnvSpec, setLocalEnvSpec] = useState(envSpec)

  // Track if we've manually set localEnvSpec (e.g., from template)
  // Only reset when id changes FROM something else TO 'new'
  const manuallySetRef = useRef(false)
  const prevIdRef = useRef(id)
  // Track if we're currently updating the name to prevent sync from overwriting
  const isUpdatingNameRef = useRef(false)
  // Track if we've auto-created the environment
  const hasAutoCreatedRef = useRef(false)
  // Keep a ref to the current localEnvSpec for auto-creation
  const localEnvSpecRef = useRef(localEnvSpec)

  useEffect(() => {
    // Only reset if we just navigated TO 'new' from a different page
    if (id === 'new' && prevIdRef.current !== 'new') {
      manuallySetRef.current = false // Reset when first creating new environment
      hasAutoCreatedRef.current = false // Reset auto-creation flag
    }
    prevIdRef.current = id
  }, [id])

  // Auto-create environment when user navigates to /environments/new
  useEffect(() => {
    if (id === 'new' && user?._id && !hasAutoCreatedRef.current) {
      // Small delay to avoid creating if user navigates away immediately
      const timer = setTimeout(async () => {
        // Double-check conditions before creating
        const currentSpec = localEnvSpecRef.current
        if (id === 'new' && user?._id && !hasAutoCreatedRef.current && currentSpec) {
          hasAutoCreatedRef.current = true

          console.log('Auto-creating environment...', {
            userId: user._id,
            specName: currentSpec.name,
          })

          try {
            // Convert EnvSpec to sceneGraph + rlConfig
            const sceneGraph = envSpecToSceneGraph(currentSpec)
            const rlConfig = envSpecToRLConfig(currentSpec)

            // Create new scene in Scene Service (primary)
            const scene = await createScene({
              projectId: undefined, // Will be set after creating environment (undefined, not empty string)
              name: currentSpec.name || 'Untitled Environment',
              description: currentSpec.metadata?.notes,
              mode: currentSpec.world.coordinateSystem === 'grid' ? 'grid' : '2d',
              environmentSettings: {},
              createdBy: user._id,
            })
            const sceneId = scene.id

            // Create initial version
            await createSceneVersion(scene.id, {
              sceneGraph,
              rlConfig,
              createdBy: user._id,
            })

            // Also save to old system for backward compatibility (REQUIRED for list to show it)
            let envId: string
            try {
              envId = await createMutation({
                ownerId: user._id,
                name: currentSpec.name || 'Untitled Environment',
                envSpec: currentSpec,
              })

              // Update scene with projectId
              await updateScene(sceneId, { projectId: envId })

              console.log('Successfully created environment in both systems:', { sceneId, envId })
            } catch (oldSystemError) {
              console.error(
                "Failed to save to old system (CRITICAL - environment won't show in list):",
                oldSystemError
              )
              // This is actually critical - if Convex creation fails, the environment won't show in the list
              // because the list queries Convex, not Scene Service
              alert('Failed to create environment in database. Please try again.')
              hasAutoCreatedRef.current = false // Reset flag so user can retry
              return // Don't navigate if creation failed
            }

            // Navigate to the newly created environment
            navigate({ to: '/environments/$id', params: { id: envId }, replace: true })
          } catch (error) {
            console.error('Failed to auto-create environment:', error)
            hasAutoCreatedRef.current = false // Reset flag on error so we can retry
            // Don't show alert - let user continue working, they can save manually
          }
        }
      }, 500) // 500ms delay

      return () => clearTimeout(timer)
    }
  }, [id, user?._id])

  // Create SceneGraphManager instance
  const sceneGraphRef = useRef<SceneGraphManager | null>(null)
  if (!sceneGraphRef.current) {
    sceneGraphRef.current = new SceneGraphManager(envSpec)
  } else {
    // Update sceneGraph when envSpec changes externally
    const currentSpec = sceneGraphRef.current.getSpec()
    if (currentSpec.id !== envSpec.id || JSON.stringify(currentSpec) !== JSON.stringify(envSpec)) {
      sceneGraphRef.current = new SceneGraphManager(envSpec)
    }
  }
  const sceneGraph = sceneGraphRef.current

  // Create HistoryManager instance
  const historyManagerRef = useRef<HistoryManager | null>(null)
  if (!historyManagerRef.current) {
    historyManagerRef.current = new HistoryManager(envSpec, (spec) => {
      // Auto-save callback - save to localStorage for new environments
      if (id === 'new') {
        try {
          localStorage.setItem('rl_studio_autosave', JSON.stringify(spec))
        } catch (error) {
          console.warn('Failed to auto-save:', error)
        }
      }
    })
  } else {
    // Reset history when envSpec changes externally
    const current = historyManagerRef.current.getCurrent()
    if (!current || current.id !== envSpec.id) {
      historyManagerRef.current.reset(envSpec)
    }
  }
  const historyManager = historyManagerRef.current

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (historyManagerRef.current) {
        historyManagerRef.current.stopAutoSave()
      }
    }
  }, [])

  // Update ref whenever localEnvSpec changes
  useEffect(() => {
    localEnvSpecRef.current = localEnvSpec
  }, [localEnvSpec])

  // Sync localEnvSpec when envSpec changes (e.g., template loaded or name updated from database)
  // BUT: Don't overwrite if we just set it manually (e.g., from template selection or name change)
  useEffect(() => {
    // Skip sync if we're in the middle of updating the name
    if (isUpdatingNameRef.current) {
      return
    }

    if (id === 'new') {
      // Only sync on initial mount, not after manual changes
      if (!manuallySetRef.current) {
        setLocalEnvSpec(envSpec)
      }
    } else {
      // For existing environments, update local state when envSpec changes from query
      // This ensures the UI reflects database changes (like name updates from other sources)
      if (envSpec && envSpec.id === localEnvSpec.id) {
        // Same environment - check if envSpec has meaningful updates from server
        // Only sync if the name is different (indicating a server-side update)
        // and we're not in the middle of a local update
        if (envSpec.name !== localEnvSpec.name) {
          setLocalEnvSpec(envSpec)
        }
      } else if (envSpec && envSpec.id !== localEnvSpec.id) {
        // Different environment - full sync
        setLocalEnvSpec(envSpec)
      }
    }
  }, [envSpec, id])

  const handleSpecChange = async (newSpec: EnvSpec) => {
    // Push to history
    if (historyManagerRef.current) {
      historyManagerRef.current.push(newSpec)
    }

    // Update sceneGraph
    sceneGraphRef.current = new SceneGraphManager(newSpec)

    // CRITICAL: Update local state IMMEDIATELY for real-time UI updates
    // This ensures the UI updates instantly, even for saved environments
    manuallySetRef.current = true // Mark as manually set
    setLocalEnvSpec(newSpec)

    if (id !== 'new') {
      // Update in Convex in the background (async, non-blocking)
      updateMutation({
        id: id as any,
        envSpec: newSpec, // Store as universal EnvSpec
      })

      // Also auto-save to Scene Service if scene exists (async, non-blocking)
      if (sceneData?.scene && user?._id) {
        // Don't await - let it run in background
        createSceneVersion(id, {
          sceneGraph: envSpecToSceneGraph(newSpec),
          rlConfig: envSpecToRLConfig(newSpec),
          createdBy: user._id,
        }).catch((err) => {
          console.warn('Failed to auto-save to Scene Service:', err)
        })

        // Update scene metadata if name changed
        if (newSpec.name && sceneData.scene.name !== newSpec.name) {
          updateScene(id, {
            name: newSpec.name,
            description: newSpec.metadata?.notes,
          }).catch((err) => {
            console.warn('Failed to update scene metadata:', err)
          })
        }
      }
    }
  }

  const handleUndo = () => {
    if (historyManagerRef.current && historyManagerRef.current.canUndo()) {
      const previousSpec = historyManagerRef.current.undo()
      if (previousSpec) {
        // Update sceneGraph
        sceneGraphRef.current = new SceneGraphManager(previousSpec)
        setLocalEnvSpec(previousSpec)

        if (id !== 'new') {
          updateMutation({
            id: id as any,
            envSpec: previousSpec,
          })
        }
      }
    }
  }

  const handleRedo = () => {
    if (historyManagerRef.current && historyManagerRef.current.canRedo()) {
      const nextSpec = historyManagerRef.current.redo()
      if (nextSpec) {
        // Update sceneGraph
        sceneGraphRef.current = new SceneGraphManager(nextSpec)
        setLocalEnvSpec(nextSpec)

        if (id !== 'new') {
          updateMutation({
            id: id as any,
            envSpec: nextSpec,
          })
        }
      }
    }
  }

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [id])

  const handleNameChange = async (name: string) => {
    if (id === 'new') {
      // For new environments, use handleSpecChange to properly update everything
      const updatedSpec = { ...localEnvSpec, name }
      handleSpecChange(updatedSpec)
    } else {
      // Set flag to prevent sync from overwriting our local change
      isUpdatingNameRef.current = true

      // Update both top-level name and envSpec.name to keep them in sync
      const updatedSpec = { ...localEnvSpec, name }

      // Update local state immediately for instant UI feedback
      setLocalEnvSpec(updatedSpec)

      try {
        // Update in Convex (old system)
        await updateMutation({
          id: id as any,
          name,
          envSpec: updatedSpec, // Also update envSpec.name
        })

        // Also update Scene Service if scene exists
        if (sceneData?.scene) {
          try {
            await updateScene(id, {
              name,
            })
          } catch (err) {
            console.warn('Failed to update scene name in Scene Service:', err)
            // Non-critical error, continue
          }
        }
      } finally {
        // Clear flag after a short delay to allow query to refetch
        setTimeout(() => {
          isUpdatingNameRef.current = false
        }, 1000)
      }
    }
  }

  const handleEnvTypeChange = (
    newType: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom'
  ) => {
    const newSpec = createDefaultEnvSpec(
      newType === 'graph' || newType === 'bandit' || newType === 'custom' ? 'custom2d' : newType,
      envSpec.name
    )
    handleSpecChange(newSpec)
  }

  const handleTestRollout = () => {
    // Trigger rollout from bottom panel
    if ((window as any).__runRollout) {
      ;(window as any).__runRollout()
    }
  }

  const handleLaunchTraining = () => {
    if (id === 'new') {
      alert('Please save the environment first')
      return
    }
    setShowCreateRun(true)
  }

  const handleExport = () => {
    import('~/lib/universalExporter')
      .then(({ exportProject }) => {
        const files = exportProject({
          envSpec: currentSpec,
          algorithm: 'ppo',
          hyperparams: {
            learning_rate: 3e-4,
            gamma: 0.99,
            steps: 1000000,
          },
        })

        // Show code review panel
        setExportedFiles(files)
        setShowCodeReview(true)

        // Also download files
        Object.entries(files).forEach(([filename, content]) => {
          const blob = new Blob([content], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
        })
      })
      .catch((error) => {
        console.error('Export failed:', error)
        alert('Export failed: ' + (error as Error).message)
      })
  }

  const handleValidateCode = () => {
    setShowValidation(true)
  }

  const handleNewEnvironment = () => {
    navigate({ to: '/environments/new' })
  }

  const handleNewFromTemplate = () => {
    setShowTemplates(true)
  }

  const handleTemplateSelect = (envSpec: EnvSpec) => {
    try {
      console.log('Template selected, navigating to new environment:', envSpec)

      // If we're already on the new page, update state directly
      if (id === 'new') {
        console.log('Already on new page, updating state directly')
        // Use handleSpecChange to ensure all state is properly updated
        // This will update localEnvSpec, sceneGraph, and history
        handleSpecChange(envSpec)
        setShowTemplates(false)
        return
      }

      // Otherwise navigate to new environment with template data
      sessionStorage.setItem('rl_studio_template', JSON.stringify(envSpec))
      navigate({ to: '/environments/new' })
    } catch (err) {
      console.error('Error in handleTemplateSelect:', err)
      alert(
        `Failed to create environment from template: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const handleDuplicate = async (_envId: string) => {
    // TODO: Implement duplicate
    alert('Duplicate coming soon!')
  }

  const handleImportFromPaper = () => {
    setShowImport(true)
  }

  const handleImportComplete = (importedSpec: EnvSpec) => {
    handleSpecChange(importedSpec)
    setShowImport(false)
  }

  if (isLoading && id !== 'new') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Use localEnvSpec for both new and existing environments to ensure immediate UI updates
  // envSpec from query will sync to localEnvSpec via useEffect when it changes
  const currentSpec = localEnvSpec

  return (
    <SelectionProvider>
      <EnvironmentEditorInner
        currentSpec={currentSpec}
        sceneGraph={sceneGraph}
        selectedAssetId={selectedAssetId}
        setSelectedAssetId={setSelectedAssetId}
        rolloutState={rolloutState}
        setRolloutState={setRolloutState}
        handleSpecChange={handleSpecChange}
        handleNameChange={handleNameChange}
        handleEnvTypeChange={handleEnvTypeChange}
        handleTestRollout={handleTestRollout}
        handleLaunchTraining={handleLaunchTraining}
        handleExport={handleExport}
        handleValidateCode={handleValidateCode}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        canUndo={historyManager?.canUndo() || false}
        canRedo={historyManager?.canRedo() || false}
        handleNewEnvironment={handleNewEnvironment}
        handleNewFromTemplate={handleNewFromTemplate}
        handleDuplicate={handleDuplicate}
        handleImportFromPaper={handleImportFromPaper}
        currentEnvId={id !== 'new' ? id : undefined}
      />

      {/* Enhanced Import Modal */}
      {showImport && (
        <EnhancedImportDialog
          onClose={() => setShowImport(false)}
          onImport={handleImportComplete}
        />
      )}

      {/* Code Review Panel */}
      {showCodeReview && exportedFiles && (
        <CodeReviewPanel
          files={exportedFiles}
          onClose={() => {
            setShowCodeReview(false)
            setExportedFiles(null)
          }}
        />
      )}

      {/* Validate Code Panel */}
      {showValidation && (
        <CodeValidationPanel envSpec={currentSpec} onClose={() => setShowValidation(false)} />
      )}

      {/* Template Selector */}
      {showTemplates && (
        <TemplateSelector onClose={() => setShowTemplates(false)} onSelect={handleTemplateSelect} />
      )}

      {/* Save button removed - environments now auto-create and auto-save */}

      {/* Create Run Modal */}
      {showCreateRun && id !== 'new' && (
        <CreateRun envId={id} onClose={() => setShowCreateRun(false)} />
      )}
    </SelectionProvider>
  )
}
