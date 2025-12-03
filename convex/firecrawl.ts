/**
 * Enhanced Firecrawl Integration Service
 * Provides comprehensive content extraction and environment generation capabilities
 */

import { action } from './_generated/server'
import { v } from 'convex/values'

// Firecrawl API types
interface FirecrawlScrapeResponse {
  success: boolean
  data?: {
    markdown?: string
    html?: string
    text?: string
    images?: Array<{ url: string; alt?: string }>
    links?: Array<{ url: string; text?: string }>
  }
  error?: string
}

interface FirecrawlSearchResponse {
  success: boolean
  data?: Array<{
    url: string
    title?: string
    description?: string
    content?: string
  }>
  error?: string
}

// Environment extraction types
export interface ExtractedEnvironment {
  envType: 'grid' | 'continuous2d' | 'custom2d'
  name: string
  description?: string
  world?: {
    width?: number
    height?: number
    coordinateSystem?: 'grid' | 'cartesian'
  }
  objects?: Array<{
    type: string
    position?: [number, number]
    properties?: Record<string, any>
  }>
  agents?: Array<{
    name?: string
    position?: [number, number]
  }>
  actionSpace?: {
    type: 'discrete' | 'continuous'
    actions?: string[]
    dimensions?: number
  }
  rewards?: Array<{
    condition: string
    value: number
    description?: string
  }>
  terminations?: Array<{
    condition: string
    description?: string
  }>
  metadata?: {
    source?: string
    tags?: string[]
    notes?: string
  }
}

/**
 * Enhanced Firecrawl client with all API methods
 */
class FirecrawlService {
  private apiKey: string
  private baseUrl = 'https://api.firecrawl.dev/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async scrape(
    url: string,
    options?: { formats?: string[]; includeImages?: boolean }
  ): Promise<FirecrawlScrapeResponse> {
    try {
      // Firecrawl API v1 format - only 'url' is required
      // The 'formats' and 'includeImages' parameters are not recognized by v1 API
      // Firecrawl returns markdown by default
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        // Try to get detailed error message from response body
        let errorMessage = `Firecrawl API error: ${response.status} ${response.statusText}`
        let errorDetails = ''
        try {
          const errorText = await response.text()
          errorDetails = errorText
          try {
            const errorData = JSON.parse(errorText)
            if (errorData.error) {
              errorMessage = `Firecrawl API error: ${errorData.error}`
            } else if (errorData.message) {
              errorMessage = `Firecrawl API error: ${errorData.message}`
            } else if (errorData.details) {
              errorMessage = `Firecrawl API error: ${errorData.details}`
            }
          } catch {
            // If not JSON, use the text as error message
            if (errorText) {
              errorMessage = `Firecrawl API error: ${errorText.substring(0, 200)}`
            }
          }
        } catch {
          // If reading response fails, use status text
        }
        const fullError = `${errorMessage}${errorDetails ? ` (Details: ${errorDetails.substring(0, 100)})` : ''}`
        throw new Error(fullError)
      }

      const result = await response.json()

      // Check if Firecrawl returned an error in the response body
      if (result.error) {
        throw new Error(`Firecrawl error: ${result.error}`)
      }

      return result
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Firecrawl scrape failed: ${String(error)}`)
    }
  }

  async search(
    query: string,
    options?: { limit?: number; sites?: string[] }
  ): Promise<FirecrawlSearchResponse> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        limit: options?.limit || 10,
        sites: options?.sites,
      }),
    })

    if (!response.ok) {
      throw new Error(`Firecrawl search error: ${response.statusText}`)
    }

    return await response.json()
  }

  async crawl(
    url: string,
    options?: { maxDepth?: number; includeSubdomains?: boolean }
  ): Promise<FirecrawlScrapeResponse> {
    const response = await fetch(`${this.baseUrl}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url,
        maxDepth: options?.maxDepth || 1,
        includeSubdomains: options?.includeSubdomains ?? false,
      }),
    })

    if (!response.ok) {
      throw new Error(`Firecrawl crawl error: ${response.statusText}`)
    }

    return await response.json()
  }
}

/**
 * Intelligent Environment Parser
 * Extracts structured environment data from text content
 */
