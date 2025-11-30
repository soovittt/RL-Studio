'use node'

import { action } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'

const TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days
const TOKEN_LENGTH = 32

function getExpiryTime(): number {
  return Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
}

export const signUp = action({
  args: {
    email: v.string(),
    password: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args): Promise<{ userId: any }> => {
    const crypto = require('crypto')

    if (args.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    if (!args.email.includes('@') || !args.email.includes('.')) {
      throw new Error('Invalid email address')
    }

    // Check if user exists
    const existing = await ctx.runQuery((internal as any).auth.findUserByEmail, {
      email: args.email.toLowerCase(),
    })

    if (existing) {
      throw new Error('User with this email already exists')
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(args.password, salt, 1000, 64, 'sha512').toString('hex')
    const passwordHash = `${salt}:${hash}`
    const authProviderId = `password:${crypto.randomUUID()}`

    const userId: any = await ctx.runMutation((internal as any).auth.createUser, {
      authProviderId,
      email: args.email.toLowerCase(),
      displayName: args.displayName.trim(),
      passwordHash,
      plan: 'free',
    })

    return { userId }
  },
})

export const signIn = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string; userId: any; expiresAt: number }> => {
    const crypto = require('crypto')

    const user: any = await ctx.runQuery((internal as any).auth.findUserByEmail, {
      email: args.email.toLowerCase(),
    })

    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password')
    }

    const [salt, hash] = user.passwordHash.split(':')
    if (!salt || !hash) {
      throw new Error('Invalid email or password')
    }
    const verifyHash = crypto.pbkdf2Sync(args.password, salt, 1000, 64, 'sha512').toString('hex')

    if (hash !== verifyHash) {
      throw new Error('Invalid email or password')
    }

    const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex')
    const expiresAt = getExpiryTime()

    await ctx.runMutation((internal as any).auth.createSession, {
      userId: user._id,
      token,
      expiresAt,
    })

    return { token, userId: user._id, expiresAt }
  },
})

/**
 * Change user password (requires current password).
 * Validates current password before updating to new one.
 */
export const changePassword = action({
  args: {
    userId: v.id('users'),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const crypto = require('crypto')
    const { userId, currentPassword, newPassword } = args

    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters')
    }

    // Get user by ID
    const user: any = await ctx.runQuery((internal as any).auth.getUserByIdInternal, {
      userId,
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Check if user has a password (password-based auth)
    if (!user.passwordHash) {
      throw new Error('Password change not available for this account type')
    }

    // Verify current password
    const [salt, hash] = user.passwordHash.split(':')
    if (!salt || !hash) {
      throw new Error('Invalid password format')
    }

    const verifyHash = crypto.pbkdf2Sync(currentPassword, salt, 1000, 64, 'sha512').toString('hex')
    if (hash !== verifyHash) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const newSalt = crypto.randomBytes(16).toString('hex')
    const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha512').toString('hex')
    const newPasswordHash = `${newSalt}:${newHash}`

    // Update password
    await ctx.runMutation((internal as any).auth.updatePassword, {
      userId,
      passwordHash: newPasswordHash,
    })

    return {
      success: true,
      message: 'Password changed successfully',
    }
  },
})

/**
 * Request password reset - generates token and sends reset link via email.
 * Returns success message even if user doesn't exist (security best practice).
 */
export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const crypto = require('crypto')

    // Find user by email
    const user: any = await ctx.runQuery((internal as any).auth.findUserByEmail, {
      email: args.email.toLowerCase(),
    })

    if (!user || !user.passwordHash) {
      // Don't reveal if user exists - security best practice
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      }
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour expiry

    // Store reset token
    await ctx.runMutation((internal as any).auth.createPasswordReset, {
      userId: user._id,
      token: resetToken,
      expiresAt,
    })

    // Send reset email via backend
    const backendUrl = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:8000'
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`

    const emailSubject = 'Reset Your Password - RL Studio'
    const emailBody = `
Hello ${user.displayName || 'User'},

You requested to reset your password for your RL Studio account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

Best regards,
RL Studio Team
    `.trim()

    try {
      const response = await fetch(`${backendUrl}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.log('✅ Password reset email sent to:', user.email)
        } else {
          console.error('Backend email service error:', result.message)
        }
      } else {
        console.error('Backend email service HTTP error:', response.status)
      }
    } catch (error) {
      console.error('Failed to send password reset email:', error)
    }

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    }
  },
})

/**
 * Reset password using reset token from email link.
 * Validates token, checks expiry, and updates password.
 */
export const resetPassword = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const crypto = require('crypto')
    const { token, newPassword } = args

    // Validate new password
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters')
    }

    // Find reset token
    const reset: any = await ctx.runQuery((internal as any).auth.getPasswordResetByToken, {
      token,
    })

    if (!reset) {
      throw new Error('Invalid or expired reset token')
    }

    if (reset.used) {
      throw new Error('This reset link has already been used')
    }

    if (reset.expiresAt < Date.now()) {
      throw new Error('This reset link has expired. Please request a new one.')
    }

    // Get user
    const user: any = await ctx.runQuery((internal as any).auth.getUserByIdInternal, {
      userId: reset.userId,
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Hash new password
    const newSalt = crypto.randomBytes(16).toString('hex')
    const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha512').toString('hex')
    const newPasswordHash = `${newSalt}:${newHash}`

    // Update password
    await ctx.runMutation((internal as any).auth.updatePassword, {
      userId: user._id,
      passwordHash: newPasswordHash,
    })

    // Mark reset token as used
    await ctx.runMutation((internal as any).auth.markPasswordResetUsed, {
      resetId: reset._id,
    })

    return {
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    }
  },
})

export const refreshToken = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const crypto = require('crypto')

    const session = await ctx.runQuery((internal as any).auth.getSessionByToken, {
      token: args.token,
    })

    if (!session || session.expiresAt < Date.now()) {
      throw new Error('Invalid or expired token')
    }

    const user = await ctx.runQuery((internal as any).auth.getUserById, {
      userId: session.userId,
    })

    if (!user) {
      throw new Error('User not found')
    }

    const newToken = crypto.randomBytes(TOKEN_LENGTH).toString('hex')
    const expiresAt = getExpiryTime()

    await ctx.runMutation((internal as any).auth.revokeSession, { token: args.token })
    await ctx.runMutation((internal as any).auth.createSession, {
      userId: user._id,
      token: newToken,
      expiresAt,
    })

    return { token: newToken, expiresAt }
  },
})
