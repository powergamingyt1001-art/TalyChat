import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/messages/:id/read — mark a message as seen by the current user.
// Appends user.id to the message's `seenBy` comma-separated list (members only).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, conversationId: true, seenBy: true, deletedAt: true },
    })
    if (!message) return jsonError(404, 'Message not found')

    // Must be a member of the conversation.
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

    const seenIds = message.seenBy
      ? message.seenBy
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    if (!seenIds.includes(user.id)) {
      seenIds.push(user.id)
      await db.message.update({
        where: { id },
        data: { seenBy: seenIds.join(',') },
      })
    }

    // Also bump the member's lastReadAt so the conversation-level unread
    // indicator can be computed correctly.
    await db.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: user.id,
        },
      },
      data: { lastReadAt: new Date() },
    })

    return ok({ seen: true, seenBy: seenIds })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
