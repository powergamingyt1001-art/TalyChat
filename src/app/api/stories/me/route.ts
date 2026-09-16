import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/stories/me — get my stories + viewer list for each story
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const now = new Date()

    const stories = await db.story.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        views: {
          orderBy: { viewedAt: 'desc' },
          take: 100,
          select: {
            id: true,
            userId: true,
            viewedAt: true,
          },
        },
        _count: { select: { views: true } },
      },
    })

    // Fetch viewer user summaries in one go
    const viewerIds = Array.from(
      new Set(stories.flatMap((s) => s.views.map((v) => v.userId)))
    )
    const viewers = await db.user.findMany({
      where: { id: { in: viewerIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isPremium: true,
        premiumTier: true,
      },
    })
    const viewerById = new Map(viewers.map((v) => [v.id, v]))

    let totalViewers = 0
    const serialized = stories.map((s) => {
      const viewerList = s.views.map((v) => {
        const u = viewerById.get(v.userId)
        return {
          userId: v.userId,
          name: u?.name || 'Unknown',
          avatar: u?.avatar || null,
          isPremium: !!u?.isPremium,
          premiumTier: u?.premiumTier || 'free',
          viewedAt: v.viewedAt,
        }
      })
      totalViewers += s._count.views
      return {
        id: s.id,
        userId: s.userId,
        type: s.type,
        content: s.content,
        bgColor: s.bgColor,
        textColor: s.textColor,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewsCount: s._count.views,
        viewers: viewerList,
      }
    })

    return ok({ stories: serialized, totalViewers })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
