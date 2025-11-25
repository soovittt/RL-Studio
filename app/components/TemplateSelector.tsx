/**
 * Template Selector Dialog - Choose from pre-built environment templates
 */

import { useState, useEffect } from 'react'
import { TEMPLATES, type EnvironmentTemplate } from './EnvironmentTemplates'
import { EnvSpec, createDefaultEnvSpec } from '~/lib/envSpec'
import { SceneGraphManager } from '~/lib/sceneGraph'
import { listTemplates, type Template } from '~/lib/templateClient'
import { listAssets, type Asset } from '~/lib/assetClient'
import { useAuth } from '~/lib/auth'

// Local storage keys
const TEMPLATES_CACHE_KEY = 'rl_studio_templates_cache'
const TEMPLATES_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CachedTemplates {
  data: Template[]
  timestamp: number
}

function getCachedTemplates(): Template[] | null {
  try {
    const cached = localStorage.getItem(TEMPLATES_CACHE_KEY)
    if (!cached) return null
    
    const parsed: CachedTemplates = JSON.parse(cached)
    
    // Check if cache is still valid
    if (Date.now() - parsed.timestamp < TEMPLATES_CACHE_TTL) {
      return parsed.data
    }
    
    // Cache expired
    localStorage.removeItem(TEMPLATES_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function setCachedTemplates(templates: Template[]): void {
  try {
    const cache: CachedTemplates = {
      data: templates,
      timestamp: Date.now(),
    }
    localStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    console.warn('Failed to cache templates:', err)
  }
}

interface TemplateSelectorProps {
  onClose: () => void
  onSelect: (envSpec: EnvSpec) => void
  projectId?: string // Environment/project ID for instantiating templates
}

export function TemplateSelector({ onClose, onSelect, projectId }: TemplateSelectorProps) {
  const { user } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState<EnvironmentTemplate | null>(null)
  const [selectedBackendTemplate, setSelectedBackendTemplate] = useState<Template | null>(null)
  const [backendTemplates, setBackendTemplates] = useState<Template[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'templates' | 'assets'>('templates')

  // Load templates and assets from backend (with local caching)
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Load templates
        const cachedTemplates = getCachedTemplates()
        if (cachedTemplates && cachedTemplates.length > 0) {
          setBackendTemplates(cachedTemplates)
          console.log('Using cached templates:', cachedTemplates.length)
        } else {
          const templates = await listTemplates({ isPublic: true })
          console.log('Loaded templates from backend:', templates.length, templates)
          setCachedTemplates(templates)
          setBackendTemplates(templates)
        }
        
        // Load assets (all modes)
        try {
          const allAssets = await listAssets({})
          console.log('Loaded assets:', allAssets)
          
          // Ensure allAssets is an array
          const assetsArray = Array.isArray(allAssets) ? allAssets : []
          console.log('Assets array length:', assetsArray.length)
          
          // Filter to primary palette assets (or show all if none have palette set)
          const primaryAssets = assetsArray
            .filter((asset) => !asset.meta?.palette || asset.meta.palette === 'primary')
            .sort((a, b) => a.name.localeCompare(b.name))
          console.log('Filtered primary assets:', primaryAssets.length)
          setAssets(primaryAssets)
        } catch (err) {
          console.error('Failed to load assets:', err)
          // Don't set error for assets - it's not critical
          setAssets([])
        }
        
      } catch (err) {
        console.error('Failed to load data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
        
        // Try to use cached templates even if expired
        const cached = getCachedTemplates()
        if (cached && cached.length > 0) {
          setBackendTemplates(cached)
        }
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSelect = (template: EnvironmentTemplate) => {
    try {
      console.log('Selecting built-in template:', template.name, template)
      
      // Convert template spec to universal EnvSpec
      let envSpec: EnvSpec

      if (template.spec && template.spec.id && template.spec.world) {
        // Already in universal format
        envSpec = template.spec as EnvSpec
        console.log('Template already in universal format')
      } else {
        // Migrate from legacy format - template.spec is the legacy format
        console.log('Migrating template from legacy format', template.spec)
        
        // The template spec has visuals.grid, reward.rules, etc. at the root level
        // migrateFromLegacy expects them nested, so we need to restructure
        const legacyFormat = {
          ...template.spec,
          type: template.envType,
          name: template.name,
          // Ensure visuals.grid is accessible
          visuals: template.spec.visuals || {},
          reward: template.spec.reward || {},
          episode: template.spec.episode || {},
          metadata: template.spec.metadata || {},
        }
        
        envSpec = SceneGraphManager.migrateFromLegacy(legacyFormat)
        console.log('Migrated EnvSpec:', envSpec)
      }

      // Ensure name is set
      envSpec.name = template.name
      console.log('Final EnvSpec:', envSpec)

      onSelect(envSpec)
      onClose()
    } catch (err) {
      console.error('Error in handleSelect:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load template'
      setError(errorMessage)
      alert(`Failed to create from template: ${errorMessage}`)
    }
  }

  const handleSelectBackendTemplate = async (template: Template) => {
    try {
      console.log('Loading template:', template._id, template.name)
      setLoading(true)
      setError(null)
      
      // Load template data with scene version
      const templateData = await import('~/lib/templateClient').then(m => m.getTemplate(template._id))
      console.log('Template data loaded:', templateData)
      
      if (!templateData.sceneVersion) {
        throw new Error('Template does not have a scene version')
      }
      
      // Convert sceneGraph + rlConfig to EnvSpec using proper converter
      const { sceneGraphToEnvSpec } = await import('~/lib/sceneGraphToEnvSpec')
      const envSpec = sceneGraphToEnvSpec(
        templateData.sceneVersion.sceneGraph,
        templateData.sceneVersion.rlConfig,
        template.name
      )
      console.log('Converted to EnvSpec:', envSpec)

      onSelect(envSpec)
      onClose()
    } catch (err) {
      console.error('Failed to load template:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load template'
      setError(errorMessage)
      alert(`Failed to create from template: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl" style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Templates & Assets Library</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            📋 Templates ({backendTemplates.length + TEMPLATES.length})
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'assets'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            🎨 Assets ({assets.length})
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            )}

            {/* Backend Templates Section */}
            {backendTemplates.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">📚 Templates from Library ({backendTemplates.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {backendTemplates.map((template) => (
                    <div
                      key={template._id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedBackendTemplate?._id === template._id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedBackendTemplate(template)}
                      onDoubleClick={() => handleSelectBackendTemplate(template)}
                    >
                      <h3 className="font-semibold mb-2">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{template.description || 'No description'}</p>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex gap-1 flex-wrap">
                          {template.category && (
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              {template.category}
                            </span>
                          )}
                          {template.meta?.difficulty && (
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              {template.meta.difficulty}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              await handleSelectBackendTemplate(template)
                            } catch (err) {
                              console.error('Error in Use Template button:', err)
                            }
                          }}
                          disabled={loading}
                          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Loading...' : 'Use Template'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy Templates Section */}
            {TEMPLATES.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">🔧 Built-in Templates ({TEMPLATES.length})</h3>
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
                    try {
                      handleSelect(template)
                    } catch (err) {
                      console.error('Error in Use Template button (legacy):', err)
                      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
                    }
                  }}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                >
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
              </div>
            )}

            {!loading && backendTemplates.length === 0 && TEMPLATES.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No templates available
              </div>
            )}
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div>
            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading assets...
              </div>
            )}

            {assets.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">🎨 Available Assets ({assets.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {assets.map((asset) => {
                    const paletteColor = asset.meta?.paletteColor || '#9ca3af'
                    const labelColor = asset.meta?.labelColor || '#ffffff'
                    
                    return (
                      <div
                        key={asset._id}
                        className="border rounded-lg p-3 cursor-pointer transition-all border-border hover:border-primary/50 hover:bg-muted/50"
                        title={asset.name}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="inline-block w-4 h-4 rounded flex-shrink-0"
                            style={{ backgroundColor: paletteColor }}
                          />
                          <span className="font-medium text-sm truncate" style={{ color: labelColor === '#ffffff' ? undefined : labelColor }}>
                            {asset.name}
                          </span>
                        </div>
                        {asset.meta?.tags && asset.meta.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {asset.meta.tags.slice(0, 2).map((tag: string) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> Assets are automatically available in the Asset Palette when editing environments. Select them from the top of the canvas.
                </div>
              </div>
            )}

            {!loading && assets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No assets available. Assets will appear here once seeded.
              </div>
            )}
          </div>
        )}

        {/* Selection Preview (only for templates) */}
        {activeTab === 'templates' && (selectedTemplate || selectedBackendTemplate) && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">
              {selectedTemplate?.name || selectedBackendTemplate?.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {selectedTemplate?.description || selectedBackendTemplate?.description || 'No description'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    if (selectedTemplate) {
                      handleSelect(selectedTemplate)
                    } else if (selectedBackendTemplate) {
                      await handleSelectBackendTemplate(selectedBackendTemplate)
                    } else {
                      alert('Please select a template first')
                    }
                  } catch (err) {
                    console.error('Error in Create from Template button:', err)
                    alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
                  }
                }}
                disabled={loading || (!selectedTemplate && !selectedBackendTemplate)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Create from Template'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
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

