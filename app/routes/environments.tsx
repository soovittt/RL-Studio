import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { EnvironmentList } from '~/components/EnvironmentList'

export const Route = createFileRoute('/environments')({
  component: EnvironmentsComponent,
})

function EnvironmentsComponent() {
  const router = useRouterState()
  const pathname = router.location.pathname
  
  // If we're on exactly /environments, show the list
  // Otherwise, show the child route (new or $id) via Outlet
  if (pathname === '/environments') {
    return <EnvironmentList />
  }
  
  return <Outlet />
}

