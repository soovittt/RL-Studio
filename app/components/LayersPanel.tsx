// LayersPanel - Figma-style layers panel for assets and scene objects
import { useState, useEffect, useRef } from 'react'
import type { Asset } from '~/lib/assetClient'
import type { EnvSpec, ObjectSpec } from '~/lib/envSpec'
import { assetToObjectType } from './AssetPalette'

interface LayersPanelProps {
  envSpec: EnvSpec
  selectedAssetId?: string
  onSelectAsset: (asset: Asset | null) => void
  selectedObjectId?: string
  onSelectObject: (objectId: string | null) => void
}

// Category definitions with icons and descriptions
const CATEGORIES = [
  { id: 'all', label: 'All Assets', icon: '📦' },
  { id: 'agents', label: 'Agents', icon: '🤖', description: 'Learning agents and players' },
  { id: 'tiles', label: 'Tiles', icon: '🧱', description: 'Floor, walls, and base tiles' },
  { id: 'items', label: 'Items', icon: '🔑', description: 'Keys, doors, pickups' },
  { id: 'npcs', label: 'NPCs', icon: '👤', description: 'Non-player characters' },
  { id: 'props', label: 'Props', icon: '🎨', description: 'Interactive objects' },
  { id: 'logic', label: 'Logic', icon: '⚙️', description: 'Triggers and invisible logic' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

export function LayersPanel({
  envSpec,
  selectedAssetId,
  onSelectAsset,
  selectedObjectId,
  onSelectObject,
}: LayersPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [activeContentTab, setActiveContentTab] = useState<'assets' | 'layers'>('assets')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showCategoryDropdown])

  // Load assets
  useEffect(() => {
    async function loadAssets() {
      try {
        console.log('📦 LayersPanel: Loading assets...')
        const { listAssets } = await import('~/lib/assetClient')
        const loadedAssets = await listAssets({ mode: 'grid' })
        console.log('📦 LayersPanel: Loaded assets from API:', loadedAssets)

        if (Array.isArray(loadedAssets)) {
          // More lenient filtering - show all assets that might be useful for grid
          const gridAssets = loadedAssets.filter((asset) => {
            if (!asset) return false
            // If no meta, still include it (might be valid)
            if (!asset.meta) {
              console.log('⚠️ LayersPanel: Asset without meta, including:', asset.name)
              return true
            }
            const tags = Array.isArray(asset.meta.tags) ? asset.meta.tags : []
            const assetMode = asset.meta.mode || ''
            // Very lenient: include if has grid tag, grid mode, OR no mode restriction
            const result =
              tags.includes('grid') || assetMode === 'grid' || !assetMode || tags.length === 0
            if (!result) {
              console.log(
                `⏭️ LayersPanel: Skipping ${asset.name} - tags: ${tags.join(', ')}, mode: ${assetMode}`
              )
            }
            return result
          })
          console.log(`✅ LayersPanel: Filtered to ${gridAssets.length} grid assets`)
          setAssets(gridAssets.sort((a, b) => a.name.localeCompare(b.name)))
        } else {
          console.warn('⚠️ LayersPanel: Assets not loaded as array:', loadedAssets)
          setAssets([])
        }
      } catch (err) {
        console.error('❌ LayersPanel: Failed to load assets:', err)
        setAssets([])
      }
    }
    loadAssets()
  }, [])

  // Helper to get asset category
  const getAssetCategory = (asset: Asset): CategoryId => {
    const assetTypeName = asset.assetType?.name?.toLowerCase() || ''
    const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []
    const name = (asset.name || '').toLowerCase()

    if (
      tags.includes('agent') ||
      name.includes('agent') ||
      assetTypeName === 'agent' ||
      assetTypeName === 'character'
    ) {
      return 'agents'
    }
    if (
      tags.includes('tile') ||
      name.includes('tile') ||
      name.includes('wall') ||
      name.includes('floor') ||
      assetTypeName === 'tile'
    ) {
      return 'tiles'
    }
    if (
      tags.includes('item') ||
      name.includes('key') ||
      name.includes('door') ||
      name.includes('button') ||
      name.includes('portal') ||
      name.includes('pickup') ||
      assetTypeName === 'item'
    ) {
      return 'items'
    }
    if (tags.includes('npc') || assetTypeName === 'npc') {
      return 'npcs'
    }
    if (
      tags.includes('logic') ||
      name.includes('trigger') ||
      name.includes('zone') ||
      assetTypeName === 'logic'
    ) {
      return 'logic'
    }
    if (tags.includes('prop') || assetTypeName === 'prop') {
      return 'props'
    }
    return 'all'
  }

  // Categorize assets
  const categorizedAssets: Record<CategoryId, Asset[]> = {
    all: assets,
    agents: assets.filter((a) => getAssetCategory(a) === 'agents'),
    tiles: assets.filter((a) => getAssetCategory(a) === 'tiles'),
    items: assets.filter((a) => getAssetCategory(a) === 'items'),
    npcs: assets.filter((a) => getAssetCategory(a) === 'npcs'),
    props: assets.filter((a) => getAssetCategory(a) === 'props'),
    logic: assets.filter((a) => getAssetCategory(a) === 'logic'),
  }

  const filteredAssets = (categorizedAssets[selectedCategory] || assets).filter((asset) =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCategoryInfo = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0]

  // Get scene objects with layer info
  const sceneObjects = (envSpec.objects || []).map((obj, index) => ({
    id: obj.id,
    name: obj.type || 'Object',
    type: obj.type,
    layer: index, // Layer order (0 = bottom, higher = top)
    position: obj.position,
  }))

  const sceneAgents = (envSpec.agents || []).map((agent, index) => ({
    id: agent.id,
    name: 'Agent',
    type: 'agent',
    layer: (envSpec.objects?.length || 0) + index,
    position: agent.position,
  }))

  const allSceneItems = [...sceneObjects, ...sceneAgents].sort((a, b) => b.layer - a.layer) // Top to bottom

  return (
    <div className="h-full flex flex-col" style={{ pointerEvents: 'auto' }}>
      {/* Search */}
      <div className="p-2 border-b border-border">
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Category Dropdown */}
      <div className="p-2 border-b border-border">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowCategoryDropdown(!showCategoryDropdown)
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded bg-background hover:bg-muted transition-colors"
            type="button"
          >
            <div className="flex items-center gap-2">
              <span>{selectedCategoryInfo.icon}</span>
              <span className="font-medium">{selectedCategoryInfo.label}</span>
              {selectedCategoryInfo.description && (
                <span className="text-xs text-muted-foreground">
                  ({categorizedAssets[selectedCategory]?.length || 0})
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showCategoryDropdown && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded shadow-lg z-[100] max-h-64 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {CATEGORIES.map((category) => {
                const count = categorizedAssets[category.id]?.length || 0
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id)
                      setShowCategoryDropdown(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span>{category.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{category.label}</div>
                        {category.description && (
                          <div className="text-xs opacity-70">{category.description}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs opacity-70 ml-2">{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveContentTab('assets')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeContentTab === 'assets'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Assets
        </button>
        <button
          onClick={() => setActiveContentTab('layers')}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeContentTab === 'layers'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Layers ({allSceneItems.length})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activeContentTab === 'assets' ? (
          /* Assets List */
          <div className="p-2">
            {filteredAssets.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2 text-center">
                {searchQuery
                  ? 'No assets match your search'
                  : `No ${selectedCategoryInfo.label.toLowerCase()} found`}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset._id
                  const color = asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
                  const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []
                  const assetType = asset.assetType?.name || 'Unknown'

                  return (
                    <button
                      key={asset._id}
                      onClick={() => onSelectAsset(isSelected ? null : asset)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'hover:bg-muted'
                      }`}
                      title={`${asset.name} (${assetType})${tags.length > 0 ? ` - ${tags.join(', ')}` : ''}`}
                    >
                      <span
                        className="w-4 h-4 rounded flex-shrink-0 border border-border/20"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{asset.name}</div>
                        {assetType !== 'Unknown' && (
                          <div className="text-xs opacity-60 truncate">{assetType}</div>
                        )}
                      </div>
                      {isSelected && <span className="text-xs opacity-70 flex-shrink-0">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* Scene Layers List */
          <div className="p-2">
            {allSceneItems.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2 text-center">
                No objects or agents in the scene yet. Place assets to see them here.
              </div>
            ) : (
              <div className="space-y-1">
                {allSceneItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectObject(selectedObjectId === item.id ? null : item.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded text-left text-sm transition-colors ${
                      selectedObjectId === item.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted'
                    }`}
                    title={`Layer ${item.layer}: ${item.name} at (${item.position?.[0]?.toFixed(1)}, ${item.position?.[1]?.toFixed(1)})`}
                  >
                    <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0">
                      L{item.layer}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs opacity-60 truncate">{item.type}</div>
                    </div>
                    {selectedObjectId === item.id && (
                      <span className="text-xs opacity-70 flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
