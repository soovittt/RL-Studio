import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    runId: v.id('runs'),
    modelUrl: v.string(),
    modelPath: v.string(),
    algorithm: v.string(),
    hyperparams: v.any(),
    evaluationId: v.optional(v.id('evaluations')),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if model already exists for this run
    const existing = await ctx.db
      .query('models')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .first()

    if (existing) {
      // Update existing model
      return await ctx.db.patch(existing._id, {
        ...args,
        uploadedAt: Date.now(),
      })
    } else {
      // Create new model
      return await ctx.db.insert('models', {
        ...args,
        uploadedAt: Date.now(),
      })
    }
  },
})

export const get = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('models')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .first()
  },
})
