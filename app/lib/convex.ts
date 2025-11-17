import { ConvexReactClient } from 'convex/react'

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || '')

// Legacy HTTP client for non-React usage
import { ConvexHttpClient } from 'convex/browser'
const httpClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL || '')

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

