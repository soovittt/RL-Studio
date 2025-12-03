import { createFileRoute } from '@tanstack/react-router'
import { EnvironmentEditor } from '~/components/EnvironmentEditor'

export const Route = createFileRoute('/environments/new')({
  component: NewEnvironmentEditor,
})

function NewEnvironmentEditor() {
  return <EnvironmentEditor id="new" />
}
