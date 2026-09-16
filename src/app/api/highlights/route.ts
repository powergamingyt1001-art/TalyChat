import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/highlights?userId=xxx
//   - If userId is provided, return that user's public highlights (without story contents — fetch via separate call if needed)
//   - If no userId, return the current user's highlights (with story contents)
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const userIdParam = url.searchParams.get('userId')

    const targetUserId = userIdParam || user.id
    const isOwn = targetUserId === user.id

    const highlights = await db.storyHighlight.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
    })

    if (!isOwn) {
      // Public view — return metadata only (no story contents).
      return ok({
        highlights: highlights.map((h) => ({
          id: h.id,
          title: h.title,
          coverColor: h.coverColor,
          storyIds: h.storyIds,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        })),
        isOwn: false,
      })
    }

    // Own view — fetch story contents.
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

// POST /api/highlights — create a new highlight
// Body: { title?, coverColor?, storyIds: string[] }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { title, coverColor, storyIds } = body || {}

    const idsArr: string[] = Array.isArray(storyIds)
      ? storyIds.map((s: any) => String(s)).filter(Boolean)
      : []

    if (idsArr.length === 0) {
      return jsonError(400, 'At least one story ID is required')
    }

    // Verify all stories belong to the user
    const owned = await db.story.findMany({
      where: { id: { in: idsArr }, userId: user.id },
      select: { id: true, isDeleted: true },
    })
    const ownedIds = new Set(owned.filter((s) => !s.isDeleted).map((s) => s.id))
    const validIds = idsArr.filter((id) => ownedIds.has(id))
    if (validIds.length === 0) {
      return jsonError(
        400,
        'No valid stories to add (stories must be your own and not deleted)'
      )
    }

    // Validate coverColor (hex)
    let color = '#10b981'
    if (coverColor) {
      const c = String(coverColor).trim()
      if (/^#[0-9a-fA-F]{6}$/.test(c)) color = c.toLowerCase()
    }

    const titleStr = title ? String(title).trim().slice(0, 50) : 'Highlights'

    const highlight = await db.storyHighlight.create({
      data: {
        userId: user.id,
        title: titleStr || 'Highlights',
        coverColor: color,
        storyIds: validIds.join(','),
      },
    })

    return ok(
      {
        id: highlight.id,
        title: highlight.title,
        coverColor: highlight.coverColor,
        storyIds: validIds,
        createdAt: highlight.createdAt,
        updatedAt: highlight.updatedAt,
      },
      201
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
