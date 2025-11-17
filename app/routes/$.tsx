import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
  component: () => (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">404 - Not Found</h1>
    </div>
  ),
})

