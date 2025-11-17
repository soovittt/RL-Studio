/**
 * Template Selector Dialog - Choose from pre-built environment templates
 */

import { useState } from 'react'
import { TEMPLATES, type EnvironmentTemplate } from './EnvironmentTemplates'
import { EnvSpec, createDefaultEnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'

interface TemplateSelectorProps {
  onClose: () => void
  onSelect: (envSpec: EnvSpec) => void
}

export function TemplateSelector({ onClose, onSelect }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<EnvironmentTemplate | null>(null)

  const handleSelect = (template: EnvironmentTemplate) => {
    // Convert template spec to universal EnvSpec
    let envSpec: EnvSpec

    if (template.spec.id && template.spec.world) {
      // Already in universal format
      envSpec = template.spec as EnvSpec
    } else {
      // Migrate from legacy format
      envSpec = SceneGraphManager.migrateFromLegacy({
        ...template.spec,
        type: template.envType,
        name: template.name,
      })
    }

    // Ensure name is set
    envSpec.name = template.name

    onSelect(envSpec)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Choose a Template</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedTemplate?.id === template.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
              onClick={() => setSelectedTemplate(template)}
              onDoubleClick={() => handleSelect(template)}
            >
              <h3 className="font-semibold mb-2">{template.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs px-2 py-1 bg-muted rounded">
                  {template.envType}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(template)
                  }}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                >
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>

        {selectedTemplate && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">{selectedTemplate.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{selectedTemplate.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelect(selectedTemplate)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
              >
                Create from Template
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-border rounded hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

