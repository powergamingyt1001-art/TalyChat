import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/notifications/read — mark all (or by id) as read
// Body: { id? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { id } = body || {}

    if (id) {
      // Verify ownership before marking
      const n = await db.notification.findUnique({ where: { id } })
      if (!n) return jsonError(404, 'Notification not found')
      if (n.userId !== user.id) return jsonError(403, 'Not your notification')
      await db.notification.update({
        where: { id },
        data: { isRead: true },
      })
    } else {
      await db.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      })
    }
    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
