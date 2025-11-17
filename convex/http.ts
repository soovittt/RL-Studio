import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { api } from './_generated/api'

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

      await ctx.runMutation(api.metrics.append, {
        runId,
        step,
        reward,
        loss,
        entropy,
        valueLoss,
      })
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to save metrics' }),
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

      await ctx.runMutation(api.auth.revokeSession, { token })
      
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

export default http
