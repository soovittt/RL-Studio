import { memo } from 'react'
import { EnvSpec, Vec2 } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { GridCanvasThree } from './GridCanvasThree'
import { ContinuousCanvasThree } from './ContinuousCanvasThree'

interface EnvironmentCanvasProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
  selectedAssetId?: string
  onAssetSelect?: (asset: any) => void
}

export const EnvironmentCanvas = memo(function EnvironmentCanvas({
  envSpec,
  sceneGraph,
  onSpecChange,
  rolloutState,
  selectedAssetId,
  onAssetSelect,
}: EnvironmentCanvasProps) {
  const envType = envSpec.envType

  switch (envType) {
    case 'grid':
      return (
        <GridCanvasThree
          envSpec={envSpec}
          sceneGraph={sceneGraph}
          onSpecChange={onSpecChange}
          rolloutState={rolloutState}
          selectedAssetId={selectedAssetId}
          onAssetSelect={onAssetSelect}
        />
      )
    case 'continuous2d':
      return (
        <ContinuousCanvasThree
          envSpec={envSpec}
          sceneGraph={sceneGraph}
          onSpecChange={onSpecChange}
          rolloutState={rolloutState}
        />
      )
    default:
      return (
        <div className="text-center py-12 text-muted-foreground">
          Canvas for {envType} environment type coming soon
        </div>
      )
  }
})
