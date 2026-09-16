import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/notifications?unreadOnly=true|false
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'

    const where: any = { userId: user.id }
    if (unreadOnly) where.isRead = false

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.notification.count({
      where: { userId: user.id, isRead: false },
    })

    return ok({ notifications, unreadCount })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    if (e.status === 403) return jsonError(403, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/notifications — create system notification (admin only)
// Body: { userId, type, title, body }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const admin = await requireAdmin(req)
    void admin
    const body = await req.json().catch(() => ({}))
    const { userId, type, title, body: notifBody } = body || {}
    if (!userId || !type || !title) {
      return jsonError(400, 'userId, type, title are required')
    }
    const target = await db.user.findUnique({ where: { id: userId } })
    if (!target) return jsonError(404, 'Target user not found')

    const n = await db.notification.create({
      data: {
        userId,
        type: String(type),
        title: String(title),
        body: notifBody ? String(notifBody) : '',
      },
    })
    return ok(n, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    if (e.status === 403) return jsonError(403, e.message)
    return jsonError(500, e.message)
  }
}
