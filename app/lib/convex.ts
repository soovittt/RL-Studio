import { ConvexReactClient } from 'convex/react'

// Get Convex URL with proper validation and dev/prod detection
const getConvexUrl = (): string => {
  const isDev = import.meta.env.MODE === 'development'

  // In development, prefer VITE_CONVEX_DEV_URL if set, otherwise use VITE_CONVEX_URL
  // This allows you to have separate dev and prod Convex deployments
  const devUrl = import.meta.env.VITE_CONVEX_DEV_URL
  const prodUrl = import.meta.env.VITE_CONVEX_URL

  let url = ''

  if (isDev) {
    // Development mode: prefer dev URL, fallback to prod URL
    url = devUrl || prodUrl || ''

    if (!url) {
      console.warn(
        '⚠️ VITE_CONVEX_URL or VITE_CONVEX_DEV_URL is not set. Please run "npx convex dev" and add the URL to your .env file.'
      )
    } else if (devUrl) {
      console.log('🔧 Using Convex DEV URL:', devUrl)
    } else if (prodUrl) {
      console.warn('⚠️ Using PRODUCTION Convex URL in development mode:', prodUrl)
      console.warn('   Consider setting VITE_CONVEX_DEV_URL for local development')
    }
  } else {
    // Production mode: use VITE_CONVEX_URL
    url = prodUrl || ''

    if (!url) {
      throw new Error(
        'VITE_CONVEX_URL is required in production. Please set it in your environment variables.'
      )
    }
    console.log('🚀 Using Convex PRODUCTION URL:', url)
  }

  // Validate URL format
  if (url && !url.startsWith('https://') && !url.startsWith('http://')) {
    console.warn('⚠️ Convex URL should be a valid URL starting with https://')
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
  updateRunStatus: async (
    id: string,
    status: 'queued' | 'running' | 'completed' | 'error',
    skyPilotJobId?: string
  ) => {
    return httpClient.mutation('runs:updateStatus', { id, status, skyPilotJobId })
  },
  getRunMetrics: async (runId: string) => {
    return httpClient.query('metrics:get', { runId })
  },
  importFromPaper: async (url: string) => {
    return httpClient.action('import:fromPaper', { url })
  },
}
