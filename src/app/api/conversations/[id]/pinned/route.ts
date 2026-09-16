import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/conversations/:id/pinned — list pinned messages in a conversation.
// Sorted by pinnedAt desc, limited to 10. Members only.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id,
        },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    const messages = await db.message.findMany({
      where: {
        conversationId: id,
        pinnedAt: { not: null },
        deletedAt: null,
      },
      orderBy: { pinnedAt: 'desc' },
      take: 10,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
            premiumTier: true,
            isOnline: true,
          },
        },
      },
    })

    return ok({
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: m.sender,
        content: m.content,
        type: m.type,
        mediaUrl: m.mediaUrl,
        voiceDuration: m.voiceDuration,
        stickerId: m.stickerId,
        pinnedAt: m.pinnedAt,
        createdAt: m.createdAt,
      })),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
