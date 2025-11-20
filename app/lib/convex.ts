import { ConvexReactClient } from 'convex/react'

// Get Convex URL with proper validation
const getConvexUrl = (): string => {
  const url = import.meta.env.VITE_CONVEX_URL || ''
  
  // In development, warn if missing
  if (import.meta.env.MODE === 'development' && !url) {
    console.warn(
      '⚠️ VITE_CONVEX_URL is not set. Please run "npx convex dev" and add the URL to your .env file.'
    )
  }
  
  // In production, throw error if missing (required)
  if (import.meta.env.MODE === 'production' && !url) {
    throw new Error(
      'VITE_CONVEX_URL is required in production. Please set it in your environment variables.'
    )
  }
  
  // Validate URL format
  if (url && !url.startsWith('https://') && !url.startsWith('http://')) {
    console.warn('⚠️ VITE_CONVEX_URL should be a valid URL starting with https://')
  }
  
  return url
}

const convexUrl = getConvexUrl()
export const convex = new ConvexReactClient(convexUrl)

// Legacy HTTP client for non-React usage
import { ConvexHttpClient } from 'convex/browser'
const httpClient = new ConvexHttpClient(convexUrl)

export const api = {
  listRecentRuns: async () => {
    return httpClient.query('runs:listRecent', {})
  },
  listRecentEnvironments: async () => {
    return httpClient.query('environments:listRecent', {})
  },
  getEnvironment: async (id: string) => {
    return httpClient.query('environments:get', { id })
  },
  createEnvironment: async (data: any) => {
    return httpClient.mutation('environments:create', data)
  },
  updateEnvironment: async (id: string, data: any) => {
    return httpClient.mutation('environments:update', { id, ...data })
  },
  getRun: async (id: string) => {
    return httpClient.query('runs:get', { id })
  },
  createRun: async (data: any) => {
    return httpClient.mutation('runs:create', data)
  },
  updateRunStatus: async (id: string, status: 'queued' | 'running' | 'completed' | 'error', skyPilotJobId?: string) => {
    return httpClient.mutation('runs:updateStatus', { id, status, skyPilotJobId })
  },
  getRunMetrics: async (runId: string) => {
    return httpClient.query('metrics:get', { runId })
  },
  importFromPaper: async (url: string) => {
    return httpClient.action('import:fromPaper', { url })
  },
}

