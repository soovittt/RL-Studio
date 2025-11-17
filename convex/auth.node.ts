"use node"

import { action } from './_generated/server'
import { v } from 'convex/values'
import { api } from './_generated/api'

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
  handler: async (ctx, args) => {
    const crypto = require('crypto')
    
    if (args.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    if (!args.email.includes('@') || !args.email.includes('.')) {
      throw new Error('Invalid email address')
    }

    const existing = await ctx.runQuery(api.auth.findUserByEmail, {
      email: args.email.toLowerCase(),
    })

    if (existing) {
      throw new Error('User with this email already exists')
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(args.password, salt, 1000, 64, 'sha512').toString('hex')
    const passwordHash = `${salt}:${hash}`
    const authProviderId = `password:${crypto.randomUUID()}`

    const userId = await ctx.runMutation(api.auth.createUser, {
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
  handler: async (ctx, args) => {
    const crypto = require('crypto')
    
    const user = await ctx.runQuery(api.auth.findUserByEmail, {
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

    await ctx.runMutation(api.auth.createSession, {
      userId: user._id,
      token,
      expiresAt,
    })

    return { token, userId: user._id, expiresAt }
  },
})

export const refreshToken = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const crypto = require('crypto')
    
    const session = await ctx.runQuery(api.auth.getSessionByToken, {
      token: args.token,
    })

    if (!session || session.expiresAt < Date.now()) {
      throw new Error('Invalid or expired token')
    }

    const user = await ctx.runQuery(api.auth.getUserById, {
      userId: session.userId,
    })

    if (!user) {
      throw new Error('User not found')
    }

    const newToken = crypto.randomBytes(TOKEN_LENGTH).toString('hex')
    const expiresAt = getExpiryTime()

    await ctx.runMutation(api.auth.revokeSession, { token: args.token })
    await ctx.runMutation(api.auth.createSession, {
      userId: user._id,
      token: newToken,
      expiresAt,
    })

    return { token: newToken, expiresAt }
  },
})

