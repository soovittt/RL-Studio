import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { Layout } from '~/components/Layout'
import { ProtectedRoute } from '~/components/ProtectedRoute'
import { ErrorBoundary } from '~/components/ErrorBoundary'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const location = useLocation()
  const pathname = location.pathname

  if (pathname === '/login' || pathname.startsWith('/login') || pathname === '/') {
    return <Outlet />
  }

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <Layout>
          <Outlet />
        </Layout>
      </ProtectedRoute>
    </ErrorBoundary>
  )
}