class EnvironmentParser {
  parse(content: string, sourceUrl?: string): ExtractedEnvironment {
    const lowerContent = content.toLowerCase()

    // Detect environment type
    const envType = this.detectEnvType(lowerContent)

    // Extract name
    const name = this.extractName(content, sourceUrl)

    // Extract world dimensions
    const world = this.extractWorldDimensions(content, envType)

    // Extract objects and layout
    const objects = this.extractObjects(content, envType)

    // Extract agents
    const agents = this.extractAgents(content)

    // Extract action space
    const actionSpace = this.extractActionSpace(content)

    // Extract reward rules
    const rewards = this.extractRewards(content)

    // Extract termination conditions
    const terminations = this.extractTerminations(content)

    // Extract metadata
    const metadata = this.extractMetadata(content, sourceUrl)

    return {
      envType,
      name,
      description: this.extractDescription(content),
      world,
      objects,
      agents,
      actionSpace,
      rewards,
      terminations,
      metadata,
    }
  }

  private detectEnvType(content: string): 'grid' | 'continuous2d' | 'custom2d' {
    // Grid indicators
    if (content.match(/\b(grid|maze|discrete|cell|tile)\b/)) {
      return 'grid'
    }

    // Continuous indicators
    if (content.match(/\b(continuous|physics|velocity|acceleration|force)\b/)) {
      return 'continuous2d'
    }

    // Default to grid for most RL environments
    return 'grid'
  }

  private extractName(content: string, url?: string): string {
    // Try to extract from title/heading
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/<title>(.+?)<\/title>/i)
    if (titleMatch) {
      return titleMatch[1].trim().substring(0, 100)
    }

    // Try to extract from URL
    if (url) {
      const urlMatch = url.match(/\/([^\/]+?)(?:\.(?:html|md))?$/i)
      if (urlMatch) {
        return urlMatch[1].replace(/[-_]/g, ' ').trim()
      }
    }

