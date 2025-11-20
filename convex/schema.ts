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
    // SkyPilot metadata
    skyPilotStatus: v.optional(v.string()), // PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED
    skyPilotResources: v.optional(v.any()), // GPU type, instance type, etc.
    skyPilotCost: v.optional(v.number()), // Estimated cost
    skyPilotDuration: v.optional(v.number()), // Duration in seconds
    skyPilotLogs: v.optional(v.string()), // Latest logs (truncated)
    lastLogUpdate: v.optional(v.number()), // Timestamp of last log update
  })
    .index('by_owner', ['ownerId'])
    .index('by_env', ['envId'])
    .index('by_status', ['status'])
    .index('by_skyPilotJobId', ['skyPilotJobId']),

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

  trainingLogs: defineTable({
    runId: v.id('runs'),
    logLevel: v.union(v.literal('info'), v.literal('warning'), v.literal('error'), v.literal('debug')),
    message: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_run', ['runId'])
    .index('by_run_created', ['runId', 'createdAt']),

  // New schema for Figma-style scene builder
  assetTypes: defineTable({
    key: v.string(), // 'character', 'vehicle', 'prop', 'tile', 'prefab'
    displayName: v.string(),
  })
    .index('by_key', ['key']),

  assets: defineTable({
    projectId: v.optional(v.id('environments')), // NULL = global asset
    assetTypeId: v.id('assetTypes'),
    name: v.string(),
    slug: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    modelUrl: v.optional(v.string()), // 3D model, sprite, or optional for abstract
    geometry: v.optional(v.any()), // procedural geometry: { primitive: 'rectangle' | 'box' | 'sphere' | 'cylinder' | 'curve', params: {...} }
    visualProfile: v.any(), // colors, size, sprite info, etc.
    physicsProfile: v.any(), // mass, collider, friction, etc.
    behaviorProfile: v.any(), // speed, health, AI params...
    meta: v.any(), // tags, paletteColor, labelColor, etc.
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_type', ['assetTypeId'])
    .index('by_created', ['createdAt'])
    .index('by_name', ['name']),

  scenes: defineTable({
    projectId: v.optional(v.id('environments')), // NULL = global scene (for templates)
    name: v.string(),
    description: v.optional(v.string()),
    mode: v.string(), // '2d', '3d', 'grid', 'topdown', etc.
    environmentSettings: v.any(), // gravity, time-step, lighting, etc.
    activeVersionId: v.optional(v.id('sceneVersions')),
    createdBy: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project', ['projectId'])
    .index('by_mode', ['mode'])
    .index('by_created', ['createdAt']),

  sceneVersions: defineTable({
    sceneId: v.id('scenes'),
    versionNumber: v.number(),
    sceneGraph: v.any(), // full entity/component graph
    rlConfig: v.any(), // RL configuration
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_scene', ['sceneId'])
    .index('by_scene_version', ['sceneId', 'versionNumber']),

  templates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    sceneVersionId: v.id('sceneVersions'),
    category: v.optional(v.string()), // 'grid', 'road', 'maze', 'navigation', 'traffic'
    tags: v.array(v.string()),
    meta: v.optional(v.any()), // difficulty, taskFamily, supportedAlgos, etc.
    isPublic: v.boolean(),
    createdBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_category', ['category'])
    .index('by_public', ['isPublic'])
    .index('by_created', ['createdAt']),
})

