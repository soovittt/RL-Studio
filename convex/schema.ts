import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    authProviderId: v.string(),
    email: v.string(),
    displayName: v.string(),
    passwordHash: v.optional(v.string()),
    autumnCustomerId: v.optional(v.string()),
    plan: v.union(v.literal('free'), v.literal('pro')),
  }).index('by_auth', ['authProviderId'])
    .index('by_email', ['email']),

      environments: defineTable({
        ownerId: v.id('users'),
        name: v.string(),
        description: v.optional(v.string()),
        // Universal EnvSpec structure
        envSpec: v.optional(v.any()), // Full universal EnvSpec object
        // Legacy fields for backward compatibility (will be migrated)
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
        spec: v.optional(v.any()),
        type: v.optional(v.union(v.literal('grid'), v.literal('continuous'))),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    .index('by_owner', ['ownerId'])
    .index('by_created', ['createdAt'])
    .index('by_envType', ['envType']),

  runs: defineTable({
    envId: v.id('environments'),
    ownerId: v.id('users'),
    status: v.union(
      v.literal('queued'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('error')
    ),
    algorithm: v.union(v.literal('ppo'), v.literal('dqn')),
    concepts: v.object({
      rewardShaping: v.boolean(),
      curriculum: v.boolean(),
      imitation: v.boolean(),
      explorationBonus: v.boolean(),
    }),
    hyperparams: v.any(),
    skyPilotJobId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_owner', ['ownerId'])
    .index('by_env', ['envId'])
    .index('by_status', ['status']),

  metrics: defineTable({
    runId: v.id('runs'),
    step: v.number(),
    reward: v.number(),
    loss: v.optional(v.number()),
    entropy: v.optional(v.number()),
    valueLoss: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_run', ['runId'])
    .index('by_run_step', ['runId', 'step']),

  rolloutFrames: defineTable({
    runId: v.id('runs'),
    step: v.number(),
    frameUrl: v.string(),
  })
    .index('by_run', ['runId'])
    .index('by_run_step', ['runId', 'step']),

  rolloutHistory: defineTable({
    envId: v.id('environments'),
    ownerId: v.id('users'),
    policy: v.union(v.literal('random'), v.literal('greedy')),
    result: v.any(), // SimulatorResult
    createdAt: v.number(),
  })
    .index('by_env', ['envId'])
    .index('by_owner', ['ownerId'])
    .index('by_env_created', ['envId', 'createdAt']),

  sessions: defineTable({
    userId: v.id('users'),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId'])
    .index('by_expires', ['expiresAt']),
})

