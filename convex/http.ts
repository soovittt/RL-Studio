import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api, internal } from './_generated/api'

// Import trainingLogs API (will be generated)
// Note: This will be available after Convex generates types

const http = httpRouter()

http.route({
  path: '/metrics',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { runId, step, reward, loss, entropy, valueLoss } = await request.json()
      
      if (!runId || step === undefined || reward === undefined) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: runId, step, reward' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Validate runId is a valid Convex ID
      if (typeof runId !== 'string' || !runId.startsWith('j')) {
        return new Response(
          JSON.stringify({ error: 'Invalid runId format. Must be a Convex ID.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Save metrics to database
      await ctx.runMutation(api.metrics.append, {
        runId: runId as any, // Convex ID type
        step: Number(step),
        reward: Number(reward),
        loss: loss !== undefined && loss !== null ? Number(loss) : undefined,
        entropy: entropy !== undefined && entropy !== null ? Number(entropy) : undefined,
        valueLoss: valueLoss !== undefined && valueLoss !== null ? Number(valueLoss) : undefined,
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      console.error('Failed to save metrics:', error)
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to save metrics' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/trainingLogs',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { runId, logLevel, message, metadata } = await request.json()
      
      if (!runId || !message) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: runId, message' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await ctx.runMutation(api.trainingLogs.append, {
        runId: runId as any,
        logLevel: logLevel || 'info',
        message: String(message),
        metadata: metadata || {},
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      console.error('Failed to save training log:', error)
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to save log' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }),
})

http.route({
  path: '/auth/revoke',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { token } = await request.json()
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await ctx.runMutation((internal as any).auth.revokeSession, { token })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to revoke session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// HTTP action wrappers for backend services
// These allow the Python backend to call Convex queries/mutations via HTTP

http.route({
  path: '/api/scenes/get',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      const result = await ctx.runQuery(api.scenes.get, { id: id as any })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/scenes/create',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.scenes.create, {
        projectId: data.projectId as any,
        name: data.name,
        description: data.description,
        mode: data.mode,
        environmentSettings: data.environmentSettings || {},
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/scenes/update',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const { id, ...updates } = data
      await ctx.runMutation(api.scenes.update, {
        id: id as any,
        ...updates,
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/scenes/createVersion',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.scenes.createVersion, {
        sceneId: data.sceneId as any,
        sceneGraph: data.sceneGraph,
        rlConfig: data.rlConfig || {},
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/scenes/getVersion',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { sceneId, versionNumber } = await request.json()
      const result = await ctx.runQuery(api.scenes.getVersion, {
        sceneId: sceneId as any,
        versionNumber: versionNumber,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/scenes/listVersions',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { sceneId } = await request.json()
      const result = await ctx.runQuery(api.scenes.listVersions, {
        sceneId: sceneId as any,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// AssetTypes HTTP actions
http.route({
  path: '/api/assetTypes/getByKey',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { key } = await request.json()
      const result = await ctx.runQuery(api.assetTypes.getByKey, { key })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// Assets HTTP actions
http.route({
  path: '/api/assets/list',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runQuery(api.assets.list, {
        projectId: data.projectId as any,
        assetTypeId: data.assetTypeId as any,
        mode: data.mode,
        tag: data.tag,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/get',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      const result = await ctx.runQuery(api.assets.get, { id: id as any })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/create',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.assets.create, {
        projectId: data.projectId as any,
        assetTypeId: data.assetTypeId as any,
        name: data.name,
        slug: data.slug,
        thumbnailUrl: data.thumbnailUrl,
        modelUrl: data.modelUrl,
        visualProfile: data.visualProfile || {},
        physicsProfile: data.physicsProfile || {},
        behaviorProfile: data.behaviorProfile || {},
        meta: data.meta || {},
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/update',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const { id, ...updates } = data
      await ctx.runMutation(api.assets.update, {
        id: id as any,
        ...updates,
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/checkReferences',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      const result = await ctx.runQuery(api.assets.checkReferences, { id: id as any })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/delete',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      await ctx.runMutation(api.assets.remove, { id: id as any })
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/assets/clone',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.assets.clone, {
        assetId: data.assetId as any,
        projectId: data.projectId as any,
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// Templates HTTP actions
http.route({
  path: '/api/templates/list',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runQuery(api.templates.list, {
        mode: data.mode,
        category: data.category,
        isPublic: data.isPublic,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/templates/get',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      const result = await ctx.runQuery(api.templates.get, { id: id as any })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/templates/create',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.templates.create, {
        name: data.name,
        description: data.description,
        sceneVersionId: data.sceneVersionId as any,
        category: data.category,
        tags: data.tags || [],
        meta: data.meta || {},
        isPublic: data.isPublic !== undefined ? data.isPublic : true,
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/templates/instantiate',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json()
      const result = await ctx.runMutation(api.templates.instantiate, {
        templateId: data.templateId as any,
        projectId: data.projectId as any,
        name: data.name,
        createdBy: data.createdBy as any,
      })
      return new Response(JSON.stringify({ value: result }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// Seed HTTP actions
http.route({
  path: '/api/seed/seedAssetTypes',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const result = await ctx.runMutation(api.seed.seedAssetTypes, {})
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/seed/seedAssets',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { createdBy } = await request.json()
      const result = await ctx.runMutation(api.seed.seedAssets, {
        createdBy: createdBy as any,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

http.route({
  path: '/api/seed/seedAll',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { createdBy } = await request.json()
      const result = await ctx.runMutation(api.seed.seedAll, {
        createdBy: createdBy as any,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// Scene Versions HTTP actions
http.route({
  path: '/api/sceneVersions/getById',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { id } = await request.json()
      const result = await ctx.runQuery(api.scenes.getVersionById, {
        id: id as any,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

// Template seeding HTTP action
http.route({
  path: '/api/seed/seedTemplates',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const { projectId, createdBy } = await request.json()
      const result = await ctx.runMutation(api.seedTemplates.seedTemplates, {
        projectId: projectId as any,
        createdBy: createdBy as any,
      })
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }),
})

export default http
