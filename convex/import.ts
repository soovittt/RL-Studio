import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { action } from './_generated/server'

// Legacy endpoint - maintained for backward compatibility
// Enhanced version available in firecrawl.ts
export const fromPaper = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    try {
      // Use enhanced import via internal call
      // Note: This requires the firecrawl actions to be available
      // For now, we'll use the basic implementation and enhance it
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
      if (!firecrawlApiKey) {
        throw new Error('Firecrawl API key not configured')
      }

      // Enhanced scraping with better extraction
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({
          url: args.url,
          formats: ['markdown', 'html'],
          includeImages: true,
        }),
      })

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.data?.markdown || data.data?.text || ''

      // Enhanced extraction (simplified version of parser logic)
      const lowerContent = content.toLowerCase()
      const envType =
        lowerContent.includes('continuous') || lowerContent.includes('physics')
          ? 'continuous2d'
          : 'grid'

      // Extract dimensions
      const dimMatch = content.match(/(\d+)\s*[x×]\s*(\d+)/i)
      const width = dimMatch ? parseInt(dimMatch[1]) : envType === 'grid' ? 10 : 20
      const height = dimMatch ? parseInt(dimMatch[2]) : envType === 'grid' ? 10 : 20

      // Extract rewards
      const rewards: any[] = []
      if (lowerContent.includes('goal') && lowerContent.includes('reward')) {
        rewards.push({ condition: 'agent_at_object', value: 10 })
      }
      if (lowerContent.includes('step') && lowerContent.includes('penalty')) {
        rewards.push({ condition: 'timeout', value: -0.1 })
      }

      // Extract terminations
      const terminations: any[] = []
      if (lowerContent.includes('terminat') || lowerContent.includes('max step')) {
        const stepMatch = content.match(/max[_\s]?steps?[:\s=]+(\d+)/i)
        terminations.push({
          condition: 'timeout',
          steps: stepMatch ? parseInt(stepMatch[1]) : 100,
        })
      }

      const enhancedResult = {
        success: true,
        extracted: {
          envType,
          name: 'Imported Environment',
          description: content.substring(0, 500),
          world: { width, height, coordinateSystem: envType === 'grid' ? 'grid' : 'cartesian' },
          rewards,
          terminations,
        },
        rawContent: content.substring(0, 2000),
      }

      // Return in legacy format for backward compatibility
      return {
        type: enhancedResult.extracted.envType === 'continuous2d' ? 'continuous' : 'grid',
        summary:
          enhancedResult.extracted.description || enhancedResult.rawContent.substring(0, 500),
        extracted: {
          envType: enhancedResult.extracted.envType === 'continuous2d' ? 'continuous' : 'grid',
          hasRewards: (enhancedResult.extracted.rewards?.length || 0) > 0,
          hasTermination: (enhancedResult.extracted.terminations?.length || 0) > 0,
        },
        // Include new data for enhanced components
        enhanced: enhancedResult,
      }
    } catch (error) {
      // Fallback to simple extraction if enhanced fails
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
      if (!firecrawlApiKey) {
        throw new Error('Firecrawl API key not configured')
      }

      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({
          url: args.url,
          formats: ['markdown'],
        }),
      })

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.data?.markdown || ''

      const envType = content.toLowerCase().includes('continuous') ? 'continuous' : 'grid'
      const finalType = envType === 'continuous' ? 'continuous' : 'grid'

      return {
        type: finalType,
        summary: content.substring(0, 500),
        extracted: {
          envType: finalType,
          hasRewards: content.toLowerCase().includes('reward'),
          hasTermination: content.toLowerCase().includes('terminat'),
        },
      }
    }
  },
})
