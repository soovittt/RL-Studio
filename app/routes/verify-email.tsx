import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api.js'

function VerifyEmail() {
  const search = useSearch({ from: '/verify-email' })
  const navigate = useNavigate()
  const verifyEmailChange = useMutation(api.auth.verifyEmailChange)

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    const otp = (search as { otp?: string }).otp

    if (!otp) {
      setStatus('error')
      setMessage(
        'No verification code provided. Please check your email for the 6-digit code and enter it in the settings page.'
      )
      return
    }

    const verify = async () => {
      try {
        const result = await verifyEmailChange({ otp })
        setStatus('success')
        setMessage(result.message || 'Email verified successfully!')

        // Redirect to settings after 2 seconds
        setTimeout(() => {
          navigate({ to: '/settings' })
        }, 2000)
      } catch (error) {
        setStatus('error')
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to verify email. The code may have expired.'
        )
      }
    }

    verify()
  }, [(search as { otp?: string }).otp, verifyEmailChange, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 shadow-lg">
        <div className="text-center">
          {status === 'verifying' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verifying Email</h1>
              <p className="text-muted-foreground">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-green-500 text-5xl mb-4">✓</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Email Verified!</h1>
              <p className="text-muted-foreground mb-4">{message}</p>
              <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-red-500 text-5xl mb-4">✗</div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verification Failed</h1>
              <p className="text-muted-foreground mb-4">{message}</p>
              <button
                onClick={() => navigate({ to: '/settings' })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Go to Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmail,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      otp: (search.otp as string) || undefined,
    }
  },
})
