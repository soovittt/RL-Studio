import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('environments')
      .withIndex('by_created')
      .order('desc')
      .take(10)
  },
})

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('environments')
      .withIndex('by_created')
      .order('desc')
    
    if (args.limit) {
      return await query.take(args.limit)
    }
    
    return await query.collect()
  },
})

export const get = query({
  args: { id: v.id('environments') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: {
    ownerId: v.id('users'),
    name: v.string(),
    description: v.optional(v.string()),
    // Universal EnvSpec (preferred)
    envSpec: v.optional(v.any()),
    // Legacy fields for backward compatibility
    envType: v.optional(v.union(
      v.literal('grid'),
      v.literal('continuous2d'),
      v.literal('graph'),
      v.literal('bandit'),
      v.literal('custom')
    )),
    stateSpace: v.optional(v.any()),
    actionSpace: v.optional(v.any()),
    dynamics: v.optional(v.any()),
    reward: v.optional(v.any()),
    agents: v.optional(v.array(v.any())),
    episode: v.optional(v.any()),
    curriculum: v.optional(v.any()),
    visuals: v.optional(v.any()),
    metadata: v.optional(v.object({
      tags: v.array(v.string()),
      notes: v.optional(v.string()),
    })),
    type: v.optional(v.union(v.literal('grid'), v.literal('continuous'))),
    spec: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const { ownerId, name, description, envSpec, ...rest } = args
    
    return await ctx.db.insert('environments', {
      ownerId,
      name,
      description,
      envSpec: envSpec || null,
      // Legacy fields for backward compatibility
      envType: rest.envType || (rest.type === 'continuous' ? 'continuous2d' : 'grid'),
      stateSpace: rest.stateSpace || null,
      actionSpace: rest.actionSpace || null,
      dynamics: rest.dynamics || null,
      reward: rest.reward || null,
      agents: rest.agents || [],
      episode: rest.episode || null,
      curriculum: rest.curriculum || { stages: [] },
      visuals: rest.visuals || null,
      metadata: rest.metadata || { tags: [], notes: '' },
      type: rest.type,
      spec: rest.spec || null,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('environments'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    // Universal EnvSpec (preferred)
    envSpec: v.optional(v.any()),
    // Legacy fields for backward compatibility
    envType: v.optional(v.union(
      v.literal('grid'),
      v.literal('continuous2d'),
      v.literal('graph'),
      v.literal('bandit'),
      v.literal('custom')
    )),
    stateSpace: v.optional(v.any()),
    actionSpace: v.optional(v.any()),
    dynamics: v.optional(v.any()),
    reward: v.optional(v.any()),
    agents: v.optional(v.array(v.any())),
    episode: v.optional(v.any()),
    curriculum: v.optional(v.any()),
    visuals: v.optional(v.any()),
    metadata: v.optional(v.object({
      tags: v.array(v.string()),
      notes: v.optional(v.string()),
    })),
    // Legacy fields
    spec: v.optional(v.any()),
    type: v.optional(v.union(v.literal('grid'), v.literal('continuous'))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error('Environment not found')
    
    // Build update object, only including defined fields
    const updateObj: any = {
      updatedAt: Date.now(),
    }
    
    if (updates.name !== undefined) updateObj.name = updates.name
    if (updates.description !== undefined) updateObj.description = updates.description
    if (updates.envSpec !== undefined) updateObj.envSpec = updates.envSpec
    // Legacy fields
    if (updates.envType !== undefined) updateObj.envType = updates.envType
    if (updates.stateSpace !== undefined) updateObj.stateSpace = updates.stateSpace
    if (updates.actionSpace !== undefined) updateObj.actionSpace = updates.actionSpace
    if (updates.dynamics !== undefined) updateObj.dynamics = updates.dynamics
    if (updates.reward !== undefined) updateObj.reward = updates.reward
    if (updates.agents !== undefined) updateObj.agents = updates.agents
    if (updates.episode !== undefined) updateObj.episode = updates.episode
    if (updates.curriculum !== undefined) updateObj.curriculum = updates.curriculum
    if (updates.visuals !== undefined) updateObj.visuals = updates.visuals
    if (updates.metadata !== undefined) updateObj.metadata = updates.metadata
    if (updates.spec !== undefined) updateObj.spec = updates.spec
    if (updates.type !== undefined) updateObj.type = updates.type
    
    return await ctx.db.patch(id, updateObj)
  },
})

export const deleteEnvironment = mutation({
  args: {
    id: v.id('environments'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing) throw new Error('Environment not found')
    
    // TODO: Check if there are any runs associated with this environment
    // and prevent deletion if there are active runs
    
    return await ctx.db.delete(args.id)
  },
})

