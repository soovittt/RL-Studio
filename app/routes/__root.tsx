import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { Layout } from '~/components/Layout'
import { ProtectedRoute } from '~/components/ProtectedRoute'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouterState()
  const pathname = router.location.pathname

  if (pathname === '/login' || pathname.startsWith('/login') || pathname === '/') {
    return <Outlet />
  }

  return (
    <ProtectedRoute>
      <Layout>
        <Outlet />
      </Layout>
    </ProtectedRoute>
  )
}
