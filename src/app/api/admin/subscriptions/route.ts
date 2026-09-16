import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/subscriptions?status=active|expired|all
// Returns all Subscription records with user info.
// - active: isActive=true AND expireAt > now
// - expired: isActive=false OR expireAt <= now
// - all: no filter (default)
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const status = (url.searchParams.get('status') || 'all').toLowerCase()
    const now = new Date()

    const where: any = {}
    if (status === 'active') {
      where.isActive = true
      where.expireAt = { gt: now }
    } else if (status === 'expired') {
      where.OR = [
        { isActive: false },
        { expireAt: { lte: now } },
      ]
    }

    const subscriptions = await db.subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            isPremium: true,
            premiumUntil: true,
            role: true,
            isBlocked: true,
          },
        },
      },
    })

    return ok({
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        userId: s.userId,
        plan: s.plan,
        amount: s.amount,
        startAt: s.startAt,
        expireAt: s.expireAt,
        isActive: s.isActive,
        source: s.source,
        createdAt: s.createdAt,
        // derived: is the subscription actually still in effect?
        currentlyActive: s.isActive && s.expireAt && s.expireAt > now,
        user: s.user,
      })),
      total: subscriptions.length,
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
