import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get asset type by key
export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("assetTypes")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

// List all asset types
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("assetTypes").collect();
  },
});

// Create asset type (admin only - typically seeded)
export const create = mutation({
  args: {
    key: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("assetTypes", {
      key: args.key,
      displayName: args.displayName,
    });
  },
});