    return 'Imported Environment'
  }

  private extractWorldDimensions(
    content: string,
    envType: string
  ): { width?: number; height?: number; coordinateSystem?: 'grid' | 'cartesian' } {
    // Look for dimension patterns
    const dimMatch =
      content.match(/(\d+)\s*[x×]\s*(\d+)/i) ||
      content.match(/size[:\s]+(\d+)[,\s]+(\d+)/i) ||
      content.match(/grid[:\s]+(\d+)[,\s]+(\d+)/i)

    if (dimMatch) {
      return {
        width: parseInt(dimMatch[1]),
        height: parseInt(dimMatch[2]),
        coordinateSystem: envType === 'grid' ? 'grid' : 'cartesian',
      }
    }

    // Default dimensions
    return {
      width: envType === 'grid' ? 10 : 20,
      height: envType === 'grid' ? 10 : 20,
      coordinateSystem: envType === 'grid' ? 'grid' : 'cartesian',
    }
  }

  private extractObjects(
    content: string,
    envType: string
  ): Array<{ type: string; position?: [number, number]; properties?: Record<string, any> }> {
    const objects: Array<{
      type: string
      position?: [number, number]
      properties?: Record<string, any>
    }> = []

    // Look for ASCII grid patterns (improved)
    const asciiGrid =
      content.match(/```[\s\S]*?```/g) ||
      content.match(/(?:^|\n)[#\sSGOTKDL]+(?:\n[#\sSGOTKDL]+)+/gm)
    if (asciiGrid) {
      for (const grid of asciiGrid) {
        const lines = grid.split('\n').filter((line) => line.trim().length > 0)
        let startY = 0
        for (let y = 0; y < lines.length; y++) {
          const line = lines[y].trim()
          for (let x = 0; x < line.length; x++) {
            const char = line[x]
            if (char === '#' || char === 'W' || char === '█' || char === '▓') {
              objects.push({ type: 'wall', position: [x, y + startY] })
            } else if (char === 'G' || char === 'g' || char === '★' || char === '🎯') {
              objects.push({ type: 'goal', position: [x, y + startY] })
            } else if (
              char === 'S' ||
              char === 's' ||
              char === 'A' ||
              char === 'a' ||
              char === '🤖'
            ) {
              objects.push({ type: 'agent', position: [x, y + startY] })
            } else if (
              char === 'O' ||
              char === 'o' ||
              char === 'X' ||
              char === 'x' ||
              char === '■'
            ) {
              objects.push({ type: 'obstacle', position: [x, y + startY] })
            } else if (char === 'T' || char === 't' || char === '💀') {
              objects.push({ type: 'trap', position: [x, y + startY] })
            } else if (char === 'K' || char === 'k' || char === '🔑') {
              objects.push({ type: 'key', position: [x, y + startY] })
            } else if (char === 'D' || char === 'd' || char === '🚪') {
              objects.push({ type: 'door', position: [x, y + startY] })
            } else if (char === 'C' || char === 'c' || char === '✓') {
              objects.push({ type: 'checkpoint', position: [x, y + startY] })
            }
          }
        }
      }
    }

    // Look for explicit object definitions (improved patterns)
    const objectPatterns = [
      /(?:wall|obstacle|barrier)[:\s]+(?:position|at|located|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
      /(?:goal|target|destination)[:\s]+(?:position|at|located|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
      /(?:agent|player|robot)[:\s]+(?:position|start|spawn|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
      /(?:trap|hazard|danger)[:\s]+(?:position|at|located|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
      /(?:key|item)[:\s]+(?:position|at|located|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
      /(?:door|gate)[:\s]+(?:position|at|located|pos)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi,
    ]

    const typeMap: Record<number, string> = {
      0: 'wall',
      1: 'goal',
      2: 'agent',
      3: 'trap',
      4: 'key',
      5: 'door',
    }

    objectPatterns.forEach((pattern, idx) => {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        objects.push({
          type: typeMap[idx] || 'custom',
          position: [parseInt(match[1]), parseInt(match[2])],
        })
      }
    })

    // Look for list-style object definitions
    const listPattern = /(?:objects?|entities?|items?)[:\s]*\n((?:[-*]\s*.+\n?)+)/gi
    const listMatch = content.match(listPattern)
    if (listMatch) {
      for (const list of listMatch) {
        const items = list.match(/[-*]\s*(\w+)[:\s]+(?:position|at)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/gi)
        if (items) {
          for (const item of items) {
            const itemMatch = item.match(/(\w+)[:\s]+(?:position|at)[:\s]*\(?(\d+)[,\s]+(\d+)\)?/i)
            if (itemMatch) {
              objects.push({
                type: itemMatch[1].toLowerCase(),
                position: [parseInt(itemMatch[2]), parseInt(itemMatch[3])],
              })
            }
          }
        }
      }
    }

    return objects
  }

  private extractAgents(content: string): Array<{ name?: string; position?: [number, number] }> {
    const agents: Array<{ name?: string; position?: [number, number] }> = []

    // Look for agent definitions
    const agentMatches = Array.from(
      content.matchAll(
        /(?:agent|player|robot)[:\s]+(?:position|start|spawn)[:\s]+\(?(\d+)[,\s]+(\d+)\)?/gi
      )
    )
    for (const match of agentMatches) {
      agents.push({
        position: [parseInt(match[1]), parseInt(match[2])],
      })
    }

    // Default agent if none found
    if (agents.length === 0) {
      agents.push({ position: [0, 0] })
    }

    return agents
  }

  private extractActionSpace(
    content: string
  ): { type: 'discrete' | 'continuous'; actions?: string[]; dimensions?: number } | undefined {
    const lowerContent = content.toLowerCase()

    // Discrete actions
    if (
      lowerContent.match(/\b(discrete|action space|up|down|left|right|north|south|east|west)\b/)
    ) {
      const actions: string[] = []
      if (lowerContent.includes('up') || lowerContent.includes('north')) actions.push('up')
      if (lowerContent.includes('down') || lowerContent.includes('south')) actions.push('down')
      if (lowerContent.includes('left') || lowerContent.includes('west')) actions.push('left')
      if (lowerContent.includes('right') || lowerContent.includes('east')) actions.push('right')

      return {
        type: 'discrete',
        actions: actions.length > 0 ? actions : ['up', 'down', 'left', 'right'],
      }
    }

    // Continuous actions
    if (lowerContent.match(/\b(continuous|velocity|force|torque|control)\b/)) {
      return {
        type: 'continuous',
        dimensions: 2,
      }
    }

    return undefined
  }

  extractRewards(
    content: string
  ): Array<{ condition: string; value: number; description?: string }> {
    const rewards: Array<{ condition: string; value: number; description?: string }> = []
    const lowerContent = content.toLowerCase()

    // Look for reward patterns (improved)
    const rewardPatterns = [
      /(?:reward|r\(s\)|r\(s,a\))[:\s=]+([+-]?\d+(?:\.\d+)?)/gi,
      /reward[:\s]+([+-]?\d+(?:\.\d+)?)\s*(?:for|when|if)/gi,
      /(?:positive|negative)\s+reward[:\s]+([+-]?\d+(?:\.\d+)?)/gi,
    ]

    rewardPatterns.forEach((pattern) => {
      const matches = Array.from(content.matchAll(pattern))
      for (const match of matches) {
        const value = parseFloat(match[1])
        const context = match[0].toLowerCase()
        let condition = 'custom'
        let description = match[0]

        if (context.includes('goal') || context.includes('target')) {
          condition = 'agent_at_object'
          description = 'Reward for reaching goal'
        } else if (context.includes('step') || context.includes('time')) {
          condition = 'timeout'
          description = 'Step/time penalty'
        } else if (context.includes('collision') || context.includes('hit')) {
          condition = 'collision'
          description = 'Collision penalty'
        }

        rewards.push({ condition, value, description })
      }
    })

    // Look for goal reward (improved detection)
    if (
      (lowerContent.includes('goal') || lowerContent.includes('target')) &&
      (lowerContent.includes('reward') ||
        lowerContent.includes('+10') ||
        lowerContent.includes('+1'))
    ) {
      const goalRewardMatch = content.match(/goal[^\d]*([+-]?\d+(?:\.\d+)?)/i)
      rewards.push({
        condition: 'agent_at_object',
        value: goalRewardMatch ? parseFloat(goalRewardMatch[1]) : 10,
        description: 'Reward for reaching goal',
      })
    }

    // Look for step penalty (improved detection)
    if (
      lowerContent.includes('step') &&
      (lowerContent.includes('penalty') ||
        lowerContent.includes('-0.1') ||
        lowerContent.includes('-0.01'))
    ) {
      const stepPenaltyMatch = content.match(/step[^\d]*([+-]?\d+(?:\.\d+)?)/i)
      rewards.push({
        condition: 'timeout',
        value: stepPenaltyMatch ? parseFloat(stepPenaltyMatch[1]) : -0.1,
        description: 'Step penalty to encourage efficiency',
      })
    }

    // Look for sparse vs dense reward mentions
    if (lowerContent.includes('sparse reward')) {
      rewards.push({
        condition: 'agent_at_object',
        value: 1,
        description: 'Sparse reward (only at goal)',
      })
    } else if (lowerContent.includes('dense reward') || lowerContent.includes('shaped reward')) {
      rewards.push({
        condition: 'distance_to_goal',
        value: -0.01,
        description: 'Dense reward (distance-based shaping)',
      })
      rewards.push({
        condition: 'agent_at_object',
        value: 10,
        description: 'Final reward for reaching goal',
      })
    }

    return rewards
  }

  private extractTerminations(content: string): Array<{ condition: string; description?: string }> {
    const terminations: Array<{ condition: string; description?: string }> = []

    // Look for termination patterns
    if (content.toLowerCase().match(/\b(terminat|done|episode end|max step)\b/)) {
      const maxStepMatch = content.match(/max[_\s]?steps?[:\s=]+(\d+)/i)
      if (maxStepMatch) {
        terminations.push({
          condition: 'timeout',
          description: `Episode ends after ${maxStepMatch[1]} steps`,
        })
      } else {
        terminations.push({
          condition: 'timeout',
          description: 'Episode ends after timeout',
        })
      }
    }

    // Goal termination
    if (content.toLowerCase().includes('goal') && content.toLowerCase().includes('terminat')) {
      terminations.push({
        condition: 'agent_at_object',
        description: 'Episode ends when agent reaches goal',
      })
    }

    return terminations
  }

  private extractDescription(content: string): string | undefined {
    // Try to extract first paragraph or summary
    const paragraphs = content.split(/\n\n+/)
    for (const para of paragraphs) {
      if (para.length > 50 && para.length < 500) {
        return para.trim()
      }
    }
    return content.substring(0, 500).trim()
  }

  private extractMetadata(
    content: string,
    sourceUrl?: string
  ): { source?: string; tags?: string[]; notes?: string } {
    const tags: string[] = []
    const lowerContent = content.toLowerCase()

    // Extract tags based on content
    if (lowerContent.includes('grid') || lowerContent.includes('maze')) tags.push('gridworld')
    if (lowerContent.includes('continuous') || lowerContent.includes('physics'))
      tags.push('continuous')
    if (lowerContent.includes('multi') && lowerContent.includes('agent')) tags.push('multi-agent')
    if (lowerContent.includes('navigation')) tags.push('navigation')
    if (lowerContent.includes('pursuit') || lowerContent.includes('chase')) tags.push('pursuit')

    return {
      source: sourceUrl,
      tags,
      notes: content.substring(0, 1000),
    }
  }
}

// Convex Actions
export const scrapeUrl = action({
  args: {
    url: v.string(),
    includeImages: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)
    // Firecrawl v1 only accepts 'url' parameter
    const result = await service.scrape(args.url)

    return result
  },
})

export const importFromPaper = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)
    const parser = new EnvironmentParser()

    // Firecrawl v1 only accepts 'url' parameter
    const scrapeResult = await service.scrape(args.url)

    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error('Failed to scrape URL')
    }

    const content = scrapeResult.data.markdown || scrapeResult.data.text || ''
    const extracted = parser.parse(content, args.url)

    return {
      success: true,
      extracted,
      rawContent: content.substring(0, 2000),
      images: scrapeResult.data.images || [],
    }
  },
})

