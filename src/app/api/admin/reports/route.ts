import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/reports?status=pending|reviewed|resolved|dismissed
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const where: any = {}
    if (status) where.status = status

    const reports = await db.report.findMany({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            isRestricted: true,
            isBlocked: true,
          },
        },
        reportedGroup: {
          select: {
            id: true,
            name: true,
            category: true,
            logo: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ reports, total: reports.length })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/admin/reports — review a report
// Body: { id, action: 'approve'|'reject', note? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { id, action, note } = body || {}
    if (!id) return jsonError(400, 'Report id required')
    if (action !== 'approve' && action !== 'reject') {
      return jsonError(400, "action must be 'approve' or 'reject'")
    }

    const report = await db.report.findUnique({ where: { id } })
    if (!report) return jsonError(404, 'Report not found')

    if (action === 'approve') {
      // Apply restriction to reported user if not already
      if (report.reportedUserId) {
        const u = await db.user.findUnique({ where: { id: report.reportedUserId } })
        if (u && !u.isRestricted) {
          // Apply 24h restriction by default (admin can override later)
          const until = new Date()
          until.setHours(until.getHours() + 24)
          await db.user.update({
            where: { id: u.id },
            data: { isRestricted: true, restrictedUntil: until },
          })
        }
      }
      const updated = await db.report.update({
        where: { id },
        data: {
          status: 'resolved',
          adminNote: note || null,
          updatedAt: new Date(),
        },
      })
      return ok(updated)
    }

    // reject
    const updated = await db.report.update({
      where: { id },
      data: {
        status: 'dismissed',
        adminNote: note || null,
        updatedAt: new Date(),
      },
    })
    return ok(updated)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
