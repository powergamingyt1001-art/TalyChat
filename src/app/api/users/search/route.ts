import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/users/search?q=username-or-name
// Search users by username (starts-with) or name (contains).
// Exclude current user and blocked users (either direction). Limit 20.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    if (!q) return ok({ users: [] })

    // Get users I blocked and who blocked me
    const iBlocked = await db.block.findMany({
      where: { blockerId: user.id },
      select: { blockedId: true },
    })
    const blockedMe = await db.block.findMany({
      where: { blockedId: user.id },
      select: { blockerId: true },
    })
    const excludeIds = new Set<string>([user.id])
    for (const b of iBlocked) excludeIds.add(b.blockedId)
    for (const b of blockedMe) excludeIds.add(b.blockerId)

    const users = await db.user.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) },
        OR: [
          { username: { startsWith: q } },
          { name: { contains: q } },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isOnline: true,
        isPremium: true,
        premiumTier: true,
      },
      orderBy: { username: 'asc' },
    })

    return ok({ users })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
