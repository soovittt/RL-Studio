/**
 * GraphQL Client - Base configuration and utilities for GraphQL queries
 */

import { GraphQLClient } from 'graphql-request'

// Get backend service URL with proper local vs production handling
const getBackendUrl = (): string => {
  // In development, always use localhost (ignore env vars)
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    return 'http://localhost:8000'
  }

  // In production, use env var if set
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_ROLLOUT_SERVICE_URL

  if (envUrl) {
    return envUrl
  }

  // In production, warn if not set but still default to localhost
  console.warn(
    '⚠️ VITE_API_URL or VITE_ROLLOUT_SERVICE_URL is not set in production. Defaulting to localhost:8000. ' +
      'Please set your production backend URL in environment variables.'
  )

  return 'http://localhost:8000'
}

const GRAPHQL_ENDPOINT = `${getBackendUrl()}/graphql`

// Create GraphQL client instance
export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Execute a GraphQL query
 */
export async function query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  try {
    return await graphqlClient.request<T>(query, variables)
  } catch (error: any) {
    // Extract GraphQL errors if available
    if (error.response?.errors) {
      const errorMessages = error.response.errors.map((e: any) => e.message).join(', ')
      throw new Error(`GraphQL Error: ${errorMessages}`)
    }
    throw error
  }
}

/**
 * Execute a GraphQL mutation
 */
export async function mutate<T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<T> {
  return query<T>(mutation, variables)
}

/**
 * Get GraphQL endpoint URL
 */
export function getGraphQLEndpoint(): string {
  return GRAPHQL_ENDPOINT
}
