import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/taly-requests?status=pending|approved|rejected
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const where: any = {}
    if (status) where.status = status

    const requests = await db.talyRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            isPremium: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ requests, total: requests.length })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/admin/taly-requests — approve/reject
// Body: { id, action: 'approve'|'reject', note? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { id, action, note } = body || {}
    if (!id) return jsonError(400, 'Request id required')
    if (action !== 'approve' && action !== 'reject') {
      return jsonError(400, "action must be 'approve' or 'reject'")
    }

    const request = await db.talyRequest.findUnique({ where: { id } })
    if (!request) return jsonError(404, 'Taly request not found')

    const status = action === 'approve' ? 'approved' : 'rejected'
    const updated = await db.talyRequest.update({
      where: { id },
      data: {
        status,
        adminNote: note || null,
        reviewedAt: new Date(),
      },
    })
    return ok(updated)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
