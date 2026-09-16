import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/messages/:id/reaction — toggle a reaction by the current user.
// Body: { emoji }. One reaction per user per message (replace). If the same
// emoji already exists for the user, remove it (toggle off).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { emoji } = body || {}

    if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
      return jsonError(400, 'emoji is required')
    }
    const normalized = emoji.trim()

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, conversationId: true, deletedAt: true },
    })
    if (!message) return jsonError(404, 'Message not found')
    if (message.deletedAt) {
      return jsonError(400, 'Cannot react to a deleted message')
    }

    // Must be a member of the conversation to react.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: user.id,
        },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // Schema enforces @@unique([messageId, userId]) — one reaction per user per message.
    const existing = await db.reaction.findUnique({
      where: {
        messageId_userId: { messageId: id, userId: user.id },
      },
    })

    if (existing) {
      if (existing.emoji === normalized) {
        // Same emoji already set — remove it (toggle off)
        await db.reaction.delete({ where: { id: existing.id } })
      } else {
        // Different emoji — replace
        await db.reaction.update({
          where: { id: existing.id },
          data: { emoji: normalized },
        })
      }
    } else {
      await db.reaction.create({
        data: { messageId: id, userId: user.id, emoji: normalized },
      })
    }

    const reactions = await db.reaction.findMany({
      where: { messageId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Resolve user info separately — the Reaction model has no `user` relation.
    const userIds = Array.from(new Set(reactions.map((r) => r.userId)))
    const users =
      userIds.length === 0
        ? []
        : await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, name: true, avatar: true },
          })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return ok({
      reactions: reactions.map((r) => ({
        id: r.id,
        messageId: r.messageId,
        userId: r.userId,
        emoji: r.emoji,
        user: userMap.get(r.userId) || null,
        createdAt: r.createdAt,
      })),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
