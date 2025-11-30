import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  internalAction,
  action,
} from './_generated/server'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'
import { internal } from './_generated/api'

const TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days
const TOKEN_LENGTH = 32

function getExpiryTime(): number {
  return Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
}

export const validateToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null

    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()

    if (!session) return null

    if (session.expiresAt < Date.now()) {
      return null
    }

    const user = await ctx.db.get(session.userId)
    return user
  },
})

export const getUserById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

export const getUserByIdInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})

/**
 * Internal mutation to update user password hash.
 */
export const updatePassword = internalMutation({
  args: {
    userId: v.id('users'),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      passwordHash: args.passwordHash,
    })
  },
})

/**
 * Create password reset token for a user.
 * Deletes any existing unused resets before creating new one.
 */
export const createPasswordReset = internalMutation({
  args: {
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Delete existing unused resets
    const existing = await ctx.db
      .query('passwordResets')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('used'), false))
      .collect()

    for (const reset of existing) {
      await ctx.db.delete(reset._id)
    }

    // Create new reset token
    await ctx.db.insert('passwordResets', {
      userId: args.userId,
      token: args.token,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
      used: false,
    })
  },
})

/**
 * Get password reset record by token.
 */
export const getPasswordResetByToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('passwordResets')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()
  },
})

/**
 * Mark password reset token as used.
 */
export const markPasswordResetUsed = internalMutation({
  args: {
    resetId: v.id('passwordResets'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.resetId, {
      used: true,
    })
  },
})

export const updateUser = mutation({
  args: {
    userId: v.id('users'),
    displayName: v.optional(v.string()),
    // Email is NOT allowed here - it must be changed via verification flow
  },
  handler: async (ctx, args) => {
    try {
      const { userId, displayName } = args

      // Verify user exists
      const user = await ctx.db.get(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // Build update object - only include fields that are provided and valid
      const updateData: { displayName?: string } = {}

      if (displayName !== undefined && displayName !== null) {
        const trimmed = String(displayName).trim()
        if (trimmed.length === 0) {
          throw new Error('Display name cannot be empty')
        }
        // Only update if it's actually different
        const currentDisplayName = (user.displayName || '').trim()
        if (trimmed !== currentDisplayName) {
          updateData.displayName = trimmed
        }
      }

      // Ensure at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update')
      }

      // Perform the update
      await ctx.db.patch(userId, updateData)

      // Return the updated user
      const updatedUser = await ctx.db.get(userId)
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user')
      }

      return updatedUser
    } catch (error) {
      // Re-throw with more context if it's already an Error
      if (error instanceof Error) {
        throw error
      }
      // Otherwise wrap in Error
      throw new Error(`Failed to update user: ${String(error)}`)
    }
  },
})

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase()))
      .first()
  },
})

export const createUser = internalMutation({
  args: {
    authProviderId: v.string(),
    email: v.string(),
    displayName: v.string(),
    passwordHash: v.string(),
    plan: v.union(v.literal('free'), v.literal('pro')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('users', args)
  },
})

export const createSession = internalMutation({
  args: {
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('sessions', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const revokeSession = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }
  },
})

export const revokeAllUserSessions = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }
  },
})

export const getSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()
  },
})

export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query('sessions')
      .withIndex('by_expires')
      .filter((q) => q.lt(q.field('expiresAt'), Date.now()))
      .collect()

    for (const session of expired) {
      await ctx.db.delete(session._id)
    }

    return expired.length
  },
})

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 15 // 15 minutes (shorter for OTP)

function generateOTP(): string {
  // Generate a 6-digit numeric OTP
  // Using Math.random for simplicity (in production, consider crypto.getRandomValues)
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  return otp
}

function getOTPExpiryTime(): number {
  return Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
}

/**
 * Request email change - generates OTP and stores verification request.
 * Email is sent via backend service (frontend handles sending).
 */
export const requestEmailChange = mutation({
  args: {
    userId: v.id('users'),
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, newEmail } = args

    // Verify user exists
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new Error('User not found')
    }

    const trimmed = newEmail.trim().toLowerCase()

    // Comprehensive email validation
    if (trimmed.length === 0) {
      throw new Error('Email cannot be empty')
    }

    if (trimmed.length < 5) {
      throw new Error('Email is too short')
    }

    if (trimmed.length > 254) {
      throw new Error('Email is too long (max 254 characters)')
    }

    // Comprehensive email regex pattern
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid email format. Please enter a valid email address.')
    }

    // Additional validation checks
    if (trimmed.startsWith('.') || trimmed.startsWith('@')) {
      throw new Error('Email cannot start with . or @')
    }

    if (trimmed.includes('..')) {
      throw new Error('Email cannot contain consecutive dots')
    }

    if (trimmed.endsWith('.') || trimmed.endsWith('@')) {
      throw new Error('Email cannot end with . or @')
    }

    // Check for valid domain structure
    const parts = trimmed.split('@')
    if (parts.length !== 2) {
      throw new Error('Email must contain exactly one @ symbol')
    }

    const [localPart, domain] = parts

    if (localPart.length === 0 || localPart.length > 64) {
      throw new Error('Invalid email local part')
    }

    if (domain.length === 0 || domain.length > 253) {
      throw new Error('Invalid email domain')
    }

    // Check domain has at least one dot (for TLD)
    if (!domain.includes('.')) {
      throw new Error('Email domain must include a top-level domain (e.g., .com, .org)')
    }

    // Check TLD is at least 2 characters
    const domainParts = domain.split('.')
    const tld = domainParts[domainParts.length - 1]
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      throw new Error('Invalid top-level domain')
    }

    // Check if email is already taken by another user
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', trimmed))
      .first()

    if (existing && existing._id !== userId) {
      throw new Error('Email already in use')
    }

    // Check if email is the same as current
    if (trimmed === (user.email || '').toLowerCase()) {
      throw new Error('New email must be different from current email')
    }

    // Delete any existing pending verifications for this user
    const existingVerifications = await ctx.db
      .query('emailVerifications')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    for (const verification of existingVerifications) {
      if (!verification.verified) {
        await ctx.db.delete(verification._id)
      }
    }

    // Create new verification OTP
    const otp = generateOTP()
    const expiresAt = getOTPExpiryTime()

    await ctx.db.insert('emailVerifications', {
      userId,
      newEmail: trimmed,
      token: otp, // Store OTP in token field for backward compatibility
      expiresAt,
      createdAt: Date.now(),
      verified: false,
    })

    // Return the OTP - the frontend will call sendVerificationEmail action
    // This allows the email to be sent asynchronously without blocking the mutation

    return {
      success: true,
      message: `Verification code sent to ${trimmed}. Please check your inbox.`,
      otp: otp, // Always return OTP so frontend can trigger email sending
    }
  },
})

