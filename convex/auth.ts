import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { Id } from './_generated/dataModel'

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

export const findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email.toLowerCase()))
      .first()
  },
})


export const createUser = mutation({
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


export const createSession = mutation({
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

export const revokeSession = mutation({
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


export const getSessionByToken = query({
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
