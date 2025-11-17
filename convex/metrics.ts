import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const get = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('metrics')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .order('asc')
      .collect()
  },
})

export const append = mutation({
  args: {
    runId: v.id('runs'),
    step: v.number(),
    reward: v.number(),
    loss: v.optional(v.number()),
    entropy: v.optional(v.number()),
    valueLoss: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('metrics', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

