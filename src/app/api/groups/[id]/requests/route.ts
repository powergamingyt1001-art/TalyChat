import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/groups/[id]/requests — owner/admin only — list pending join requests
// Returns: { requests: [...], total: N }
export async function GET(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only the group owner or admin can view join requests')
    }

    const requests = await db.groupRequest.findMany({
      where: { groupId: id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true,
            gender: true,
            isOnline: true,
            isPremium: true,
            lastSeen: true,
            createdAt: true,
          },
        },
      },
    })

    return ok({
      requests: requests.map((r) => ({
        id: r.id,
        groupId: r.groupId,
        senderId: r.senderId,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        sender: r.sender,
      })),
      total: requests.length,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
