import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/conversations/:id/location — start sharing my live location
// Body: { lat, lng, duration (minutes, default 15) }
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
    const duration = Math.min(
      Math.max(Number(body?.duration ?? 15) || 15, 1),
      240 // cap at 4 hours
    )

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

    const expiresAt = new Date(Date.now() + duration * 60_000)

    // Replace any existing active share from this user in this conversation.
    // We do this by marking old ones as isLive=false, then create a new one.
    await db.locationShare.updateMany({
      where: {
        conversationId,
        userId: user.id,
        isLive: true,
      },
      data: { isLive: false },
    })

    const share = await db.locationShare.create({
      data: {
        conversationId,
        userId: user.id,
        lat,
        lng,
        expiresAt,
        isLive: true,
      },
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

    return ok({ share }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// GET /api/conversations/:id/location — list active location shares
// Returns shares where isLive=true AND expiresAt > now.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id: conversationId } = await ctx.params

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    const now = new Date()
    const shares = await db.locationShare.findMany({
      where: {
        conversationId,
        isLive: true,
        expiresAt: { gt: now },
      },
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
      orderBy: { createdAt: 'desc' },
    })

    return ok({ shares })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/conversations/:id/location — stop sharing my location
// (Sets isLive=false on my active shares in this conversation.)
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id: conversationId } = await ctx.params

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    await db.locationShare.updateMany({
      where: {
        conversationId,
        userId: user.id,
        isLive: true,
      },
      data: { isLive: false },
    })

    return ok({ stopped: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
