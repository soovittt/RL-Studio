import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// List assets with filters
export const list = query({
  args: {
    projectId: v.optional(v.id("environments")),
    assetTypeId: v.optional(v.id("assetTypes")),
    mode: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use index for projectId if provided, otherwise use full table scan
    let assets;
    if (args.projectId !== undefined) {
      assets = await ctx.db
        .query("assets")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else {
      assets = await ctx.db.query("assets").collect();
    }

    // Filter by assetTypeId in memory if provided
    if (args.assetTypeId) {
      assets = assets.filter((asset) => asset.assetTypeId === args.assetTypeId);
    }

    // Filter by projectId if null (global assets only)
    if (args.projectId === null) {
      assets = assets.filter((asset) => asset.projectId === undefined);
    }

    // Filter by mode and tag in memory (could be optimized with indexes)
    return assets.filter((asset) => {
      if (args.mode && asset.meta?.mode !== args.mode) return false;
      if (args.tag && !asset.meta?.tags?.includes(args.tag)) return false;
      return true;
    });
  },
});

// Get asset by ID
export const get = query({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create asset
export const create = mutation({
  args: {
    projectId: v.optional(v.id("environments")),
    assetTypeId: v.id("assetTypes"),
    name: v.string(),
    slug: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    modelUrl: v.optional(v.string()),
    geometry: v.optional(v.any()), // Procedural geometry: { primitive: 'rectangle'|'box'|'sphere'|'cylinder'|'curve', params: {...} }
    visualProfile: v.any(),
    physicsProfile: v.any(),
    behaviorProfile: v.any(),
    meta: v.any(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("assets", {
      projectId: args.projectId,
      assetTypeId: args.assetTypeId,
      name: args.name,
      slug: args.slug,
      thumbnailUrl: args.thumbnailUrl,
      modelUrl: args.modelUrl,
      geometry: args.geometry,
      visualProfile: args.visualProfile,
      physicsProfile: args.physicsProfile,
      behaviorProfile: args.behaviorProfile,
      meta: args.meta,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update asset
export const update = mutation({
  args: {
    id: v.id("assets"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    modelUrl: v.optional(v.string()),
    geometry: v.optional(v.any()),
    visualProfile: v.optional(v.any()),
    physicsProfile: v.optional(v.any()),
    behaviorProfile: v.optional(v.any()),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const asset = await ctx.db.get(id);
    if (!asset) {
      throw new Error("Asset not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Check if asset is referenced in any scene versions
export const checkReferences = query({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => {
    // Get all scene versions
    const sceneVersions = await ctx.db.query("sceneVersions").collect();
    
    const references: Array<{ sceneId: string; versionId: string; entityId: string }> = [];
    
    for (const version of sceneVersions) {
      const entities = version.sceneGraph?.entities || [];
      for (const entity of entities) {
        if (entity.assetId === args.id) {
          references.push({
            sceneId: version.sceneId,
            versionId: version._id,
            entityId: entity.id,
          });
        }
      }
    }
    
    return references;
  },
});

// Delete asset
export const remove = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (!asset) {
      throw new Error("Asset not found");
    }
    
    // Check if asset is referenced in any scene versions
    const references = await ctx.runQuery(api.assets.checkReferences, { id: args.id });
    if (references.length > 0) {
      throw new Error(
        `Cannot delete asset: it is referenced in ${references.length} scene version(s). ` +
        `Please remove the asset from all scenes before deleting.`
      );
    }
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Clone asset
export const clone = mutation({
  args: {
    assetId: v.id("assets"),
    projectId: v.optional(v.id("environments")),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      throw new Error("Asset not found");
    }

    const now = Date.now();
    return await ctx.db.insert("assets", {
      projectId: args.projectId,
      assetTypeId: asset.assetTypeId,
      name: `${asset.name} (Copy)`,
      slug: asset.slug,
      thumbnailUrl: asset.thumbnailUrl,
      modelUrl: asset.modelUrl,
      geometry: asset.geometry,
      visualProfile: asset.visualProfile,
      physicsProfile: asset.physicsProfile,
      behaviorProfile: asset.behaviorProfile,
      meta: asset.meta,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