export const importFromGitHub = action({
  args: { repoUrl: v.string() },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)
    const parser = new EnvironmentParser()

    // Extract GitHub repo info
    const repoMatch = args.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL')
    }

    const [, owner, repo] = repoMatch
    const readmeUrl = `https://github.com/${owner}/${repo}/blob/main/README.md`

    // Firecrawl v1 only accepts 'url' parameter
    const scrapeResult = await service.scrape(readmeUrl)

    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error('Failed to scrape GitHub repository')
    }

    const content = scrapeResult.data.markdown || scrapeResult.data.text || ''
    const extracted = parser.parse(content, args.repoUrl)

    return {
      success: true,
      extracted,
      rawContent: content.substring(0, 2000),
      repoInfo: {
        owner,
        repo,
        url: args.repoUrl,
      },
    }
  },
})

export const searchSimilarEnvironments = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)

    // Search across multiple RL-related sites
    const searchQuery = `${args.query} reinforcement learning environment`
    const searchResult = await service.search(searchQuery, {
      limit: args.limit || 6,
      sites: [
        'arxiv.org',
        'github.com',
        'medium.com',
        'towardsdatascience.com',
        'openai.com',
        'deepmind.com',
      ],
    })

    return searchResult
  },
})

export const suggestRewardRules = action({
  args: {
    envDescription: v.string(),
    envType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)
    const parser = new EnvironmentParser()

    // Search for reward design patterns
    const searchQuery = `reward design ${args.envType || ''} ${args.envDescription} reinforcement learning`
    const searchResult = await service.search(searchQuery, {
      limit: 5,
    })

    // Extract reward patterns from search results
    const suggestions: Array<{
      condition: string
      value: number
      description: string
      source?: string
    }> = []

    if (searchResult.data) {
      for (const result of searchResult.data) {
        const content = result.content || result.description || ''
        const rewards = parser.extractRewards(content)
        for (const reward of rewards) {
          suggestions.push({
            condition: reward.condition,
            value: reward.value,
            description: reward.description || reward.condition,
            source: result.url,
          })
        }
      }
    }

    // Add common reward patterns
    if (
      args.envDescription.toLowerCase().includes('navigation') ||
      args.envDescription.toLowerCase().includes('goal')
    ) {
      suggestions.push({
        condition: 'agent_at_object',
        value: 10,
        description: 'Reward for reaching goal (common pattern)',
      })
      suggestions.push({
        condition: 'timeout',
        value: -0.1,
        description: 'Step penalty to encourage efficiency',
      })
    }

    return {
      suggestions: suggestions.slice(0, 10),
      sources: searchResult.data?.map((r) => r.url) || [],
    }
  },
})