/**
 * Verify email change OTP and update user email
 */
/**
 * Verify email change using 6-digit OTP.
 * Updates user email if OTP is valid and not expired.
 */
export const verifyEmailChange = mutation({
  args: {
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const { otp } = args

    // Validate OTP format (should be 6 digits)
    const otpRegex = /^\d{6}$/
    if (!otpRegex.test(otp)) {
      throw new Error('Invalid OTP format. Please enter the 6-digit code.')
    }

    // Find verification record by OTP (stored in token field)
    const verification = await ctx.db
      .query('emailVerifications')
      .withIndex('by_token', (q) => q.eq('token', otp))
      .first()

    if (!verification) {
      throw new Error('Invalid verification code. Please check and try again.')
    }

    if (verification.verified) {
      throw new Error('This verification code has already been used')
    }

    if (verification.expiresAt < Date.now()) {
      throw new Error('Verification code has expired. Please request a new one.')
    }

    // Verify user still exists
    const user = await ctx.db.get(verification.userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Double-check email is still available
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', verification.newEmail))
      .first()

    if (existing && existing._id !== verification.userId) {
      throw new Error('Email is already in use by another account')
    }

    // Update user email
    await ctx.db.patch(verification.userId, {
      email: verification.newEmail,
    })

    // Mark verification as used
    await ctx.db.patch(verification._id, {
      verified: true,
    })

    // Get updated user
    const updatedUser = await ctx.db.get(verification.userId)
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user')
    }

    return {
      success: true,
      message: 'Email verified and updated successfully',
      user: updatedUser,
    }
  },
})

/**
 * Get pending email verification for a user.
 * Returns null if no pending verification exists or if expired.
 */
export const getPendingEmailVerification = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('emailVerifications')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('verified'), false))
      .order('desc')
      .first()

    if (!pending) {
      return null
    }

    if (pending.expiresAt < Date.now()) {
      return null // Expired
    }

    return {
      newEmail: pending.newEmail,
      expiresAt: pending.expiresAt,
      createdAt: pending.createdAt,
    }
  },
})

/**
 * Cancel pending email verification for a user.
 * Deletes all pending verification records.
 */
export const cancelPendingEmailVerification = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Delete all pending verifications for this user
    const pendingVerifications = await ctx.db
      .query('emailVerifications')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.eq(q.field('verified'), false))
      .collect()

    for (const verification of pendingVerifications) {
      await ctx.db.delete(verification._id)
    }

    return {
      success: true,
      message: 'Email verification cancelled',
      cancelledCount: pendingVerifications.length,
    }
  },
})

/**
 * Send email verification OTP via backend email service.
 * Uses ngrok URL in dev, BACKEND_URL in production.
 */
export const sendVerificationEmail = action({
  args: {
    userId: v.id('users'),
    newEmail: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, newEmail, otp } = args

    // Get user info
    const user = await ctx.runQuery(internal.auth.getUserByIdInternal, { userId })
    if (!user) {
      console.error('User not found for email verification')
      return
    }

    // Email content with OTP
    const emailSubject = 'Verify your email address change'
    const emailBody = `
Hello ${user.displayName || 'User'},

You requested to change your email address to ${newEmail}.

Your verification code is: ${otp}

Enter this code in the settings page to complete the email change.

This code will expire in 15 minutes.

If you did not request this change, please ignore this email.

Best regards,
RL Studio Team
    `.trim()

    // Send email via backend email service (Resend)
    // Use ngrok URL for local dev, or BACKEND_URL for production
    const BACKEND_URL = process.env.BACKEND_URL || process.env.NGROK_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${BACKEND_URL}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: newEmail,
          subject: emailSubject,
          body: emailBody,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          console.log('✅ Verification email sent via backend service to:', newEmail)
          return
        } else {
          console.error('Backend email service error:', result.message)
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Backend email service HTTP error:', response.status, errorText)
      }
    } catch (error) {
      console.error('Failed to send email via backend service:', error)
      // Fall through - OTP will be shown in UI
    }

    // If backend service not available, log OTP (for dev/testing)
    console.log('📧 OTP Generated (Backend email service not available):')
    console.log(`   To: ${newEmail}`)
    console.log(`   OTP: ${otp}`)
    console.log(`   Expires in: ${OTP_EXPIRY_MINUTES} minutes`)
    console.log('')
  },
})
