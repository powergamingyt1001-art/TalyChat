import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/conversations/:id/location/update — update my live position
// Body: { lat, lng }
//
// Updates my most recent active LocationShare in this conversation. If
// there is no active share, returns 404 so the client knows to start a
// new share instead.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id: conversationId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const lat = Number(body?.lat)
    const lng = Number(body?.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonError(400, 'lat and lng are required and must be numbers')
    }

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // Find the user's most recent active share in this conversation.
    const existing = await db.locationShare.findFirst({
      where: {
        conversationId,
        userId: user.id,
        isLive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!existing) {
      return jsonError(404, 'No active location share to update')
    }

    const updated = await db.locationShare.update({
      where: { id: existing.id },
      data: { lat, lng },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
            premiumTier: true,
          },
        },
      },
    })

    return ok({ share: updated })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
