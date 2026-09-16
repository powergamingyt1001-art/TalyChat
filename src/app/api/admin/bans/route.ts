import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/bans — list currently banned users (isBlocked=true)
// Includes banReason and blockedUntil.
// Optional ?active=true to only include bans whose blockedUntil is still in
// the future (or permanent). We default to all isBlocked=true users.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const onlyActive = url.searchParams.get('active') === 'true'
    const now = new Date()

    const where: any = { isBlocked: true }
    if (onlyActive) {
      // Active = blockedUntil is null (permanent) OR blockedUntil > now
      where.OR = [{ blockedUntil: null }, { blockedUntil: { gt: now } }]
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
        isBlocked: true,
        blockedUntil: true,
        banReason: true,
        lastSeen: true,
        createdAt: true,
      },
      orderBy: { blockedUntil: 'desc' },
    })

    return ok({
      bans: users.map((u) => ({
        ...u,
        // Whether the ban is currently in effect (vs. expired-but-flag-still-set)
        banActive:
          u.isBlocked && (!u.blockedUntil || u.blockedUntil.getTime() > now.getTime()),
        // Permanent = no expiry
        permanent: u.isBlocked && !u.blockedUntil,
      })),
      total: users.length,
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
