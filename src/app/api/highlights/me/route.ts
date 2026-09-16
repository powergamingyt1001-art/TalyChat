import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/highlights/me — get my highlights with story contents
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const highlights = await db.storyHighlight.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    const allIds = Array.from(
      new Set(
        highlights.flatMap((h) =>
          (h.storyIds || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    )

    const stories = allIds.length
      ? await db.story.findMany({
          where: { id: { in: allIds } },
          orderBy: { createdAt: 'asc' },
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
          },
        })
      : []

    const storyById = new Map(stories.map((s) => [s.id, s]))

    const withStories = highlights.map((h) => {
      const ids = (h.storyIds || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      return {
        id: h.id,
        title: h.title,
        coverColor: h.coverColor,
        storyIds: ids,
        stories: ids
          .map((id) => storyById.get(id))
          .filter((s): s is NonNullable<typeof s> => !!s && !s.isDeleted),
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      }
    })

    return ok({ highlights: withStories, isOwn: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
