import { createFileRoute } from '@tanstack/react-router'
import { RunList } from '~/components/RunList'

export const Route = createFileRoute('/runs')({
  component: RunList,
})

