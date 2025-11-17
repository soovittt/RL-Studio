import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: { envId: v.id('environments'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rolloutHistory')
      .withIndex('by_env_created', (q) => q.eq('envId', args.envId))
      .order('desc')
      .take(args.limit || 20)
  },
})

export const get = query({
  args: { id: v.id('rolloutHistory') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    envId: v.id('environments'),
    ownerId: v.id('users'),
    policy: v.union(v.literal('random'), v.literal('greedy')),
    result: v.any(), // SimulatorResult
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('rolloutHistory', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const deleteHistory = mutation({
  args: { id: v.id('rolloutHistory') },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error('Rollout history not found')
    return await ctx.db.delete(args.id)
  },
})

export const clearForEnvironment = mutation({
  args: { envId: v.id('environments') },
  handler: async (ctx, args) => {
    const histories = await ctx.db
      .query('rolloutHistory')
      .withIndex('by_env', (q) => q.eq('envId', args.envId))
      .collect()
    
    for (const history of histories) {
      await ctx.db.delete(history._id)
    }
    
    return { deleted: histories.length }
  },
})

