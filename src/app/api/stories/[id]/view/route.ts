import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/stories/[id]/view — mark a story as viewed by the current user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const story = await db.story.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        isDeleted: true,
        viewedBy: true,
      },
    })
    if (!story) return jsonError(404, 'Story not found')
    if (story.isDeleted) return jsonError(404, 'Story no longer available')
    if (story.expiresAt.getTime() < Date.now()) {
      return jsonError(410, 'Story has expired')
    }

    // Don't create a StoryView for the author viewing their own story
    if (story.userId !== user.id) {
      // upsert via unique constraint (storyId, userId)
      try {
        await db.storyView.upsert({
          where: { storyId_userId: { storyId: id, userId: user.id } },
          create: { storyId: id, userId: user.id },
          update: {}, // no-op update if exists
        })
      } catch {
        // ignore unique constraint race conditions
      }

      // Append user.id to Story.viewedBy (comma-separated, backward compat)
      // Only append if not already present
      const viewedList = (story.viewedBy || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!viewedList.includes(user.id)) {
        viewedList.push(user.id)
        await db.story.update({
          where: { id },
          data: { viewedBy: viewedList.join(',') },
        })
      }
    }

    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