export const extractCurriculumPatterns = action({
  args: { taskType: v.string() },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)

    const searchQuery = `curriculum learning ${args.taskType} reinforcement learning`
    const searchResult = await service.search(searchQuery, {
      limit: 5,
    })

    // Extract curriculum patterns
    const patterns: Array<{
      name: string
      description: string
      phases: Array<{ difficulty: string; settings: Record<string, any> }>
    }> = []

    if (searchResult.data) {
      for (const result of searchResult.data) {
        const content = result.content || result.description || ''
        // Simple pattern extraction
        if (content.toLowerCase().includes('curriculum')) {
          patterns.push({
            name: result.title || 'Curriculum Pattern',
            description: content.substring(0, 200),
            phases: [
              { difficulty: 'easy', settings: {} },
              { difficulty: 'medium', settings: {} },
              { difficulty: 'hard', settings: {} },
            ],
          })
        }
      }
    }

    return {
      patterns: patterns.slice(0, 5),
      sources: searchResult.data?.map((r) => r.url) || [],
    }
  },
})

export const extractDomainRandomizationRecipes = action({
  args: {},
  handler: async (ctx) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)

    const searchQuery = 'domain randomization sim2real reinforcement learning'
    const searchResult = await service.search(searchQuery, {
      limit: 5,
    })

    const recipes: Array<{
      name: string
      parameters: Array<{ name: string; range: [number, number] }>
      description: string
    }> = []

    if (searchResult.data) {
      for (const result of searchResult.data) {
        const content = result.content || result.description || ''
        if (content.toLowerCase().includes('randomization')) {
          recipes.push({
            name: result.title || 'Domain Randomization Recipe',
            description: content.substring(0, 200),
            parameters: [
              { name: 'lighting_variation', range: [0, 1] },
              { name: 'map_noise', range: [0, 0.2] },
              { name: 'reward_noise', range: [0, 0.1] },
            ],
          })
        }
      }
    }

    return {
      recipes: recipes.slice(0, 5),
      sources: searchResult.data?.map((r) => r.url) || [],
    }
  },
})

