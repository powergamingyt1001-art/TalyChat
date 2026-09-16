import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>
}

// POST /api/groups/[id]/requests/[requestId]/reject
// - Owner/admin only.
// - Sets request status=rejected, decidedAt=now.
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, requestId } = await ctx.params

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only the group owner or admin can reject join requests')
    }

    const request = await db.groupRequest.findUnique({ where: { id: requestId } })
    if (!request || request.groupId !== id) {
      return jsonError(404, 'Join request not found')
    }
    if (request.status !== 'pending') {
      return jsonError(400, `Request already ${request.status}`)
    }

    await db.groupRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', decidedAt: new Date() },
    })

    return ok({ ok: true, id: requestId, status: 'rejected', groupId: id })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
