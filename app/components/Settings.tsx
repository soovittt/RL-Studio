/**
 * Settings page component.
 *
 * Features:
 * - Update display name
 * - Change email (with OTP verification)
 * - Change password (requires current password)
 * - Request password reset link
 */
import { useState, useEffect } from 'react'
import { useMutation, useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api.js'
import { useAuth } from '~/lib/auth'
import { useTheme } from '~/lib/theme'

export function Settings() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const updateUser = useMutation(api.auth.updateUser)
  const requestEmailChange = useMutation(api.auth.requestEmailChange)
  const verifyEmailChange = useMutation(api.auth.verifyEmailChange)
  const cancelVerification = useMutation(api.auth.cancelPendingEmailVerification)
  const changePassword = useAction(api.authNode.changePassword)
  const requestPasswordReset = useAction(api.authNode.requestPasswordReset)
  const pendingVerification = useQuery(
    api.auth.getPendingEmailVerification,
    user ? { userId: user._id } : 'skip'
  )

  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Email change state
  const [emailError, setEmailError] = useState<string | null>(null)
  const [verificationOTP, setVerificationOTP] = useState('')
  const [isRequestingVerification, setIsRequestingVerification] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Password reset state
  const [isRequestingReset, setIsRequestingReset] = useState(false)

  // Update form fields when user data loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '')
      setEmail(user.email || '')
    }
  }, [user])

  // Update email field if there's a pending verification
  useEffect(() => {
    if (pendingVerification) {
      setEmail(pendingVerification.newEmail)
    } else if (user) {
      setEmail(user.email || '')
    }
  }, [pendingVerification, user])

  // Email validation
  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    if (!email || email.trim().length === 0) {
      return { valid: false, error: 'Email is required' }
    }
    const trimmed = email.trim()
    if (trimmed.length < 5) {
      return { valid: false, error: 'Email is too short' }
    }
    if (trimmed.length > 254) {
      return { valid: false, error: 'Email is too long' }
    }
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format' }
    }
    if (trimmed === (user?.email || '').trim()) {
      return { valid: false, error: 'New email must be different from current email' }
    }
    return { valid: true }
  }

  // Validate email on change
  useEffect(() => {
    if (email && email !== (user?.email || '') && !pendingVerification) {
      const validation = validateEmail(email)
      setEmailError(validation.valid ? null : validation.error || null)
    } else {
      setEmailError(null)
    }
  }, [email, user?.email, pendingVerification])

  const handleVerifyEmail = async () => {
    if (!user) return

    const trimmedEmail = (email || '').trim()
    const validation = validateEmail(trimmedEmail)
    if (!validation.valid) {
      setEmailError(validation.error || 'Invalid email format')
      setSaveMessage({ type: 'error', text: validation.error || 'Invalid email format' })
      return
    }

    setIsRequestingVerification(true)
    setSaveMessage(null)
    setEmailError(null)

    try {
      // Request email change and get OTP
      const result = await requestEmailChange({
        userId: user._id,
        newEmail: trimmedEmail,
      })

      // Send verification email via backend (frontend calls backend directly)
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const emailSubject = 'Verify your email address change'
      const emailBody = `
Hello ${user.displayName || 'User'},

You requested to change your email address to ${trimmedEmail}.

Your verification code is: ${result.otp}

Enter this code in the settings page to complete the email change.

This code will expire in 15 minutes.

If you did not request this change, please ignore this email.

Best regards,
RL Studio Team
      `.trim()

      try {
        const emailResponse = await fetch(`${backendUrl}/api/email/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: trimmedEmail,
            subject: emailSubject,
            body: emailBody,
          }),
        })

        if (emailResponse.ok) {
          const emailResult = await emailResponse.json()
          if (emailResult.success) {
            setSaveMessage({
              type: 'success',
              text: `Verification code sent to ${trimmedEmail}. Please check your inbox for the 6-digit code.`,
            })
          } else {
            // Backend email failed, but OTP is still valid - show it to user
            setSaveMessage({
              type: 'error',
              text: `Email service unavailable. Your verification code is: ${result.otp} (expires in 15 minutes)`,
            })
          }
        } else {
          // Backend email failed, but OTP is still valid - show it to user
          setSaveMessage({
            type: 'error',
            text: `Email service unavailable. Your verification code is: ${result.otp} (expires in 15 minutes)`,
          })
        }
      } catch (emailError) {
        // Backend email failed, but OTP is still valid - show it to user
        console.error('Failed to send email via backend:', emailError)
        setSaveMessage({
          type: 'error',
          text: `Email service unavailable. Your verification code is: ${result.otp} (expires in 15 minutes)`,
        })
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to request email change',
      })
    } finally {
      setIsRequestingVerification(false)
    }
  }

  const handleCancelVerification = async () => {
    if (!user) return

    try {
      await cancelVerification({ userId: user._id })
      setEmail(user.email || '')
      setVerificationOTP('')
      setEmailError(null)
      setSaveMessage({ type: 'success', text: 'Email verification cancelled' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to cancel verification',
      })
    }
  }

  const handleVerifyOTP = async () => {
    if (!user) return

    if (!verificationOTP.trim() || verificationOTP.length !== 6) {
      setSaveMessage({ type: 'error', text: 'Please enter the 6-digit verification code' })
      return
    }

    setIsVerifying(true)
    try {
      const result = await verifyEmailChange({ otp: verificationOTP.trim() })
      setSaveMessage({ type: 'success', text: result.message || 'Email verified successfully!' })
      setVerificationOTP('')
      // Reload after a short delay to get updated user data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to verify email',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return

    setIsSaving(true)
    setSaveMessage(null)

    try {
      const trimmedDisplayName = (displayName || '').trim()
      const currentDisplayName = (user.displayName || '').trim()

      if (trimmedDisplayName !== currentDisplayName) {
        if (trimmedDisplayName.length > 0) {
          await updateUser({
            userId: user._id,
            displayName: trimmedDisplayName,
          })
          setSaveMessage({ type: 'success', text: 'Display name updated successfully!' })
          setTimeout(() => setSaveMessage(null), 3000)
        } else {
          throw new Error('Display name cannot be empty')
        }
      } else {
        setSaveMessage({ type: 'error', text: 'No changes to save' })
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!user) return

    // Validation
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError('Current password is required')
      return
    }

    if (!newPassword) {
      setPasswordError('New password is required')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    setIsChangingPassword(true)
    setSaveMessage(null)

    try {
      await changePassword({
        userId: user._id,
        currentPassword,
        newPassword,
      })

      setSaveMessage({ type: 'success', text: 'Password changed successfully!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password'
      setPasswordError(errorMessage)
      setSaveMessage({ type: 'error', text: errorMessage })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return

    setIsRequestingReset(true)
    setSaveMessage(null)

    try {
      const result = await requestPasswordReset({
        email: user.email,
      })

      setSaveMessage({
        type: 'success',
        text: result.message || 'Password reset link sent to your email. Please check your inbox.',
      })
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send password reset link',
      })
    } finally {
      setIsRequestingReset(false)
    }
  }

  const hasDisplayNameChanges = displayName !== (user?.displayName || '')
  const hasEmailChanges = email !== (user?.email || '') && !pendingVerification
  const canVerifyEmail = hasEmailChanges && !emailError && !pendingVerification

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Account Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      {/* Account Information Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-foreground mb-1">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              value={user._id}
              disabled
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-muted-foreground cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-muted-foreground">Your unique user identifier</p>
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => {
                  if (!pendingVerification) {
                    setEmail(e.target.value)
                    setEmailError(null)
                  }
                }}
                disabled={!!pendingVerification}
                className={`w-full px-3 py-2 bg-background border rounded-md text-foreground focus:outline-none focus:ring-2 transition-colors ${
                  emailError
                    ? 'border-red-500 focus:ring-red-500'
                    : pendingVerification
                      ? 'bg-muted cursor-not-allowed border-border'
                      : 'border-border focus:ring-primary'
                }`}
                placeholder="Enter your email"
              />
              {emailError && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-red-500 text-sm">✗</span>
                </div>
              )}
            </div>
            {emailError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{emailError}</p>
            )}
            {canVerifyEmail && (
              <button
                onClick={handleVerifyEmail}
                disabled={isRequestingVerification}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isRequestingVerification ? 'Sending...' : 'Verify Email'}
              </button>
            )}
            {pendingVerification && (
              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                    ⚠️ Email change pending verification
                  </p>
                  <button
                    onClick={handleCancelVerification}
                    className="text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                  A verification code has been sent to{' '}
                  <strong>{pendingVerification.newEmail}</strong>. Please check your inbox for the
                  6-digit code.
                </p>
                <div className="space-y-2">
                  <label
                    htmlFor="verificationOTP"
                    className="block text-xs font-medium text-yellow-800 dark:text-yellow-200"
                  >
                    Enter 6-digit verification code:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="verificationOTP"
                      value={verificationOTP}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setVerificationOTP(value)
                      }}
                      maxLength={6}
                      className="flex-1 px-3 py-2 bg-background border border-yellow-300 dark:border-yellow-700 rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center text-2xl font-mono tracking-widest"
                      placeholder="000000"
                    />
                    <button
                      onClick={handleVerifyOTP}
                      disabled={isVerifying || verificationOTP.length !== 6}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Check your email inbox for the 6-digit code. It expires in 15 minutes.
                  </p>
                </div>
              </div>
            )}
            {!pendingVerification && (
              <p className="mt-1 text-xs text-muted-foreground">
                Changing your email requires verification. Enter a new email and click "Verify
                Email".
              </p>
            )}
          </div>

          <div>
            <label htmlFor="plan" className="block text-sm font-medium text-foreground mb-1">
              Plan
            </label>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  user.plan === 'pro'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {user.plan === 'pro' ? 'Pro' : 'Free'}
              </span>
              {user.plan === 'free' && (
                <button className="text-sm text-primary hover:underline">Upgrade to Pro</button>
              )}
            </div>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mt-4 p-3 rounded-md ${
              saveMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}
          >
            {saveMessage.text}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={!hasDisplayNameChanges || isSaving}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              hasDisplayNameChanges && !isSaving
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Security</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Change Password</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Update your password to keep your account secure. You'll need to enter your current
              password.
            </p>

            {!showPasswordChange ? (
              <button
                onClick={() => setShowPasswordChange(true)}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                Change Password
              </button>
            ) : (
              <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value)
                      setPasswordError(null)
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      setPasswordError(null)
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setPasswordError(null)
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={
                      isChangingPassword || !currentPassword || !newPassword || !confirmPassword
                    }
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordChange(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setPasswordError(null)
                    }}
                    className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-foreground mb-2">Forgot Password?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Can't remember your password? We'll send a reset link to your email address.
            </p>
            <button
              onClick={handleRequestPasswordReset}
              disabled={isRequestingReset}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isRequestingReset ? 'Sending...' : 'Send Password Reset Link'}
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              A password reset link will be sent to <strong>{user.email}</strong>. The link expires
              in 1 hour.
            </p>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Preferences</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Theme</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Customize the appearance of the application
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="light"
                  checked={theme === 'light'}
                  onChange={() => setTheme('light')}
                  className="cursor-pointer"
                />
                <span className="text-sm">Light</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="dark"
                  checked={theme === 'dark'}
                  onChange={() => setTheme('dark')}
                  className="cursor-pointer"
                />
                <span className="text-sm">Dark</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value="system"
                  checked={theme === 'system'}
                  onChange={() => setTheme('system')}
                  className="cursor-pointer"
                />
                <span className="text-sm">System</span>
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Theme preference saved automatically
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-red-200 dark:border-red-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
              Delete Account
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              Account deletion functionality coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
