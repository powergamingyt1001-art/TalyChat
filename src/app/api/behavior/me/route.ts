import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const MAX_ADS_PER_DAY = 10

// GET /api/behavior/me — current user's behavior summary
// Returns: { score, adsWatchedToday, maxAdsPerDay, canMessage }
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { behaviorScore: true, adsWatchedToday: true, lastAdWatchedAt: true },
    })
    if (!me) return jsonError(404, 'User not found')

    const adsWatchedToday = sameDay(me.lastAdWatchedAt, new Date())
      ? me.adsWatchedToday
      : 0

    return ok({
      score: me.behaviorScore,
      adsWatchedToday,
      maxAdsPerDay: MAX_ADS_PER_DAY,
      canMessage: me.behaviorScore >= 50,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

function sameDay(a: Date | null, b: Date): boolean {
  if (!a) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
