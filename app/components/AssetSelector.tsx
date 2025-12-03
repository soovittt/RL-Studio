/**
 * Asset Selector Modal - Browse and select assets for placement
 * Similar to TemplateSelector but for assets
 */

import { useState, useEffect } from 'react'
import { listAssets, type Asset } from '~/lib/assetClient'

// Local storage keys
const ASSETS_CACHE_KEY = 'rl_studio_assets_cache'
const ASSETS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

interface CachedAssets {
  data: Asset[]
  timestamp: number
  mode: string
}

function getCachedAssets(mode: string): Asset[] | null {
  try {
    const cached = localStorage.getItem(ASSETS_CACHE_KEY)
    if (!cached) return null

    const parsed: CachedAssets = JSON.parse(cached)

    // Check if cache is still valid and matches mode
    if (Date.now() - parsed.timestamp < ASSETS_CACHE_TTL && parsed.mode === mode) {
      return parsed.data
    }

    // Cache expired or mode changed
    localStorage.removeItem(ASSETS_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

function setCachedAssets(mode: string, assets: Asset[]): void {
  try {
    const cache: CachedAssets = {
      data: assets,
      timestamp: Date.now(),
      mode,
    }
    localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    console.warn('Failed to cache assets:', err)
  }
}

/**
 * Helper to get asset category for sorting
 */
function getAssetCategory(asset: Asset): string {
  const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []
  const assetType = asset.assetTypeKey || ''

  // Priority order for categories
  if (tags.includes('agent') || assetType === 'agent') return '1_Agents'
  if (tags.includes('tile') || assetType === 'tile') return '2_Tiles'
  if (tags.includes('item') || assetType === 'item') return '3_Items'
  if (tags.includes('npc') || assetType === 'npc') return '4_NPCs'
  if (tags.includes('logic') || assetType === 'logic') return '5_Logic'
  return '6_Other'
}

interface AssetSelectorProps {
  onClose: () => void
  onSelect: (asset: Asset) => void
  mode?: string // 'grid', '2d', '3d', etc.
  projectId?: string
  selectedAssetId?: string
}

export function AssetSelector({
  onClose,
  onSelect,
  mode = 'grid',
  projectId,
  selectedAssetId,
}: AssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Load assets from backend (with local caching)
  useEffect(() => {
    async function loadAssets() {
      try {
        setLoading(true)
        setError(null)

        // Try to load from cache first
        const cached = getCachedAssets(mode)
        if (cached && cached.length > 0) {
          setAssets(cached)
          setLoading(false)

          // Still fetch in background to update cache
          listAssets({ mode, projectId })
            .then((loadedAssets) => {
              if (loadedAssets && Array.isArray(loadedAssets)) {
                const filteredAssets = loadedAssets
                  .filter((asset) => {
                    if (!asset || !asset.meta) return false
                    const tags = Array.isArray(asset.meta.tags) ? asset.meta.tags : []
                    const assetMode = asset.meta.mode || ''
                    // For grid mode, be lenient - include assets with grid tag or no mode restriction
                    if (mode === 'grid') {
                      return tags.includes('grid') || assetMode === 'grid' || !assetMode
                    }
                    return tags.includes(mode) || assetMode === mode
                  })
                  .sort((a, b) => {
                    const aCategory = getAssetCategory(a)
                    const bCategory = getAssetCategory(b)
                    if (aCategory !== bCategory) {
                      return aCategory.localeCompare(bCategory)
                    }
                    return a.name.localeCompare(b.name)
                  })
                setCachedAssets(mode, filteredAssets)
                setAssets(filteredAssets)
              }
            })
            .catch(() => {
              // Ignore background fetch errors
            })
          return
        }

        // Load from backend
        const loadedAssets = await listAssets({ mode, projectId })

        if (!loadedAssets || !Array.isArray(loadedAssets)) {
          console.warn('⚠️ AssetSelector: Invalid assets response:', loadedAssets)
          setAssets([])
          setLoading(false)
          return
        }

        console.log(`📦 AssetSelector: Total assets loaded: ${loadedAssets.length}`)

        // Filter assets based on mode
        const filteredAssets = loadedAssets
          .filter((asset) => {
            if (!asset || !asset.meta) {
              console.log('❌ AssetSelector: Skipping asset without meta:', asset?.name)
              return false
            }

            const tags = Array.isArray(asset.meta.tags) ? asset.meta.tags : []
            const assetMode = asset.meta.mode || ''

            // For grid mode, be lenient - include assets with grid tag or no mode restriction
            if (mode === 'grid') {
              return tags.includes('grid') || assetMode === 'grid' || !assetMode
            }

            return tags.includes(mode) || assetMode === mode
          })
          .sort((a, b) => {
            const aCategory = getAssetCategory(a)
            const bCategory = getAssetCategory(b)
            if (aCategory !== bCategory) {
              return aCategory.localeCompare(bCategory)
            }
            return a.name.localeCompare(b.name)
          })

        console.log(
          `✅ AssetSelector: Filtered to ${filteredAssets.length} assets for mode "${mode}"`
        )

        setCachedAssets(mode, filteredAssets)
        setAssets(filteredAssets)
      } catch (err) {
        console.error('❌ AssetSelector: Failed to load assets:', err)
        setError(err instanceof Error ? err.message : 'Failed to load assets')
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    loadAssets()
  }, [mode, projectId])

  // Get unique categories from assets
  const categories = Array.from(new Set(assets.map((asset) => getAssetCategory(asset)))).sort()

  // Filter assets by search query and category
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.meta?.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      selectedCategory === null || getAssetCategory(asset) === selectedCategory

    return matchesSearch && matchesCategory
  })

  // Group assets by category
  const assetsByCategory = filteredAssets.reduce(
    (acc, asset) => {
      const category = getAssetCategory(asset)
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(asset)
      return acc
    },
    {} as Record<string, Asset[]>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className="rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Select Asset</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-3">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 text-xs rounded border transition-all ${
                selectedCategory === null
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-xs rounded border transition-all ${
                  selectedCategory === category
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {category.replace(/^\d+_/, '')}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading assets...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-destructive">Error: {error}</div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">
                {searchQuery || selectedCategory
                  ? 'No assets match your filters'
                  : 'No assets available'}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(assetsByCategory).map(([category, categoryAssets]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    {category.replace(/^\d+_/, '')} ({categoryAssets.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {categoryAssets.map((asset) => {
                      const paletteColor =
                        asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
                      const isSelected = selectedAssetId === asset._id
                      const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []

                      return (
                        <button
                          key={asset._id}
                          onClick={() => {
                            onSelect(asset)
                            onClose()
                          }}
                          className={`p-3 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                          title={asset.description || asset.name}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: paletteColor }}
                            />
                            <span className="font-medium text-sm truncate flex-1">
                              {asset.name}
                            </span>
                          </div>
                          {asset.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {asset.description}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-xs px-1.5 py-0.5 bg-muted rounded">
                                  {tag}
                                </span>
                              ))}
                              {tags.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Click an asset to select it and start placing it on the grid.
          </div>
        </div>
      </div>
    </div>
  )
}
