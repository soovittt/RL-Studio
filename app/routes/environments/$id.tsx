import { createFileRoute, useParams } from '@tanstack/react-router'
import { EnvironmentEditor } from '~/components/EnvironmentEditor'

export const Route = createFileRoute('/environments/$id')({
  component: () => {
    const { id } = useParams({ from: '/environments/$id' })
    return <EnvironmentEditor id={id} />
  },
})

