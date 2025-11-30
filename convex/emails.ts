import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Store received email in database.
 * Called by backend webhook when email is received via Resend.
 */
export const storeReceived = mutation({
  args: {
    emailId: v.string(),
    fromEmail: v.string(),
    toEmails: v.array(v.string()),
    subject: v.string(),
    receivedAt: v.string(), // ISO timestamp
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          filename: v.string(),
          content_type: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query('receivedEmails')
      .withIndex('by_emailId', (q) => q.eq('emailId', args.emailId))
      .first()

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        processed: false, // Reset processed status
        receivedAt: args.receivedAt,
      })
      return { id: existing._id, created: false }
    }

    // Create new record
    const emailId = await ctx.db.insert('receivedEmails', {
      emailId: args.emailId,
      fromEmail: args.fromEmail,
      toEmails: args.toEmails,
      subject: args.subject,
      receivedAt: args.receivedAt,
      attachments: args.attachments || [],
      processed: false,
      autoReplied: false,
      createdAt: Date.now(),
    })

    return { id: emailId, created: true }
  },
})

/**
 * Mark received email as processed.
 */
export const markProcessed = mutation({
  args: {
    emailId: v.string(),
    autoReplied: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query('receivedEmails')
      .withIndex('by_emailId', (q) => q.eq('emailId', args.emailId))
      .first()

    if (!email) {
      throw new Error(`Email ${args.emailId} not found`)
    }

    await ctx.db.patch(email._id, {
      processed: true,
      autoReplied: args.autoReplied ?? email.autoReplied,
    })

    return { success: true }
  },
})

/**
 * List received emails (most recent first).
 */
export const list = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50
    const emails = await ctx.db.query('receivedEmails').order('desc').take(limit)

    return emails
  },
})
