import { useMemo } from 'react'
import { EnvSpec, Vec2 } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { GridCanvasThree } from './GridCanvasThree'
import { ContinuousCanvasThree } from './ContinuousCanvasThree'
import { BanditCanvas } from './BanditCanvas'

interface EnvironmentCanvasProps {
  envSpec: EnvSpec
  sceneGraph: SceneGraphManager
  onSpecChange: (spec: EnvSpec) => void
  rolloutState?: {
    agents: Array<{ id: string; position: Vec2 }>
  }
}

export function EnvironmentCanvas({ envSpec, sceneGraph, onSpecChange, rolloutState }: EnvironmentCanvasProps) {
  const envType = envSpec.envType

  switch (envType) {
    case 'grid':
      return (
        <GridCanvasThree
          envSpec={envSpec}
          sceneGraph={sceneGraph}
          onSpecChange={onSpecChange}
          rolloutState={rolloutState}
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
}

