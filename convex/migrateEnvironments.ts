/**
 * Migration action to convert existing environments to scenes
 * This Convex action can be called to migrate all environments
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Type assertion to work around circular dependency in codegen
// The API types are available, but using 'as any' prevents TypeScript from
// complaining about the circular reference during type checking
const typedApi = api as any;

/**
 * Migrate a single environment to scene format
 */
export const migrateEnvironment = action({
  args: {
    environmentId: v.id("environments"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get environment from old system
    const env = await ctx.runQuery(typedApi.environments.get, {
      id: args.environmentId,
    });

    if (!env) {
      return {
        action: "error",
        reason: "Environment not found",
        environmentId: args.environmentId,
      };
    }

    // Check if scene already exists by checking if a scene with this projectId exists
    const existingScenes = await ctx.runQuery(typedApi.scenes.listByProject, {
      projectId: args.environmentId,
    });
    if (existingScenes && existingScenes.length > 0) {
      return {
        action: "skipped",
        reason: "Scene already exists",
        environmentId: args.environmentId,
        sceneId: existingScenes[0]._id,
      };
    }

    if (args.dryRun) {
      return {
        action: "would_migrate",
        environmentId: args.environmentId,
        name: env.name,
      };
    }

    // Convert EnvSpec to sceneGraph + rlConfig
    // For now, we'll use a simplified conversion
    // In production, you'd use the proper converters
    
    // Load EnvSpec
    let envSpec: any;
    if (env.envSpec) {
      envSpec = env.envSpec;
    } else {
      // Convert from legacy format
      envSpec = {
        id: env._id,
        name: env.name,
        type: env.envType || env.type || "grid",
        world: {
          type: env.envType || env.type || "grid",
          width: 10,
          height: 10,
          coordinateSystem: env.envType || env.type || "grid",
        },
        objects: [],
        agents: env.agents || [],
        rules: {
          rewards: env.reward?.rules || [],
          terminations: [],
        },
        episode: env.episode || { maxSteps: 100 },
        metadata: env.metadata || { tags: [] },
      };
    }

    // Determine mode
    const mode = envSpec.type === "grid" ? "grid" : "2d";

    // Create scene
    const sceneId = await ctx.runMutation(typedApi.scenes.create, {
      projectId: args.environmentId,
      name: env.name,
      description: env.description,
      mode: mode,
      environmentSettings: {},
      createdBy: env.ownerId,
    });

    // Convert to sceneGraph + rlConfig
    // This is simplified - in production, use proper converters
    const sceneGraph = {
      entities: [],
      metadata: {
        gridConfig: envSpec.world?.coordinateSystem === "grid"
          ? { rows: envSpec.world.height || 10, cols: envSpec.world.width || 10 }
          : undefined,
        tags: envSpec.metadata?.tags || [],
      },
    };

    const rlConfig = {
      agents: (envSpec.agents || []).map((agent: any) => ({
        agentId: agent.id || "agent_1",
        entityId: agent.id || "agent_1",
        role: "learning_agent",
        actionSpace: {
          type: "discrete",
          actions: ["move_up", "move_down", "move_left", "move_right"],
        },
        observationSpace: {
          type: "box",
          shape: [2],
          low: [0, 0],
          high: [9, 9],
        },
      })),
      rewards: (envSpec.rules?.rewards || []).map((rule: any, i: number) => ({
        id: `reward_${i}`,
        trigger: {
          type: rule.condition?.type || "step",
        },
        amount: rule.value || rule.reward || 0,
      })),
      episode: {
        maxSteps: envSpec.episode?.maxSteps || 100,
        terminationConditions: [],
        reset: {
          type: "fixed_spawns",
          spawns: [],
        },
      },
    };

    // Create initial version
    const versionId = await ctx.runMutation(typedApi.scenes.createVersion, {
      sceneId: sceneId,
      sceneGraph: sceneGraph,
      rlConfig: rlConfig,
      createdBy: env.ownerId,
    });

    return {
      action: "migrated",
      environmentId: args.environmentId,
      sceneId: sceneId,
      versionId: versionId,
      name: env.name,
    };
  },
});

/**
 * Migrate all environments
 */
export const migrateAllEnvironments = action({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get all environments
    const environments = await ctx.runQuery(typedApi.environments.list, {
      limit: args.limit,
    });

    const limit = args.limit || environments.length;
    const environmentsToMigrate = environments.slice(0, limit);

    const results = [];

    for (const env of environmentsToMigrate) {
      try {
        const result = await ctx.runAction(typedApi.migrateEnvironments.migrateEnvironment, {
          environmentId: env._id,
          dryRun: args.dryRun || false,
        });
        results.push(result);
      } catch (error: any) {
        results.push({
          action: "error",
          reason: error.message,
          environmentId: env._id,
        });
      }
    }

    return {
      total: environmentsToMigrate.length,
      results: results,
      summary: {
        migrated: results.filter((r) => r.action === "migrated").length,
        skipped: results.filter((r) => r.action === "skipped").length,
        errors: results.filter((r) => r.action === "error").length,
      },
    };
  },
});