/**
 * Parse diagram/image to extract environment layout
 */
export const parseDiagram = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY
    if (!firecrawlApiKey) {
      throw new Error(
        'Firecrawl API key not configured. Please set FIRECRAWL_API_KEY in your Convex dashboard (Settings > Environment Variables) or run: npx convex env set FIRECRAWL_API_KEY your-key-here'
      )
    }

    const service = new FirecrawlService(firecrawlApiKey)
    const parser = new EnvironmentParser()

    // Scrape URL with images
    // Firecrawl v1 only accepts 'url' parameter
    const scrapeResult = await service.scrape(args.url)

    if (!scrapeResult.success || !scrapeResult.data) {
      throw new Error('Failed to scrape URL')
    }

    const content = scrapeResult.data.markdown || scrapeResult.data.text || ''
    const images = scrapeResult.data.images || []

    // Try to extract from image alt text and captions
    let diagramContent = content

    // Look for image descriptions that might contain layout info
    for (const img of images) {
      if (img.alt) {
        diagramContent += '\n' + img.alt
      }
    }

    // Look for ASCII art in content
    const asciiMatches =
      content.match(/```[\s\S]*?```/g) ||
      content.match(/(?:^|\n)[#\sSGOTKDL]+(?:\n[#\sSGOTKDL]+)+/gm)

    if (asciiMatches && asciiMatches.length > 0) {
      // Use the largest ASCII grid found
      const largestGrid = asciiMatches.reduce((a, b) => (a.length > b.length ? a : b))
      diagramContent = largestGrid + '\n' + diagramContent
    }

    const extracted = parser.parse(diagramContent, args.url)

    return {
      success: true,
      extracted,
      images: images.map((img) => img.url),
      rawContent: content.substring(0, 2000),
    }
  },
})

/**
 * Generate automatic documentation for an environment
 */
