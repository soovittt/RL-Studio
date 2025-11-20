/**
 * Seed script to populate initial asset types and assets
 * Run this via Convex dashboard or CLI
 * Assets are created as GLOBAL (projectId = undefined) so they're available to all users
 */
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Get or create system user for seeding global assets/templates
 * System user email: system@rl-studio.local
 */
async function getOrCreateSystemUser(ctx: any): Promise<Id<"users">> {
  const systemEmail = "system@rl-studio.local";
  
  // Try to find existing system user
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", systemEmail))
    .first();
  
  if (existing) {
    return existing._id;
  }
  
  // Create system user if doesn't exist
  const systemUserId = await ctx.db.insert("users", {
    authProviderId: `system:${Date.now()}`,
    email: systemEmail,
    displayName: "RL Studio System",
    plan: "free",
  });
  
  return systemUserId;
}

// Asset types to create
const ASSET_TYPES = [
  { key: "tile", displayName: "Tile" },
  { key: "character", displayName: "Character" },
  { key: "vehicle", displayName: "Vehicle" },
  { key: "prop", displayName: "Prop" },
  { key: "prefab", displayName: "Prefab" },
];

// Initial grid assets
const GRID_ASSETS = [
  {
    name: "Wall",
    assetTypeKey: "tile",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 0.1,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#1b263b",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["wall", "obstacle", "grid"],
      mode: "grid",
      paletteColor: "#1b263b",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Agent",
    assetTypeKey: "character",
    geometry: {
      primitive: "cylinder",
      params: {
        radiusTop: 0.4,
        radiusBottom: 0.4,
        height: 0.4,
        radialSegments: 32,
      },
    },
    visualProfile: {
      color: "#4a90e2",
      labelColor: "#ffffff",
      size: [0.8, 0.8, 0.8],
    },
    physicsProfile: {
      collider: "box",
      dynamic: true,
    },
    behaviorProfile: {
      speed: 1.0,
    },
    meta: {
      tags: ["agent", "player", "grid"],
      mode: "grid",
      paletteColor: "#4a90e2",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Goal",
    assetTypeKey: "tile",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 0.1,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#50c878",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      trigger: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["goal", "reward", "grid"],
      mode: "grid",
      paletteColor: "#50c878",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Key",
    assetTypeKey: "prop",
    geometry: {
      primitive: "sphere",
      params: {
        radius: 0.3,
        widthSegments: 16,
        heightSegments: 16,
      },
    },
    visualProfile: {
      color: "#ffd700",
      labelColor: "#000000",
      size: [0.6, 0.6, 0.6],
    },
    physicsProfile: {
      collider: "box",
      trigger: true,
    },
    behaviorProfile: {
      collectible: true,
    },
    meta: {
      tags: ["key", "collectible", "grid"],
      mode: "grid",
      paletteColor: "#ffd700",
      labelColor: "#000000",
      palette: "primary",
    },
  },
  {
    name: "Door",
    assetTypeKey: "prop",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 1.5,
        depth: 0.1,
      },
    },
    visualProfile: {
      color: "#8b4513",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {
      locked: true,
      requiresKey: true,
    },
    meta: {
      tags: ["door", "obstacle", "grid"],
      mode: "grid",
      paletteColor: "#8b4513",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Trap",
    assetTypeKey: "tile",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 0.1,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#dc143c",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      trigger: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["trap", "hazard", "grid"],
      mode: "grid",
      paletteColor: "#dc143c",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Checkpoint",
    assetTypeKey: "tile",
    geometry: {
      primitive: "cylinder",
      params: {
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 0.1,
        radialSegments: 32,
      },
    },
    visualProfile: {
      color: "#9370db",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      trigger: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["checkpoint", "waypoint", "grid"],
      mode: "grid",
      paletteColor: "#9370db",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Moving Obstacle",
    assetTypeKey: "character",
    geometry: {
      primitive: "box",
      params: {
        width: 0.8,
        height: 0.8,
        depth: 0.8,
      },
    },
    visualProfile: {
      color: "#ff6347",
      labelColor: "#ffffff",
      size: [0.8, 0.8, 0.8],
    },
    physicsProfile: {
      collider: "box",
      dynamic: true,
    },
    behaviorProfile: {
      speed: 0.5,
      patrol: true,
    },
    meta: {
      tags: ["obstacle", "moving", "grid"],
      mode: "grid",
      paletteColor: "#ff6347",
      labelColor: "#ffffff",
      palette: "secondary",
    },
  },
  {
    name: "Floor",
    assetTypeKey: "tile",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 0.05,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#f5f5f5",
      labelColor: "#000000",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["floor", "ground", "grid"],
      mode: "grid",
      paletteColor: "#f5f5f5",
      labelColor: "#000000",
      palette: "secondary",
    },
  },
  {
    name: "Spawn Point",
    assetTypeKey: "tile",
    geometry: {
      primitive: "cylinder",
      params: {
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 0.05,
        radialSegments: 32,
      },
    },
    visualProfile: {
      color: "#87ceeb",
      labelColor: "#000000",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      trigger: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["spawn", "reset", "grid"],
      mode: "grid",
      paletteColor: "#87ceeb",
      labelColor: "#000000",
      palette: "secondary",
    },
  },
  // Vehicle assets
  {
    name: "Car",
    assetTypeKey: "vehicle",
    geometry: {
      primitive: "box",
      params: {
        width: 2,
        height: 1,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#ff0000",
      labelColor: "#ffffff",
      size: [2, 1, 1],
    },
    physicsProfile: {
      collider: "box",
      dynamic: true,
      mass: 1000,
    },
    behaviorProfile: {
      maxSpeed: 10,
      maxSteering: 0.5,
      acceleration: 5,
    },
    meta: {
      tags: ["vehicle", "car", "driving", "2d", "3d"],
      mode: "2d",
      paletteColor: "#ff0000",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Truck",
    assetTypeKey: "vehicle",
    geometry: {
      primitive: "box",
      params: {
        width: 3,
        height: 1.5,
        depth: 1.5,
      },
    },
    visualProfile: {
      color: "#8b4513",
      labelColor: "#ffffff",
      size: [3, 1.5, 1.5],
    },
    physicsProfile: {
      collider: "box",
      dynamic: true,
      mass: 2000,
    },
    behaviorProfile: {
      maxSpeed: 8,
      maxSteering: 0.3,
      acceleration: 3,
    },
    meta: {
      tags: ["vehicle", "truck", "driving", "2d", "3d"],
      mode: "2d",
      paletteColor: "#8b4513",
      labelColor: "#ffffff",
      palette: "secondary",
    },
  },
  // 3D-specific assets
  {
    name: "3D Agent",
    assetTypeKey: "character",
    geometry: {
      primitive: "cylinder",
      params: {
        radiusTop: 0.25,
        radiusBottom: 0.25,
        height: 1,
        radialSegments: 32,
      },
    },
    visualProfile: {
      color: "#4a90e2",
      labelColor: "#ffffff",
      size: [0.5, 1, 0.5],
    },
    physicsProfile: {
      collider: "capsule",
      dynamic: true,
      mass: 1,
    },
    behaviorProfile: {
      speed: 2.0,
      jumpHeight: 1.0,
    },
    meta: {
      tags: ["agent", "3d", "character"],
      mode: "3d",
      paletteColor: "#4a90e2",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "3D Obstacle",
    assetTypeKey: "prop",
    geometry: {
      primitive: "box",
      params: {
        width: 1,
        height: 2,
        depth: 1,
      },
    },
    visualProfile: {
      color: "#696969",
      labelColor: "#ffffff",
      size: [1, 2, 1],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["obstacle", "3d", "prop"],
      mode: "3d",
      paletteColor: "#696969",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Platform",
    assetTypeKey: "prop",
    geometry: {
      primitive: "box",
      params: {
        width: 3,
        height: 0.2,
        depth: 3,
      },
    },
    visualProfile: {
      color: "#d3d3d3",
      labelColor: "#000000",
      size: [3, 0.2, 3],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["platform", "3d", "prop"],
      mode: "3d",
      paletteColor: "#d3d3d3",
      labelColor: "#000000",
      palette: "secondary",
    },
  },
  // Continuous 2D assets
  {
    name: "Continuous Agent",
    assetTypeKey: "character",
    geometry: {
      primitive: "sphere",
      params: {
        radius: 0.25,
        widthSegments: 16,
        heightSegments: 16,
      },
    },
    visualProfile: {
      color: "#00bfff",
      labelColor: "#ffffff",
      size: [0.5, 0.5, 0.5],
    },
    physicsProfile: {
      collider: "circle",
      dynamic: true,
      mass: 1,
    },
    behaviorProfile: {
      speed: 2.0,
    },
    meta: {
      tags: ["agent", "2d", "continuous", "character"],
      mode: "2d",
      paletteColor: "#00bfff",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  {
    name: "Continuous Obstacle",
    assetTypeKey: "prop",
    geometry: {
      primitive: "cylinder",
      params: {
        radiusTop: 0.5,
        radiusBottom: 0.5,
        height: 0.1,
        radialSegments: 32,
      },
    },
    visualProfile: {
      color: "#808080",
      labelColor: "#ffffff",
      size: [1, 1, 1],
    },
    physicsProfile: {
      collider: "circle",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["obstacle", "2d", "continuous", "prop"],
      mode: "2d",
      paletteColor: "#808080",
      labelColor: "#ffffff",
      palette: "primary",
    },
  },
  // Prefab example: Road Intersection (composed from multiple assets)
  {
    name: "Road Intersection",
    assetTypeKey: "prefab",
    geometry: {
      primitive: "box",
      params: {
        width: 4,
        height: 0.1,
        depth: 4,
      },
    },
    visualProfile: {
      color: "#555555",
      labelColor: "#ffffff",
      size: [4, 4, 1],
    },
    physicsProfile: {
      collider: "box",
      static: true,
    },
    behaviorProfile: {},
    meta: {
      tags: ["prefab", "road", "intersection", "grid"],
      mode: "grid",
      paletteColor: "#555555",
      labelColor: "#ffffff",
      palette: "secondary",
      prefabChildren: [
        // This would be resolved when instantiating the prefab
        { assetName: "Floor", position: [0, 0, 0] },
        { assetName: "Wall", position: [-1, 0, 0] },
        { assetName: "Wall", position: [1, 0, 0] },
        { assetName: "Wall", position: [0, 0, -1] },
        { assetName: "Wall", position: [0, 0, 1] },
      ],
    },
  },
];

/**
 * Seed asset types
 */
export const seedAssetTypes = mutation({
  handler: async (ctx) => {
    const results = [];
    for (const assetType of ASSET_TYPES) {
      // Check if already exists
      const existing = await ctx.db
        .query("assetTypes")
        .withIndex("by_key", (q) => q.eq("key", assetType.key))
        .first();
      
      if (!existing) {
        const id = await ctx.db.insert("assetTypes", assetType);
        results.push({ action: "created", id, key: assetType.key });
      } else {
        results.push({ action: "skipped", id: existing._id, key: assetType.key });
      }
    }
    return results;
  },
});

/**
 * Seed assets (requires asset types to be seeded first)
 * If createdBy is not provided, uses system user
 */
export const seedAssets = mutation({
  args: {
    createdBy: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, args) => {
    // Use system user if not provided (handle both undefined and null)
    const createdBy = (args.createdBy !== undefined && args.createdBy !== null) 
      ? args.createdBy 
      : await getOrCreateSystemUser(ctx);
    const results = [];
    
    for (const assetData of GRID_ASSETS) {
      // Get asset type
      const assetType = await ctx.db
        .query("assetTypes")
        .withIndex("by_key", (q) => q.eq("key", assetData.assetTypeKey))
        .first();
      
      if (!assetType) {
        results.push({
          action: "error",
          name: assetData.name,
          error: `Asset type '${assetData.assetTypeKey}' not found`,
        });
        continue;
      }

      // Check if asset already exists (by name, for global assets)
      const existing = await ctx.db
        .query("assets")
        .filter((q) => 
          q.and(
            q.eq(q.field("name"), assetData.name),
            q.eq(q.field("projectId"), undefined)
          )
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("assets", {
          projectId: undefined, // Global asset
          assetTypeId: assetType._id,
          name: assetData.name,
          slug: assetData.name.toLowerCase().replace(/\s+/g, "-"),
          thumbnailUrl: undefined,
          modelUrl: undefined,
          geometry: assetData.geometry || undefined,
          visualProfile: assetData.visualProfile,
          physicsProfile: assetData.physicsProfile,
          behaviorProfile: assetData.behaviorProfile,
          meta: assetData.meta,
          createdBy: createdBy,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        results.push({ action: "created", id, name: assetData.name });
      } else {
        results.push({ action: "skipped", id: existing._id, name: assetData.name });
      }
    }
    
    return results;
  },
});

/**
 * Seed everything (asset types + assets)
 * If createdBy is not provided, uses system user
 */
export const seedAll = mutation({
  args: {
    createdBy: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, args) => {
    // Use system user if not provided (handle both undefined and null)
    const createdBy = (args.createdBy !== undefined && args.createdBy !== null) 
      ? args.createdBy 
      : await getOrCreateSystemUser(ctx);
    // Seed asset types first
    const assetTypeResults = [];
    for (const assetType of ASSET_TYPES) {
      const existing = await ctx.db
        .query("assetTypes")
        .withIndex("by_key", (q) => q.eq("key", assetType.key))
        .first();
      
      if (!existing) {
        const id = await ctx.db.insert("assetTypes", assetType);
        assetTypeResults.push({ action: "created", id, key: assetType.key });
      } else {
        assetTypeResults.push({ action: "skipped", id: existing._id, key: assetType.key });
      }
    }

    // Then seed assets
    const assetResults = [];
    for (const assetData of GRID_ASSETS) {
      const assetType = await ctx.db
        .query("assetTypes")
        .withIndex("by_key", (q) => q.eq("key", assetData.assetTypeKey))
        .first();
      
      if (!assetType) {
        assetResults.push({
          action: "error",
          name: assetData.name,
          error: `Asset type '${assetData.assetTypeKey}' not found`,
        });
        continue;
      }

      const existing = await ctx.db
        .query("assets")
        .filter((q) => 
          q.and(
            q.eq(q.field("name"), assetData.name),
            q.eq(q.field("projectId"), undefined)
          )
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("assets", {
          projectId: undefined,
          assetTypeId: assetType._id,
          name: assetData.name,
          slug: assetData.name.toLowerCase().replace(/\s+/g, "-"),
          thumbnailUrl: undefined,
          modelUrl: undefined,
          visualProfile: assetData.visualProfile,
          physicsProfile: assetData.physicsProfile,
          behaviorProfile: assetData.behaviorProfile,
          meta: assetData.meta,
          createdBy: createdBy,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        assetResults.push({ action: "created", id, name: assetData.name });
      } else {
        assetResults.push({ action: "skipped", id: existing._id, name: assetData.name });
      }
    }
    
    return {
      assetTypes: assetTypeResults,
      assets: assetResults,
    };
  },
});

