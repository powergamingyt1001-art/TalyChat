import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/stories/archive — return all of my non-deleted stories (active + expired)
// used by the create-highlight picker on the profile screen.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const stories = await db.story.findMany({
      where: {
        userId: user.id,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        type: true,
        content: true,
        bgColor: true,
        textColor: true,
        caption: true,
        createdAt: true,
        expiresAt: true,
        isDeleted: true,
        _count: { select: { views: true } },
      },
      take: 200, // safety cap
    })

    const now = new Date()
    const serialized = stories.map((s) => ({
      id: s.id,
      userId: s.userId,
      type: s.type,
      content: s.content,
      bgColor: s.bgColor,
      textColor: s.textColor,
      caption: s.caption,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isExpired: s.expiresAt.getTime() < now.getTime(),
      viewsCount: s._count.views,
    }))

    return ok({ stories: serialized })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