export const generateDocumentation = action({
  args: {
    envSpec: v.any(), // EnvSpec as JSON
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envSpec = args.envSpec

    // Build documentation sections
    const sections: Array<{ title: string; content: string }> = []

    // Overview
    sections.push({
      title: 'Overview',
      content: `# ${envSpec.name || 'Environment'}

${envSpec.metadata?.notes || envSpec.description || 'A reinforcement learning environment.'}

## Environment Type
${
  envSpec.envType === 'grid'
    ? 'Grid-based discrete environment'
    : envSpec.envType === 'continuous2d'
      ? '2D Continuous control environment'
      : 'Custom 2D environment'
}`,
    })

    // World Specification
    if (envSpec.world) {
      sections.push({
        title: 'World Specification',
        content: `## World Dimensions
- **Width**: ${envSpec.world.width}
- **Height**: ${envSpec.world.height}
- **Coordinate System**: ${envSpec.world.coordinateSystem}
${envSpec.world.cellSize ? `- **Cell Size**: ${envSpec.world.cellSize}` : ''}`,
      })
    }

    // Objects
    if (envSpec.objects && envSpec.objects.length > 0) {
      const objectTypes = new Map<string, number>()
      envSpec.objects.forEach((obj: { type: string }) => {
        const count = objectTypes.get(obj.type) || 0
        objectTypes.set(obj.type, count + 1)
      })

      sections.push({
        title: 'Objects',
        content: `## Environment Objects
${Array.from(objectTypes.entries())
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n')}

Total objects: ${envSpec.objects.length}`,
      })
    }

    // Agents
    if (envSpec.agents && envSpec.agents.length > 0) {
      sections.push({
        title: 'Agents',
        content: `## Agents
${envSpec.agents
  .map(
    (agent: { name?: string; position: [number, number] }, idx: number) =>
      `- **Agent ${idx + 1}** (${agent.name || 'Unnamed'}): Position [${agent.position[0]}, ${agent.position[1]}]`
  )
  .join('\n')}

Total agents: ${envSpec.agents.length}`,
      })
    }

    // Action Space
    if (envSpec.actionSpace) {
      sections.push({
        title: 'Action Space',
        content: `## Action Space
**Type**: ${envSpec.actionSpace.type}
${
  envSpec.actionSpace.type === 'discrete'
    ? `**Actions**: ${envSpec.actionSpace.actions?.join(', ') || 'N/A'}`
    : `**Dimensions**: ${envSpec.actionSpace.dimensions || 'N/A'}
**Range**: [${envSpec.actionSpace.range?.[0] || -1}, ${envSpec.actionSpace.range?.[1] || 1}]`
}`,
      })
    }

    // Reward Rules
    if (envSpec.rules?.rewards && envSpec.rules.rewards.length > 0) {
      sections.push({
        title: 'Reward Structure',
        content: `## Reward Rules
${envSpec.rules.rewards
  .map(
    (reward: { condition: { type: string }; value: number; description?: string }, idx: number) =>
      `### Reward ${idx + 1}
- **Condition**: ${JSON.stringify(reward.condition)}
- **Value**: ${reward.value}
${reward.description ? `- **Description**: ${reward.description}` : ''}`
  )
  .join('\n\n')}`,
      })
    }

    // Termination Conditions
    if (envSpec.rules?.terminations && envSpec.rules.terminations.length > 0) {
      sections.push({
        title: 'Termination Conditions',
        content: `## Episode Termination
${envSpec.rules.terminations
  .map(
    (term: { condition: { type: string; steps?: number }; description?: string }, idx: number) =>
      `### Condition ${idx + 1}
- **Type**: ${term.condition.type || 'N/A'}
${term.condition.steps ? `- **Max Steps**: ${term.condition.steps}` : ''}
${term.description ? `- **Description**: ${term.description}` : ''}`
  )
  .join('\n\n')}`,
      })
    }

    // References
    if (args.sourceUrl) {
      sections.push({
        title: 'References',
        content: `## Source
- **URL**: ${args.sourceUrl}
- **Imported**: ${new Date().toISOString()}`,
      })
    }

    // Combine all sections
    const fullDoc = sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n')

    return {
      success: true,
      documentation: fullDoc,
      sections: sections.map((s) => ({ title: s.title, length: s.content.length })),
      metadata: {
        generatedAt: new Date().toISOString(),
        environmentName: envSpec.name,
        environmentType: envSpec.envType,
        sourceUrl: args.sourceUrl,
      },
    }
  },
})
