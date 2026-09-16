import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/groups?page=1&limit=20&q=search
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
        { description: { contains: q } },
        { category: { contains: q } },
      ]
    }

    const [groups, total] = await Promise.all([
      db.group.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true,
              email: true,
            },
          },
          _count: {
            select: {
              members: true,
              reports: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.group.count({ where }),
    ])

    return ok({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        logo: g.logo,
        category: g.category,
        isPublic: g.isPublic,
        inviteCode: g.inviteCode,
        ownerId: g.ownerId,
        owner: g.owner,
        membersCount: g.membersCount,
        memberCount: g._count.members,
        reportsCount: g._count.reports,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
