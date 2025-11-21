/**
 * Asset Palette Component - Loads and displays assets from Asset Service
 * Used by canvas components to show available assets for placement
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
                const primaryAssets = loadedAssets
                  .filter((asset) => asset && asset.meta?.palette === 'primary')
                  .sort((a, b) => a.name.localeCompare(b.name))
                setCachedAssets(mode, primaryAssets)
                setAssets(primaryAssets)
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
        
        // Check if loadedAssets is valid array
        if (!loadedAssets || !Array.isArray(loadedAssets)) {
          setAssets([])
          return
        }
        
        // Filter to primary palette assets (those with meta.palette === 'primary')
        // and sort by name
        const primaryAssets = loadedAssets
          .filter((asset) => asset && asset.meta?.palette === 'primary')
          .sort((a, b) => a.name.localeCompare(b.name))
        
        // Cache the results
        setCachedAssets(mode, primaryAssets)
        setAssets(primaryAssets)
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
    // No assets from backend - components will use hardcoded palette
    return null
  }

  return (
    <div className={`p-2 border-b border-border flex gap-2 flex-wrap ${className}`}>
      {assets.map((asset) => {
        const paletteColor = asset.meta?.paletteColor || '#9ca3af'
        const labelColor = asset.meta?.labelColor || '#ffffff'
        const isSelected = selectedAssetId === asset._id

        return (
          <button
            key={asset._id}
            onClick={() => onSelectAsset(asset)}
            className={`px-3 py-1 rounded text-sm border transition-all ${
              isSelected
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'border-border hover:bg-muted'
            }`}
            title={asset.name}
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
  )
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

