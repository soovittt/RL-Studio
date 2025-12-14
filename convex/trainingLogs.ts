import { defineTable } from 'convex/server'
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const get = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('trainingLogs')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .order('desc')
      .take(1000) // Get last 1000 log entries
  },
})

export const append = mutation({
  args: {
    runId: v.id('runs'),
    logLevel: v.union(
      v.literal('info'),
      v.literal('warning'),
      v.literal('error'),
      v.literal('debug')
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('trainingLogs', {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const clear = mutation({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query('trainingLogs')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .collect()

    for (const log of logs) {
      await ctx.db.delete(log._id)
    }

    return { deleted: logs.length }
  },
})


