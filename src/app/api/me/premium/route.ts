import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/me/premium — current user's premium status + active subscriptions.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        isPremium: true,
        premiumUntil: true,
      },
    })
    if (!full) return jsonError(404, 'User not found')

    const now = new Date()
    let isPremium = full.isPremium
    if (full.premiumUntil && full.premiumUntil < now) {
      isPremium = false
    }
    const daysLeft = full.premiumUntil
      ? Math.max(0, Math.ceil((full.premiumUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0

    const subscriptions = await db.subscription.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      isPremium,
      premiumUntil: full.premiumUntil,
      daysLeft,
      subscriptions,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
