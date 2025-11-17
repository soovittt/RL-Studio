import { createFileRoute } from '@tanstack/react-router'
import { RunViewer } from '~/components/RunViewer'

export const Route = createFileRoute('/runs/$id')({
  component: RunViewer,
})

