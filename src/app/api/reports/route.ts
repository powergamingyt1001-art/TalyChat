import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const VALID_REASONS = ['Spam', 'Harassment', 'Scam', 'Illegal', 'Fake', 'Other']

// GET /api/reports?status=pending|reviewed|resolved|dismissed (admin only)
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const where: any = {}
    if (status && ['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      where.status = status
    }
    const reports = await db.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, username: true, avatar: true } },
        reportedUser: { select: { id: true, name: true, username: true, avatar: true } },
        reportedGroup: { select: { id: true, name: true, category: true } },
      },
    })
    return ok({ reports })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/reports — create report
// Body: { reportedUserId?, reportedGroupId?, reason, description }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { reportedUserId, reportedGroupId, reason, description } = body || {}

    if (!reason || !VALID_REASONS.includes(reason)) {
      return jsonError(400, 'Invalid reason. Must be one of: ' + VALID_REASONS.join(', '))
    }
    if (!reportedUserId && !reportedGroupId) {
      return jsonError(400, 'reportedUserId or reportedGroupId is required')
    }

    // Idempotency per (reporter, reportedUser): don't allow same user to report
    // same person twice unless previous report is dismissed.
    if (reportedUserId) {
      if (reportedUserId === user.id) {
        return jsonError(400, 'Cannot report yourself')
      }
      const existing = await db.report.findFirst({
        where: {
          reporterId: user.id,
          reportedUserId,
          status: { not: 'dismissed' },
        },
      })
      if (existing) {
        return jsonError(409, 'You have already reported this user')
      }
    } else {
      // For group reports, also enforce idempotency
      const existing = await db.report.findFirst({
        where: {
          reporterId: user.id,
          reportedGroupId,
          status: { not: 'dismissed' },
        },
      })
      if (existing) {
        return jsonError(409, 'You have already reported this group')
      }
    }

    const report = await db.report.create({
      data: {
        reporterId: user.id,
        reportedUserId: reportedUserId || null,
        reportedGroupId: reportedGroupId || null,
        reason: String(reason),
        description: description ? String(description) : '',
        status: 'pending',
      },
    })

    // If reported user has >= 5 pending reports, auto-restrict for 24 hours.
    if (reportedUserId) {
      const thresholdSetting = await db.appSetting.findUnique({
        where: { key: 'report_restriction_threshold' },
      })
      const threshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 5
      const durationSetting = await db.appSetting.findUnique({
        where: { key: 'report_restriction_duration_hours' },
      })
      const hours = durationSetting ? parseInt(durationSetting.value, 10) : 24

      const pendingCount = await db.report.count({
        where: { reportedUserId, status: 'pending' },
      })
      if (pendingCount >= threshold) {
        await db.user.update({
          where: { id: reportedUserId },
          data: {
            isRestricted: true,
            restrictedUntil: new Date(Date.now() + hours * 60 * 60 * 1000),
          },
        })
      }
    }

    return ok(report, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
