/**
 * Asset Palette Component - Loads and displays assets from Asset Service
 * Used by canvas components to show available assets for placement
 */

import { useState, useEffect } from 'react'
import { listAssets, type Asset } from '~/lib/assetClient'

// Local storage keys
const ASSETS_CACHE_KEY = 'rl_studio_assets_cache'
const ASSETS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes (short cache for development)

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

interface AssetPaletteProps {
  mode: string // 'grid', '2d', '3d', etc.
  selectedAssetId?: string
  onSelectAsset: (asset: Asset | null) => void
  projectId?: string
  className?: string
}

export function AssetPalette({
  mode,
  selectedAssetId,
  onSelectAsset,
  projectId,
  className = '',
}: AssetPaletteProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
                    return tags.includes(mode) || assetMode === mode || mode === 'grid'
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
        const loadedAssets = await listAssets({
          mode,
          projectId,
        })
        
        console.log('🔍 AssetPalette: Loaded assets from backend:', loadedAssets)
        
        // Check if loadedAssets is valid array
        if (!loadedAssets || !Array.isArray(loadedAssets)) {
          console.warn('⚠️ AssetPalette: Invalid assets response:', loadedAssets)
          setAssets([])
          return
        }
        
        console.log(`📦 AssetPalette: Total assets loaded: ${loadedAssets.length}`)
        
        // Filter assets by mode - be more lenient for grid mode
        const filteredAssets = loadedAssets
          .filter((asset) => {
            if (!asset || !asset.meta) {
              console.log('❌ AssetPalette: Skipping asset without meta:', asset?.name)
              return false
            }
            const tags = Array.isArray(asset.meta.tags) ? asset.meta.tags : []
            const assetMode = asset.meta.mode || ''
            
            // For grid mode, be very lenient - show anything with "grid" tag OR no mode restriction
            if (mode === 'grid') {
              const hasGridTag = tags.includes('grid')
              const hasGridMode = assetMode === 'grid'
              const hasNoMode = !assetMode // Show assets without mode restriction
              const result = hasGridTag || hasGridMode || hasNoMode
              if (!result) {
                console.log(`⏭️ AssetPalette: Skipping ${asset.name} - no grid tag/mode`)
              }
              return result
            }
            
            // For other modes, be strict
            return tags.includes(mode) || assetMode === mode
          })
          .sort((a, b) => {
            // Sort by category first, then name
            const aCategory = getAssetCategory(a)
            const bCategory = getAssetCategory(b)
            if (aCategory !== bCategory) {
              return aCategory.localeCompare(bCategory)
            }
            return a.name.localeCompare(b.name)
          })
        
        console.log(`✅ AssetPalette: Filtered to ${filteredAssets.length} assets for mode "${mode}"`)
        console.log('📋 AssetPalette: Assets:', filteredAssets.map(a => a.name))
        
        // Cache the results
        setCachedAssets(mode, filteredAssets)
        setAssets(filteredAssets)
      } catch (err) {
        console.error('Failed to load assets:', err)
        setError(err instanceof Error ? err.message : 'Failed to load assets')
        
        // Try to use cached assets even if expired
        const cached = getCachedAssets(mode)
        if (cached && cached.length > 0) {
          setAssets(cached)
        } else {
          setAssets([])
        }
      } finally {
        setLoading(false)
      }
    }

    loadAssets()
  }, [mode, projectId])

  // If no assets loaded, return null (components will use hardcoded palette)
  if (loading) {
    return (
      <div className={`p-2 border-b border-border ${className}`}>
        <div className="text-xs text-muted-foreground">Loading assets...</div>
      </div>
    )
  }

  if (error) {
    // Silently fail - components will use hardcoded palette
    return null
  }

  if (assets.length === 0) {
    // Show a message instead of returning null, so user knows what's happening
    return (
      <div className={`p-2 border-b border-border ${className}`}>
        <div className="text-xs text-muted-foreground">
          No assets loaded. Using fallback tools. Check console for errors.
        </div>
      </div>
    )
  }

  return (
    <div className={`p-2 border-b border-border ${className}`}>
      <div className="text-xs text-muted-foreground mb-2">
        Assets ({assets.length}): Click to select, then click grid to place
      </div>
      <div className="flex gap-2 flex-wrap">
        {assets.map((asset) => {
          const paletteColor = asset.meta?.paletteColor || asset.visualProfile?.color || '#9ca3af'
          const labelColor = asset.meta?.labelColor || '#ffffff'
          const isSelected = selectedAssetId === asset._id

          return (
            <button
              key={asset._id}
              onClick={() => {
                console.log('🎯 AssetPalette: Selected asset:', asset.name, asset)
                onSelectAsset(asset)
              }}
              className={`px-3 py-1 rounded text-sm border transition-all ${
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-md'
                  : 'border-border hover:bg-muted'
              }`}
              title={`${asset.name} - ${asset.meta?.tags?.join(', ') || 'no tags'}`}
            >
              <span
                className="inline-block w-3 h-3 rounded mr-2"
                style={{ backgroundColor: paletteColor }}
              />
              <span style={{ color: isSelected ? undefined : labelColor }}>
                {asset.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Helper to get asset category for sorting
 */
function getAssetCategory(asset: Asset): string {
  const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []
  const name = (asset.name || '').toLowerCase()
  
  if (tags.includes('agent') || name.includes('agent')) return '0_agents'
  if (tags.includes('tile') || name.includes('tile')) return '1_tiles'
  if (tags.includes('item') || name.includes('key') || name.includes('door') || name.includes('button') || name.includes('portal') || name.includes('pickup')) return '2_items'
  if (tags.includes('npc')) return '3_npcs'
  if (tags.includes('logic')) return '4_logic'
  return '5_other'
}

/**
 * Helper to get asset color for rendering
 */
export function getAssetColor(asset: Asset | null, fallback: string): string {
  if (!asset) return fallback
  return asset.meta?.paletteColor || asset.visualProfile?.color || fallback
}

/**
 * Helper to map asset to ObjectType for backward compatibility
 */
export function assetToObjectType(asset: Asset | null): string | null {
  if (!asset) return null
  
  // Try to infer from asset name or meta tags
  const name = (asset.name || '').toLowerCase()
  const tags = Array.isArray(asset.meta?.tags) ? asset.meta.tags : []
  
  // Common mappings
  if (name.includes('wall') || tags.includes('wall')) return 'wall'
  if (name.includes('agent') || tags.includes('agent')) return 'agent'
  if (name.includes('goal') || tags.includes('goal')) return 'goal'
  if (name.includes('obstacle') || tags.includes('obstacle')) return 'obstacle'
  if (name.includes('trap') || tags.includes('trap')) return 'trap'
  if (name.includes('key') || tags.includes('key')) return 'key'
  if (name.includes('door') || tags.includes('door')) return 'door'
  if (name.includes('checkpoint') || tags.includes('checkpoint')) return 'checkpoint'
  
  return 'custom'
}

