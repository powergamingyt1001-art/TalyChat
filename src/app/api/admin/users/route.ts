import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/users?q=search&page=1&limit=20
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)))

    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
        { email: { contains: q } },
      ]
    }

    const [users, filteredTotal] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          isPremium: true,
          isOnline: true,
          createdAt: true,
          avatar: true,
          isRestricted: true,
          gender: true,
          dob: true,
          lastSeen: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ])

    // ---------- Analytics summary (overall, unfiltered) ----------
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const now = new Date()
    const under18Cutoff = new Date()
    under18Cutoff.setFullYear(now.getFullYear() - 18)
    const cutoffStr = under18Cutoff.toISOString().slice(0, 10) // yyyy-mm-dd

    const [
      total,
      active,
      newToday,
      male,
      female,
      under18Count,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isOnline: true } }),
      db.user.count({ where: { createdAt: { gte: startOfToday } } }),
      db.user.count({ where: { gender: 'male' } }),
      db.user.count({ where: { gender: 'female' } }),
      db.user.count({
        where: { dob: { not: null, gt: cutoffStr } },
      }),
    ])

    const over18 = Math.max(0, total - under18Count)

    return ok({
      users: users.map((u) => ({
        ...u,
        joinedAt: u.createdAt,
      })),
      total,
      active,
      newToday,
      male,
      female,
      under18: under18Count,
      over18,
      // pagination meta for filtered list
      filteredTotal,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filteredTotal / limit)),
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
