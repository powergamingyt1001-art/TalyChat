import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/groups/requests/sent — list group join requests SENT by the current user.
// Returns: { requests: [...], total: N }
// Each item: { id, groupId, message, status, createdAt, decidedAt,
//              group: { id, name, logo, category, isPublic, membersCount, inviteCode, ownerId } }
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const requests = await db.groupRequest.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            logo: true,
            category: true,
            isPublic: true,
            membersCount: true,
            inviteCode: true,
            ownerId: true,
          },
        },
      },
    })

    return ok({
      requests: requests.map((r: any) => ({
        id: r.id,
        groupId: r.groupId,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        group: r.group,
      })),
      total: requests.length,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
