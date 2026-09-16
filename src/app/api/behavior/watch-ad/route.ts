import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const MAX_ADS_PER_DAY = 10

// POST /api/behavior/watch-ad — watch an ad to increase behavior
// Validation: max 10/day. (PRD/spec uses 10 as the daily cap.)
// - If lastAdWatchedAt is a different day, reset adsWatchedToday to 1.
//   Otherwise increment adsWatchedToday by 1.
// - Increase behaviorScore by min(1, 100 - score).
// - Update lastAdWatchedAt to now.
// - Pick a random ad (placement=in-chat, otherwise any active ad) and
//   increment its impressions.
// Returns { score, adsWatchedToday, ad: {...} | null }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { behaviorScore: true, adsWatchedToday: true, lastAdWatchedAt: true },
    })
    if (!me) return jsonError(404, 'User not found')

    const now = new Date()
    const isSameDay = sameDay(me.lastAdWatchedAt, now)
    const adsWatchedToday = isSameDay ? me.adsWatchedToday : 0

    if (adsWatchedToday >= MAX_ADS_PER_DAY) {
      return jsonError(429, 'Daily ad-watch limit reached. Try again tomorrow.')
    }

    // Increment score by min(1, 100 - currentScore). Score is capped at 100.
    const increment = Math.min(1, Math.max(0, 100 - me.behaviorScore))
    const newScore = Math.min(100, me.behaviorScore + increment)

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        behaviorScore: newScore,
        adsWatchedToday: adsWatchedToday + 1,
        lastAdWatchedAt: now,
      },
      select: { behaviorScore: true, adsWatchedToday: true },
    })

    // Pick a random active ad — prefer in-chat, fall back to any active.
    let ads = await db.advertisement.findMany({
      where: { placement: 'in-chat', isActive: true },
    })
    if (ads.length === 0) {
      ads = await db.advertisement.findMany({ where: { isActive: true } })
    }

    let ad: any = null
    if (ads.length > 0) {
      ad = ads[Math.floor(Math.random() * ads.length)]
      await db.advertisement.update({
        where: { id: ad.id },
        data: { impressions: { increment: 1 } },
      })
    }

    return ok({
      score: updatedUser.behaviorScore,
      adsWatchedToday: updatedUser.adsWatchedToday,
      maxAdsPerDay: MAX_ADS_PER_DAY,
      canMessage: updatedUser.behaviorScore >= 50,
      ad: ad
        ? {
            id: ad.id,
            brandName: ad.brandName,
            headline: ad.headline,
            description: ad.description,
            imageUrl: ad.imageUrl,
            ctaText: ad.ctaText,
            ctaUrl: ad.ctaUrl,
            placement: ad.placement,
            category: ad.category,
          }
        : null,
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
