import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/referral/me — current user's referral data
// Returns: { code: username, count: active referrals, recent: list, tierReached, progress: x/15 }
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const referrals = await db.referral.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPremium: true,
            createdAt: true,
          },
        },
      },
    })

    const active = referrals.filter((r) => r.status === 'active')
    const recent = referrals.slice(0, 20).map((r) => ({
      id: r.id,
      status: r.status,
      tierReached: r.tierReached,
      rewardGranted: r.rewardGranted,
      createdAt: r.createdAt,
      activatedAt: r.activatedAt,
      referred: r.referred,
    }))

    const count = active.length

    // tierReached: highest tier this user has unlocked based on count.
    let tierReached: '4' | '7' | '15' | null = null
    if (count >= 15) tierReached = '15'
    else if (count >= 7) tierReached = '7'
    else if (count >= 4) tierReached = '4'

    return ok({
      code: user.username,
      count,
      recent,
      tierReached,
      progress: `${Math.min(count, 15)}/15`,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
