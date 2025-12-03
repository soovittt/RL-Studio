import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { EnvironmentCard } from './EnvironmentCard'

export function EnvironmentList() {
  const envs = useQuery(api.environments.listRecent, {})
  const isLoading = envs === undefined

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Environments</h1>
          <p className="mt-2 text-sm text-muted-foreground">Design and manage RL environments</p>
        </div>
        <Link
          to="/environments/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity font-medium text-sm"
        >
          New Environment
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : envs && envs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {envs.map((env) => (
            <EnvironmentCard key={env._id} env={env} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground mb-4">No environments yet</p>
          <Link
            to="/environments/new"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity font-medium"
          >
            Create your first environment
          </Link>
        </div>
      )}
    </div>
  )
}
