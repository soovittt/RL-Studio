import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    runId: v.id('runs'),
    meanReward: v.number(),
    stdReward: v.number(),
    meanLength: v.number(),
    stdLength: v.number(),
    episodeRewards: v.array(v.number()),
    episodeLengths: v.array(v.number()),
    successRate: v.optional(v.number()),
    numEpisodes: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if evaluation already exists for this run
    const existing = await ctx.db
      .query('evaluations')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .first()

    if (existing) {
      // Update existing evaluation
      return await ctx.db.patch(existing._id, {
        ...args,
        evaluatedAt: Date.now(),
      })
    } else {
      // Create new evaluation
      return await ctx.db.insert('evaluations', {
        ...args,
        evaluatedAt: Date.now(),
      })
    }
  },
})

export const get = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('evaluations')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .first()
  },
})
