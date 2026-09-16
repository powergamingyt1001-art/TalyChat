import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/ads/[id]/click — record ad click.
// Increments clicks count and creates an AdClick record.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const ad = await db.advertisement.findUnique({ where: { id } })
    if (!ad) return jsonError(404, 'Ad not found')
    if (!ad.isActive) return jsonError(400, 'Ad is not active')

    await db.$transaction([
      db.advertisement.update({
        where: { id },
        data: { clicks: { increment: 1 } },
      }),
      db.adClick.create({
        data: { adId: id, userId: user.id },
      }),
    ])

    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
