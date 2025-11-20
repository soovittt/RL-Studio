import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List templates with filters
export const list = query({
  args: {
    mode: v.optional(v.string()),
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Use index only if isPublic is explicitly provided
    let templates;
    if (args.isPublic !== undefined) {
      templates = await ctx.db
        .query("templates")
        .withIndex("by_public", (q) => q.eq("isPublic", args.isPublic as boolean))
        .collect();
    } else {
      templates = await ctx.db.query("templates").collect();
    }

    // Filter by mode and category in memory
    return templates.filter((template) => {
      if (args.mode && template.meta?.mode !== args.mode) return false;
      if (args.category && template.category !== args.category) return false;
      return true;
    });
  },
});

// Get template with scene version
export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return null;

    const sceneVersion = await ctx.db.get(template.sceneVersionId);
    return {
      template,
      sceneVersion,
    };
  },
});

// Create template
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    sceneVersionId: v.id("sceneVersions"),
    category: v.optional(v.string()),
    tags: v.array(v.string()),
    meta: v.optional(v.any()),
    isPublic: v.boolean(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("templates", {
      name: args.name,
      description: args.description,
      sceneVersionId: args.sceneVersionId,
      category: args.category,
      tags: args.tags,
      meta: args.meta || {},
      isPublic: args.isPublic,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

// Instantiate template into a new scene
export const instantiate = mutation({
  args: {
    templateId: v.id("templates"),
    projectId: v.id("environments"),
    name: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get template and scene version
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const sceneVersion = await ctx.db.get(template.sceneVersionId);
    if (!sceneVersion) {
      throw new Error("Scene version not found");
    }

    // Create new scene
    const sceneId = await ctx.db.insert("scenes", {
      projectId: args.projectId,
      name: args.name || template.name,
      description: template.description,
      mode: sceneVersion.sceneGraph?.metadata?.mode || "grid",
      environmentSettings: {},
      activeVersionId: undefined,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create new scene version (version 1) with copied data
    const newVersionId = await ctx.db.insert("sceneVersions", {
      sceneId: sceneId,
      versionNumber: 1,
      sceneGraph: JSON.parse(JSON.stringify(sceneVersion.sceneGraph)), // Deep copy
      rlConfig: JSON.parse(JSON.stringify(sceneVersion.rlConfig)), // Deep copy
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });

    // Set active version
    await ctx.db.patch(sceneId, {
      activeVersionId: newVersionId,
    });

    return {
      sceneId,
      versionId: newVersionId,
    };
  },
});

