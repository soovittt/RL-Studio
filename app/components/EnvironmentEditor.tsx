import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useAuth } from '~/lib/auth'
import { EnvSpec, createDefaultEnvSpec, Vec2 } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { SelectionProvider } from '~/lib/selectionManager.js'
import { HistoryManager } from '~/lib/historyManager'
import { StudioLayout } from './StudioLayout'
import { StudioTopBar } from './StudioTopBar'
import { StudioSidebar } from './StudioSidebar'
import { StudioPropertiesPanel } from './StudioPropertiesPanel'
import { StudioBottomPanel } from './StudioBottomPanel'
import { EnvironmentCanvas } from './EnvironmentCanvas'
import { CreateRun } from './CreateRun'
import { EnhancedImportDialog } from './EnhancedImportDialog'
import { CodeReviewPanel } from './CodeReviewPanel'
import { CodeValidationPanel } from './CodeValidationPanel'

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
  const [selectedObjectId, setSelectedObjectId] = useState<string | undefined>()
  const [rolloutState, setRolloutState] = useState<{ agents: Array<{ id: string; position: Vec2 }> } | null>(null)

  const env = id !== 'new' ? useQuery(api.environments.get, { id: id as any }) : null
  const isLoading = id !== 'new' && env === undefined

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
    const spec = loadEnvSpec(env)
    // Always sync top-level name with envSpec.name
    if (env && env.name && spec) {
      spec.name = env.name
    }
    return spec
  }, [id, env])

  const [localEnvSpec, setLocalEnvSpec] = useState(envSpec)

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

  // Sync localEnvSpec when envSpec changes (e.g., template loaded or name updated from database)
  useEffect(() => {
    if (id === 'new') {
      setLocalEnvSpec(envSpec)
    } else {
      // For existing environments, update local state when envSpec changes from query
      // This ensures the UI reflects database changes (like name updates)
      if (envSpec && envSpec.name !== localEnvSpec.name) {
        setLocalEnvSpec(envSpec)
      }
    }
  }, [envSpec, id, localEnvSpec.name])

  const handleSpecChange = (newSpec: EnvSpec) => {
    // Push to history
    if (historyManagerRef.current) {
      historyManagerRef.current.push(newSpec)
    }

    // Update sceneGraph
    sceneGraphRef.current = new SceneGraphManager(newSpec)
    
    if (id === 'new') {
      setLocalEnvSpec(newSpec)
    } else {
      // Update in Convex using universal format
      updateMutation({
        id: id as any,
        envSpec: newSpec, // Store as universal EnvSpec
      })
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
      setLocalEnvSpec({ ...localEnvSpec, name })
    } else {
      // Update both top-level name and envSpec.name to keep them in sync
      const updatedSpec = { ...envSpec, name }
      await updateMutation({ 
        id: id as any, 
        name,
        envSpec: updatedSpec, // Also update envSpec.name
      })
    }
  }

  const handleEnvTypeChange = (newType: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom') => {
    const newSpec = createDefaultEnvSpec(newType === 'graph' || newType === 'bandit' || newType === 'custom' ? 'custom2d' : newType, envSpec.name)
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
    import('~/lib/universalExporter').then(({ exportProject }) => {
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
    }).catch((error) => {
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
    // Navigate to new environment with template data
    sessionStorage.setItem('rl_studio_template', JSON.stringify(envSpec))
    navigate({ to: '/environments/new' })
  }

  const handleDuplicate = async (envId: string) => {
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

  const handleSave = async () => {
    if (!user?._id) {
      alert('Please log in to create environments')
      return
    }
    try {
      const envId = await createMutation({
        ownerId: user._id,
        name: localEnvSpec.name || 'Untitled Environment',
        envSpec: localEnvSpec, // Store as universal EnvSpec
      })
      navigate({ to: '/environments/$id', params: { id: envId } })
    } catch (error) {
      console.error('Failed to create environment:', error)
      alert('Failed to create environment')
    }
  }

  if (isLoading && id !== 'new') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const currentSpec = id === 'new' ? localEnvSpec : envSpec

  return (
    <SelectionProvider>
      <StudioLayout
        topBar={
          <StudioTopBar
            envName={currentSpec.name || 'Untitled Environment'}
            envType={currentSpec.envType || 'grid'}
            onNameChange={handleNameChange}
            onEnvTypeChange={handleEnvTypeChange}
            onTestRollout={handleTestRollout}
            onLaunchTraining={handleLaunchTraining}
            onExport={handleExport}
            onValidateCode={handleValidateCode}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyManager?.canUndo() || false}
            canRedo={historyManager?.canRedo() || false}
          />
        }
        leftSidebar={
          <StudioSidebar
            currentEnvId={id !== 'new' ? id : undefined}
            onNewEnvironment={handleNewEnvironment}
            onNewFromTemplate={handleNewFromTemplate}
            onDuplicate={handleDuplicate}
            onImportFromPaper={handleImportFromPaper}
          />
        }
        centerCanvas={
              <EnvironmentCanvas
                envSpec={currentSpec}
                sceneGraph={sceneGraph}
                onSpecChange={handleSpecChange}
                rolloutState={rolloutState || undefined}
              />
            }
        rightPanel={
          <StudioPropertiesPanel
            envSpec={currentSpec}
            onSpecChange={handleSpecChange}
            selectedObjectId={selectedObjectId}
            sceneGraph={sceneGraph}
          />
        }
        bottomPanel={<StudioBottomPanel envSpec={currentSpec} envId={id !== 'new' ? id : undefined} onRunRollout={handleTestRollout} onStepChange={setRolloutState} />}
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
        <CodeValidationPanel
          envSpec={currentSpec}
          onClose={() => setShowValidation(false)}
        />
      )}

      {/* Template Selector */}
      {showTemplates && (
        <TemplateSelector
          onClose={() => setShowTemplates(false)}
          onSelect={handleTemplateSelect}
        />
      )}

      {/* Save Button for New Environments */}
      {id === 'new' && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg shadow-lg hover:opacity-90 font-medium"
          >
            Save Environment
          </button>
        </div>
      )}

      {/* Create Run Modal */}
      {showCreateRun && id !== 'new' && (
        <CreateRun envId={id} onClose={() => setShowCreateRun(false)} />
      )}
    </SelectionProvider>
  )
}
