import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import type { Id } from '../../convex/_generated/dataModel'

interface User {
  _id: Id<'users'>
  email: string
  displayName: string
  plan: 'free' | 'pro'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'rl_studio_auth_token'
const USER_ID_KEY = 'rl_studio_user_id'

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_ID_KEY)
}

function setStoredAuth(token: string, userId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_ID_KEY, userId)
}

function clearStoredAuth(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const storedToken = getStoredToken()
    const storedUserId = getStoredUserId()

    if (storedToken && storedUserId) {
      setToken(storedToken)
      setUserId(storedUserId)
    }

    setIsInitialized(true)
  }, [])

  const validatedUser = useQuery(
    api.auth.validateToken,
    token && token !== '' ? { token } : 'skip'
  )

  const user = useQuery(
    api.auth.getUserById,
    userId && validatedUser ? { userId: userId as Id<'users'> } : 'skip'
  )

  useEffect(() => {
    if (token && token !== '' && validatedUser === null && isInitialized) {
      clearStoredAuth()
      setToken(null)
      setUserId(null)
    }
  }, [token, validatedUser, isInitialized])

  const isLoading = !isInitialized || (token !== null && token !== '' && validatedUser === undefined && user === undefined)

  const signOut = useCallback(async () => {
    if (token) {
      try {
        const convexUrl = import.meta.env.VITE_CONVEX_URL
        if (convexUrl) {
          await fetch(`${convexUrl}/api/auth/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }).catch(() => {})
        }
      } catch {}
    }

    clearStoredAuth()
    setToken(null)
    setUserId(null)
    window.location.href = '/login'
  }, [token])

  const isAuthenticated = !!user && !!token && !!validatedUser

  return (
    <AuthContext.Provider
      value={{
        user: user as User | null,
        isLoading,
        isAuthenticated,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function setAuth(token: string, userId: string): void {
  setStoredAuth(token, userId)
  const redirectPath = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
  sessionStorage.removeItem('redirectAfterLogin')
  
  // Force a synchronous write to localStorage and then redirect
  // Using requestAnimationFrame to ensure the write completes
  requestAnimationFrame(() => {
    // Double-check localStorage was written
    const stored = getStoredToken()
    if (stored === token) {
      window.location.href = redirectPath
    } else {
      // Retry if write didn't complete
      setTimeout(() => {
        window.location.href = redirectPath
      }, 50)
    }
  })
}
