// Inner component to access SelectionProvider context
import { useSelection } from '~/lib/selectionManager.js'
import { StudioLayout } from './StudioLayout'
import { StudioTopBar } from './StudioTopBar'
import { StudioSidebar } from './StudioSidebar'
import { StudioPropertiesPanel } from './StudioPropertiesPanel'
import { StudioBottomPanel } from './StudioBottomPanel'
import { EnvironmentCanvas } from './EnvironmentCanvas'
import type { EnvSpec, Vec2 } from '~/lib/envSpec'
import type { SceneGraphManager } from '~/lib/sceneGraph'

interface EnvironmentEditorInnerProps {
  currentSpec: EnvSpec
  sceneGraph: SceneGraphManager
  selectedAssetId?: string
  setSelectedAssetId: (id: string | undefined) => void
  rolloutState: { agents: Array<{ id: string; position: Vec2 }> } | null
  setRolloutState: (state: { agents: Array<{ id: string; position: Vec2 }> } | null) => void
  handleSpecChange: (spec: EnvSpec) => void
  handleNameChange: (name: string) => Promise<void>
  handleEnvTypeChange: (newType: 'grid' | 'continuous2d' | 'graph' | 'bandit' | 'custom') => void
  handleTestRollout: () => void
  handleLaunchTraining: () => void
  handleExport: () => void
  handleValidateCode: () => void
  handleUndo: () => void
  handleRedo: () => void
  canUndo: boolean
  canRedo: boolean
  handleNewEnvironment: () => void
  handleNewFromTemplate: () => void
  handleDuplicate: (envId: string) => void
  handleImportFromPaper: () => void
  currentEnvId?: string
}

export function EnvironmentEditorInner(props: EnvironmentEditorInnerProps) {
  const { selection, selectObject } = useSelection()
  const selectedObjectId = selection.selectedObjectId || undefined

  return (
    <StudioLayout
      topBar={
        <StudioTopBar
          envName={props.currentSpec.name || 'Untitled Environment'}
          envType={props.currentSpec.envType || 'grid'}
          onNameChange={props.handleNameChange}
          onEnvTypeChange={props.handleEnvTypeChange}
          onTestRollout={props.handleTestRollout}
          onLaunchTraining={props.handleLaunchTraining}
          onExport={props.handleExport}
          onValidateCode={props.handleValidateCode}
          onUndo={props.handleUndo}
          onRedo={props.handleRedo}
          canUndo={props.canUndo}
          canRedo={props.canRedo}
        />
      }
      leftSidebar={
        <StudioSidebar
          currentEnvId={props.currentEnvId}
          onNewEnvironment={props.handleNewEnvironment}
          onNewFromTemplate={props.handleNewFromTemplate}
          onDuplicate={props.handleDuplicate}
          onImportFromPaper={props.handleImportFromPaper}
          envSpec={props.currentSpec}
          selectedAssetId={props.selectedAssetId}
          onSelectAsset={(asset) => {
            props.setSelectedAssetId(asset?._id)
          }}
          selectedObjectId={selectedObjectId}
          onSelectObject={(id) => {
            selectObject(id || null)
          }}
        />
      }
      centerCanvas={
        <EnvironmentCanvas
          key={props.currentSpec.id}
          envSpec={props.currentSpec}
          sceneGraph={props.sceneGraph}
          onSpecChange={props.handleSpecChange}
          rolloutState={props.rolloutState || undefined}
          selectedAssetId={props.selectedAssetId}
          onAssetSelect={(asset) => {
            props.setSelectedAssetId(asset?._id)
          }}
        />
      }
      rightPanel={
        <StudioPropertiesPanel
          envSpec={props.currentSpec}
          onSpecChange={props.handleSpecChange}
          selectedObjectId={selectedObjectId}
          sceneGraph={props.sceneGraph}
        />
      }
      bottomPanel={
        <StudioBottomPanel
          envSpec={props.currentSpec}
          envId={props.currentEnvId}
          onRunRollout={props.handleTestRollout}
          onStepChange={props.setRolloutState}
        />
      }
    />
  )
}
