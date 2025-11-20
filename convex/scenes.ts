import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get scene with active version
export const get = query({
  args: { id: v.id("scenes") },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.id);
    if (!scene) return null;

    let activeVersion = null;
    if (scene.activeVersionId) {
      activeVersion = await ctx.db.get(scene.activeVersionId);
    }

    return {
      scene,
      activeVersion,
    };
  },
});

// List scenes by project (or global scenes if projectId is undefined)
export const listByProject = query({
  args: { projectId: v.optional(v.id("environments")) },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("scenes")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      // Return global scenes (projectId is undefined)
      return await ctx.db
        .query("scenes")
        .filter((q) => q.eq(q.field("projectId"), undefined))
        .collect();
    }
  },
});

// Create scene (projectId is optional - undefined = global scene for templates)
export const create = mutation({
  args: {
    projectId: v.optional(v.id("environments")),
    name: v.string(),
    description: v.optional(v.string()),
    mode: v.string(),
    environmentSettings: v.any(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("scenes", {
      projectId: args.projectId, // Can be undefined for global template scenes
      name: args.name,
      description: args.description,
      mode: args.mode,
      environmentSettings: args.environmentSettings || {},
      activeVersionId: undefined,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update scene
export const update = mutation({
  args: {
    id: v.id("scenes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    mode: v.optional(v.string()),
    environmentSettings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const scene = await ctx.db.get(id);
    if (!scene) {
      throw new Error("Scene not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Get scene version
export const getVersion = query({
  args: {
    sceneId: v.id("scenes"),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sceneVersions")
      .withIndex("by_scene_version", (q) =>
        q.eq("sceneId", args.sceneId).eq("versionNumber", args.versionNumber)
      )
      .first();
  },
});

// List all versions for a scene
export const listVersions = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sceneVersions")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
  },
});

// Get scene version by ID (for compile service)
export const getVersionById = query({
  args: { id: v.id("sceneVersions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create scene version
export const createVersion = mutation({
  args: {
    sceneId: v.id("scenes"),
    sceneGraph: v.any(),
    rlConfig: v.any(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get current max version number
    const existingVersions = await ctx.db
      .query("sceneVersions")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();

    const maxVersion = existingVersions.length > 0
      ? Math.max(...existingVersions.map((v) => v.versionNumber))
      : 0;

    const newVersionNumber = maxVersion + 1;

    const versionId = await ctx.db.insert("sceneVersions", {
      sceneId: args.sceneId,
      versionNumber: newVersionNumber,
      sceneGraph: args.sceneGraph,
      rlConfig: args.rlConfig || {},
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });

    // Update scene's active version
    await ctx.db.patch(args.sceneId, {
      activeVersionId: versionId,
      updatedAt: Date.now(),
    });

    return versionId;
  },
});

