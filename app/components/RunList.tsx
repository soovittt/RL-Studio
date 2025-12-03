import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useState, memo, useMemo, useCallback } from 'react'

export const RunList = memo(function RunList() {
  const navigate = useNavigate()
  const runs = useQuery(api.runs.listRecent, {})
  const isLoading = runs === undefined
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set())

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Training Runs</h1>
          <p className="mt-2 text-muted-foreground">Monitor and manage RL training jobs</p>
        </div>
        {selectedRuns.size > 0 && (
          <button
            onClick={() => {
              const runIds = Array.from(selectedRuns)
              if (runIds.length >= 2 && runIds.length <= 5) {
                navigate({
                  to: '/runs/compare',
                  search: { runs: runIds },
                })
              } else {
                alert(`Please select 2-5 runs to compare. Currently selected: ${runIds.length}`)
              }
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Compare Selected ({selectedRuns.size})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : runs && runs.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  <input
                    type="checkbox"
                    checked={selectedRuns.size === runs.length && runs.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRuns(new Set(runs.map((r) => r._id)))
                      } else {
                        setSelectedRuns(new Set())
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Run ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Algorithm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run._id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRuns.has(run._id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedRuns)
                        if (e.target.checked) {
                          if (newSelected.size < 5) {
                            newSelected.add(run._id)
                          } else {
                            alert('Maximum 5 runs can be compared at once')
                            return
                          }
                        } else {
                          newSelected.delete(run._id)
                        }
                        setSelectedRuns(newSelected)
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to="/runs/$id"
                      params={{ id: run._id }}
                      className="text-primary hover:underline font-mono text-sm"
                    >
                      {run._id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {run.algorithm.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to="/runs/$id"
                      params={{ id: run._id }}
                      className="text-sm text-primary hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No runs yet</p>
        </div>
      )}
    </div>
  )
})
