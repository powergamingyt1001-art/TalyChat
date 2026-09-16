import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/blocks — list users I blocked
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const blocks = await db.block.findMany({
      where: { blockerId: user.id },
      include: {
        blocked: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isOnline: true,
            isPremium: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return ok({ blocks: blocks.map((b) => ({ ...b.blocked, blockedAt: b.createdAt })) })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/blocks — block user. Body: { blockedId }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { blockedId } = body || {}
    if (!blockedId) return jsonError(400, 'blockedId is required')

    if (blockedId === user.id) return jsonError(400, 'Cannot block yourself')

    const target = await db.user.findUnique({ where: { id: blockedId } })
    if (!target) return jsonError(404, 'User not found')
    if (target.role === 'admin') return jsonError(403, 'Cannot block an admin')

    // upsert block (idempotent)
    const block = await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
      update: {},
      create: { blockerId: user.id, blockedId },
    })

    // Delete any private conversation between them (or leave them).
    // We find private conversations that have both users as members.
    const myConvs = await db.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    })
    const theirConvs = await db.conversationMember.findMany({
      where: { userId: blockedId },
      select: { conversationId: true },
    })
    const myIds = new Set(myConvs.map((m) => m.conversationId))
    const shared = theirConvs
      .map((m) => m.conversationId)
      .filter((id) => myIds.has(id))

    if (shared.length > 0) {
      const privateConvs = await db.conversation.findMany({
        where: { id: { in: shared }, type: 'private' },
        select: { id: true },
      })
      if (privateConvs.length > 0) {
        // Delete conversations (cascade members + messages)
        await db.conversation.deleteMany({
          where: { id: { in: privateConvs.map((c) => c.id) } },
        })
      }
    }

    return ok(block, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/blocks — unblock. Body: { blockedId }
export async function DELETE(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { blockedId } = body || {}
    if (!blockedId) return jsonError(400, 'blockedId is required')

    await db.block.deleteMany({
      where: { blockerId: user.id, blockedId },
    })
    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
