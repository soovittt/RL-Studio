import { query } from './_generated/server'
import { v } from 'convex/values'

export const getLatest = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    const frames = await ctx.db
      .query('rolloutFrames')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .order('desc')
      .take(1)

    return frames[0] || null
  },
})

export const list = query({
  args: { runId: v.id('runs'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('rolloutFrames')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .order('desc')
      .take(args.limit || 10)
  },
})
