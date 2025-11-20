import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_status')
      .order('desc')
      .take(10)
  },
})

export const get = query({
  args: { id: v.id('runs') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const getBySkyPilotJobId = query({
  args: { skyPilotJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_skyPilotJobId', (q) => q.eq('skyPilotJobId', args.skyPilotJobId))
      .first()
  },
})

export const getConfig = query({
  args: { runId: v.id('runs') },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId)
    if (!run) throw new Error('Run not found')

    const env = await ctx.db.get(run.envId)
    if (!env) throw new Error('Environment not found')

    // Use universal EnvSpec if available, otherwise fall back to legacy spec
    const envSpec = env.envSpec || env.spec || {}

    return {
      algorithm: run.algorithm,
      hyperparams: run.hyperparams,
      concepts: run.concepts,
      environment: {
        type: env.type || env.envType || 'grid',
        spec: envSpec, // Universal EnvSpec format
      },
    }
  },
})

export const create = mutation({
  args: {
    envId: v.id('environments'),
    ownerId: v.id('users'),
    algorithm: v.union(v.literal('ppo'), v.literal('dqn')),
    concepts: v.object({
      rewardShaping: v.boolean(),
      curriculum: v.boolean(),
      imitation: v.boolean(),
      explorationBonus: v.boolean(),
    }),
    hyperparams: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('runs', {
      ...args,
      status: 'queued',
    })
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id('runs'),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('error')
    ),
    skyPilotJobId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, status, skyPilotJobId } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error('Run not found')

    const updates: any = { status }
    if (status === 'running' && !existing.startedAt) {
      updates.startedAt = Date.now()
    }
    if (status === 'completed' || status === 'error') {
      updates.completedAt = Date.now()
    }
    if (skyPilotJobId) {
      updates.skyPilotJobId = skyPilotJobId
    }

    return await ctx.db.patch(id, updates)
  },
})

export const updateSkyPilotMetadata = mutation({
  args: {
    id: v.id('runs'),
    skyPilotStatus: v.optional(v.string()),
    skyPilotResources: v.optional(v.any()),
    skyPilotCost: v.optional(v.number()),
    skyPilotDuration: v.optional(v.union(v.number(), v.string())),
    skyPilotLogs: v.optional(v.string()),
    lastLogUpdate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error('Run not found')

    // Convert skyPilotDuration from string to number if needed
    const patchUpdates: any = { ...updates }
    if (patchUpdates.skyPilotDuration !== undefined && typeof patchUpdates.skyPilotDuration === 'string') {
      const numValue = parseFloat(patchUpdates.skyPilotDuration)
      if (!isNaN(numValue)) {
        patchUpdates.skyPilotDuration = numValue
      } else {
        delete patchUpdates.skyPilotDuration
      }
    }

    return await ctx.db.patch(id, patchUpdates)
  },
})
