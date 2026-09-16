import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/ads?placement=in-chat|home|discover
// For in-chat: pick random active ad.
// For home/discover: return all active ads for that placement.
// Increments impressions count by 1 per returned ad.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req).catch(() => null)
    void user
    const url = new URL(req.url)
    const placement = url.searchParams.get('placement') || 'home'

    if (!['in-chat', 'home', 'discover'].includes(placement)) {
      return jsonError(400, 'Invalid placement')
    }

    const ads = await db.advertisement.findMany({
      where: { placement, isActive: true },
    })

    let selected = ads
    if (placement === 'in-chat') {
      // pick a random active ad
      if (ads.length === 0) {
        return ok({ ad: null })
      }
      const random = ads[Math.floor(Math.random() * ads.length)]
      await db.advertisement.update({
        where: { id: random.id },
        data: { impressions: { increment: 1 } },
      })
      return ok({ ad: serialize(random) })
    }

    // home / discover — return all active ads and increment impressions
    if (ads.length > 0) {
      await Promise.all(
        ads.map((a) =>
          db.advertisement.update({
            where: { id: a.id },
            data: { impressions: { increment: 1 } },
          }),
        ),
      )
    }
    return ok({ ads: ads.map(serialize) })
  } catch (e: any) {
    return jsonError(500, e.message)
  }
}

function serialize(a: any) {
  return {
    id: a.id,
    brandName: a.brandName,
    headline: a.headline,
    description: a.description,
    imageUrl: a.imageUrl,
    ctaText: a.ctaText,
    ctaUrl: a.ctaUrl,
    placement: a.placement,
    category: a.category,
  }
}
