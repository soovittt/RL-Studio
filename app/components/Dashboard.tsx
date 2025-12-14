import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

export function Dashboard() {
  const runs = useQuery(api.runs.listRecent, {})
  const envs = useQuery(api.environments.listRecent, {})

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Design, train, and monitor RL agents</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/environments/new"
              className="block w-full px-4 py-2 bg-blue-600 text-white rounded-md text-center hover:bg-blue-700 transition-colors"
            >
              Create Environment
            </Link>
            <Link
              to="/environments"
              className="block w-full px-4 py-2 border border-border rounded-md text-center hover:bg-muted"
            >
              Browse Environments
            </Link>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Stats</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environments</span>
              <span className="font-semibold">{envs?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Runs</span>
              <span className="font-semibold">
                {runs?.filter((r) => r.status === 'running').length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Runs</h2>
          {runs && runs.length > 0 ? (
            <div className="space-y-2">
              {runs.slice(0, 5).map((run) => (
                <Link
                  key={run._id}
                  to="/runs/$id"
                  params={{ id: run._id }}
                  className="block p-3 border border-border rounded-md hover:bg-muted"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{run.envId}</span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        run.status === 'running'
                          ? 'bg-blue-100 text-blue-800'
                          : run.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No runs yet</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Environments</h2>
          {envs && envs.length > 0 ? (
            <div className="space-y-2">
              {envs.slice(0, 5).map((env) => (
                <Link
                  key={env._id}
                  to="/environments/$id"
                  params={{ id: env._id }}
                  className="block p-3 border border-border rounded-md hover:bg-muted"
                >
                  <div className="font-medium">{env.name}</div>
                  <div className="text-sm text-muted-foreground">{env.type}</div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No environments yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
