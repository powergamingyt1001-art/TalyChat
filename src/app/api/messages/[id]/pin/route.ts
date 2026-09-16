import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/messages/:id/pin — toggle pin on a message.
// Body: { pin: boolean }. Sets pinnedAt = now() if pin=true, else null.
// Only conversation members can pin (groups: any member can pin).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { pin } = body || {}

    if (typeof pin !== 'boolean') {
      return jsonError(400, 'pin (boolean) is required')
    }

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, conversationId: true, deletedAt: true, pinnedAt: true },
    })
    if (!message) return jsonError(404, 'Message not found')
    if (message.deletedAt) {
      return jsonError(400, 'Cannot pin a deleted message')
    }

    // Must be a member of the conversation to pin.
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

    const updated = await db.message.update({
      where: { id },
      data: { pinnedAt: pin ? new Date() : null },
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
      message: {
        id: updated.id,
        conversationId: updated.conversationId,
        senderId: updated.senderId,
        sender: updated.sender,
        content: updated.content,
        type: updated.type,
        mediaUrl: updated.mediaUrl,
        voiceDuration: updated.voiceDuration,
        stickerId: updated.stickerId,
        pinnedAt: updated.pinnedAt,
        deletedAt: updated.deletedAt,
        createdAt: updated.createdAt,
      },
      pinned: pin,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
