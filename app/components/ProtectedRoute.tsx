import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = location.pathname
      if (currentPath !== '/login' && currentPath !== '/signup') {
        sessionStorage.setItem('redirectAfterLogin', currentPath)
      }
    }
  }, [isLoading, isAuthenticated, location.pathname])

  // If we have a token in localStorage but auth is still loading, wait a bit longer
  // This handles the case where we just logged in and the page is reloading
  const hasStoredToken = typeof window !== 'undefined' && localStorage.getItem('rl_studio_auth_token')
  
  if (isLoading || (hasStoredToken && !isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
