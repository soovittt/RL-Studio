import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { RunComparison } from '~/components/RunComparison'

const compareSearchSchema = z.object({
  runs: z.union([z.string(), z.array(z.string())]).optional(),
})

export const Route = createFileRoute('/runs/compare')({
  validateSearch: compareSearchSchema,
  component: CompareRuns,
})

function CompareRuns() {
  const search = useSearch({ from: '/runs/compare' })
  const runIds = search.runs
    ? Array.isArray(search.runs)
      ? search.runs
      : [search.runs]
    : []

  if (runIds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Run Comparison</h1>
          <p className="text-muted-foreground">
            No runs selected. Please select runs from the runs list to compare.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RunComparison runIds={runIds} />
    </div>
  )
}
