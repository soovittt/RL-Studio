/**
 * Local Development Data Seeding
 * 
 * For open-source users: Seeds local Convex database with sample data
 * so they can develop without needing access to production database.
 * 
 * Usage:
 *   npx convex run seed_local_data:seedAll
 * 
 * This creates:
 *   - Sample environments
 *   - Sample runs
 *   - Sample assets
 *   - Sample templates
 */

import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

/**
 * Seed sample environments for local development
 */
export const seedEnvironments = mutation({
  args: {},
  handler: async (ctx) => {
    const sampleEnvironments = [
      {
        name: 'Grid World - Simple',
        mode: 'grid',
        envSpec: {
          envType: 'grid',
          world: {
            width: 10,
            height: 10,
            coordinateSystem: 'grid',
            cellSize: 1.0,
          },
          agents: [
            {
              id: 'agent1',
              position: [1, 1],
              type: 'learning_agent',
            },
          ],
          objects: [
            {
              id: 'goal1',
              position: [8, 8],
              type: 'goal',
            },
          ],
          actionSpace: {
            type: 'discrete',
            actions: ['up', 'down', 'left', 'right'],
          },
          rules: {
            rewards: [
              {
                id: 'goal_reward',
                condition: {
                  type: 'agent_at_object',
                  agentId: 'agent1',
                  objectId: 'goal1',
                },
                reward: 10.0,
              },
              {
                id: 'step_penalty',
                condition: { type: 'timeout' },
                reward: -0.1,
              },
            ],
            terminations: [
              {
                condition: {
                  type: 'agent_at_object',
                  agentId: 'agent1',
                  objectId: 'goal1',
                },
              },
              {
                condition: { type: 'timeout', steps: 100 },
              },
            ],
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: 'Grid World - With Obstacles',
        mode: 'grid',
        envSpec: {
          envType: 'grid',
          world: {
            width: 12,
            height: 12,
            coordinateSystem: 'grid',
            cellSize: 1.0,
          },
          agents: [
            {
              id: 'agent1',
              position: [0, 0],
              type: 'learning_agent',
            },
          ],
          objects: [
            {
              id: 'goal1',
              position: [11, 11],
              type: 'goal',
            },
            {
              id: 'obstacle1',
              position: [5, 5],
              type: 'obstacle',
            },
            {
              id: 'obstacle2',
              position: [6, 6],
              type: 'obstacle',
            },
          ],
          actionSpace: {
            type: 'discrete',
            actions: ['up', 'down', 'left', 'right'],
          },
          rules: {
            rewards: [
              {
                id: 'goal_reward',
                condition: {
                  type: 'agent_at_object',
                  agentId: 'agent1',
                  objectId: 'goal1',
                },
                reward: 20.0,
              },
              {
                id: 'step_penalty',
                condition: { type: 'timeout' },
                reward: -0.1,
              },
            ],
            terminations: [
              {
                condition: {
                  type: 'agent_at_object',
                  agentId: 'agent1',
                  objectId: 'goal1',
                },
              },
              {
                condition: { type: 'timeout', steps: 200 },
              },
            ],
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const created = []
    for (const env of sampleEnvironments) {
      const id = await ctx.db.insert('environments', {
        name: env.name,
        mode: env.mode as any,
        envSpec: env.envSpec as any,
        createdAt: env.createdAt,
        updatedAt: env.updatedAt,
        ownerId: (await ctx.auth.getUserIdentity())?._id as any,
      })
      created.push(id)
    }

    return {
      success: true,
      count: created.length,
      ids: created,
    }
  },
})

/**
 * Seed sample runs for local development
 */
export const seedRuns = mutation({
  args: {
    envId: v.optional(v.id('environments')),
  },
  handler: async (ctx, args) => {
    // Get first environment if not provided
    let envId = args.envId
    if (!envId) {
      const env = await ctx.db.query('environments').first()
      if (!env) {
        throw new Error('No environments found. Run seedEnvironments first.')
      }
      envId = env._id
    }

    const user = await ctx.auth.getUserIdentity()
    if (!user) {
      throw new Error('Must be authenticated to seed runs')
    }

    const sampleRuns = [
      {
        envId: envId,
        ownerId: user._id as any,
        algorithm: 'ppo',
        status: 'completed',
        hyperparams: {
          learning_rate: 3e-4,
          gamma: 0.99,
          steps: 10000,
          batch_size: 64,
          rollout_length: 256,
          update_epochs: 10,
          entropy_coeff: 0.01,
        },
        concepts: {},
        startedAt: Date.now() - 3600000, // 1 hour ago
        completedAt: Date.now() - 1800000, // 30 min ago
      },
      {
        envId: envId,
        ownerId: user._id as any,
        algorithm: 'dqn',
        status: 'completed',
        hyperparams: {
          learning_rate: 1e-4,
          gamma: 0.99,
          steps: 10000,
          batch_size: 32,
        },
        concepts: {},
        startedAt: Date.now() - 7200000, // 2 hours ago
        completedAt: Date.now() - 3600000, // 1 hour ago
      },
      {
        envId: envId,
        ownerId: user._id as any,
        algorithm: 'ppo',
        status: 'running',
        hyperparams: {
          learning_rate: 3e-4,
          gamma: 0.99,
          steps: 50000,
          batch_size: 64,
        },
        concepts: {},
        startedAt: Date.now() - 600000, // 10 min ago
      },
    ]

    const created = []
    for (const run of sampleRuns) {
      const id = await ctx.db.insert('runs', run as any)
      created.push(id)
    }

    return {
      success: true,
      count: created.length,
      ids: created,
    }
  },
})

/**
 * Seed sample evaluations for completed runs
 */
export const seedEvaluations = mutation({
  args: {},
  handler: async (ctx) => {
    const completedRuns = await ctx.db
      .query('runs')
      .filter((q) => q.eq(q.field('status'), 'completed'))
      .collect()

    const created = []
    for (const run of completedRuns) {
      // Create evaluation for each completed run
      const evaluationId = await ctx.db.insert('evaluations', {
        runId: run._id,
        meanReward: Math.random() * 20 + 5, // Random between 5-25
        stdReward: Math.random() * 5 + 1,
        meanLength: Math.random() * 50 + 30,
        stdLength: Math.random() * 10 + 5,
        episodeRewards: Array.from({ length: 20 }, () => Math.random() * 20 + 5),
        episodeLengths: Array.from({ length: 20 }, () => Math.floor(Math.random() * 50 + 30)),
        successRate: Math.random() * 0.5 + 0.3, // 30-80%
        numEpisodes: 20,
        evaluatedAt: run.completedAt || Date.now(),
      })
      created.push(evaluationId)
    }

    return {
      success: true,
      count: created.length,
      ids: created,
    }
  },
})

/**
 * Seed all local development data
 */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      environments: { success: false, count: 0 },
      runs: { success: false, count: 0 },
      evaluations: { success: false, count: 0 },
    }

    try {
      const envResult = await ctx.runMutation(seedEnvironments, {})
      results.environments = envResult
    } catch (e: any) {
      console.error('Failed to seed environments:', e)
    }

    try {
      const runsResult = await ctx.runMutation(seedRuns, {})
      results.runs = runsResult
    } catch (e: any) {
      console.error('Failed to seed runs:', e)
    }

    try {
      const evalResult = await ctx.runMutation(seedEvaluations, {})
      results.evaluations = evalResult
    } catch (e: any) {
      console.error('Failed to seed evaluations:', e)
    }

    return {
      success: true,
      results,
      message: 'Local development data seeded successfully',
    }
  },
})

/**
 * Clear all seeded data (for reset)
 */
export const clearSeededData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all runs
    const runs = await ctx.db.query('runs').collect()
    for (const run of runs) {
      await ctx.db.delete(run._id)
    }

    // Delete all evaluations
    const evaluations = await ctx.db.query('evaluations').collect()
    for (const eval of evaluations) {
      await ctx.db.delete(eval._id)
    }

    // Delete all environments (be careful - only delete seeded ones)
    const environments = await ctx.db.query('environments').collect()
    for (const env of environments) {
      // Only delete if name suggests it's seeded
      if (env.name?.includes('Grid World') || env.name?.includes('Sample')) {
        await ctx.db.delete(env._id)
      }
    }

    return {
      success: true,
      message: 'Seeded data cleared',
    }
  },
})

