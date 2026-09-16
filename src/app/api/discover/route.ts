import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/discover — discover public groups
// Query params: ?category=xxx&sort=trending|popular|new
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = req.nextUrl
    const category = url.searchParams.get('category') || undefined
    const sort = url.searchParams.get('sort') || 'trending'

    const where: any = { isPublic: true }
    if (category) where.category = category

    const groups = await db.group.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            messages: {
              where: {
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
              select: { id: true },
            },
          },
        },
      },
      take: 200,
    })

    // My memberships — for isJoined
    const myMemberships = await db.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true, role: true },
    })
    const myGroupIds = new Set(myMemberships.map((m: any) => m.groupId))

    const enriched = groups.map((g: any) => {
      const recentMsgCount = g.conversation?.messages?.length || 0
      const trendingScore = g.membersCount * 2 + recentMsgCount
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        logo: g.logo,
        category: g.category,
        isPublic: g.isPublic,
        inviteCode: g.inviteCode,
        ownerId: g.ownerId,
        membersCount: g.membersCount,
        createdAt: g.createdAt,
        conversationId: g.conversation?.id || null,
        recentMsgCount,
        trendingScore,
        isJoined: myGroupIds.has(g.id),
      }
    })

    if (sort === 'popular') {
      enriched.sort((a: any, b: any) => b.membersCount - a.membersCount)
    } else if (sort === 'new') {
      enriched.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
    } else {
      // trending
      enriched.sort((a: any, b: any) => b.trendingScore - a.trendingScore)
    }

    const limited = enriched.slice(0, 50).map(({ trendingScore, recentMsgCount, ...g }: any) => g)

    // Sponsored ads
    const sponsored = await db.advertisement.findMany({
      where: { placement: 'discover', isActive: true },
      take: 10,
    })

    return ok({
      groups: limited,
      sponsored,
      sort,
      category: category || null,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
