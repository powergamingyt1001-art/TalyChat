import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/highlights/[id]/add — add a story to an existing highlight
// Body: { storyId }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { storyId } = body || {}

    if (!storyId || typeof storyId !== 'string') {
      return jsonError(400, 'storyId is required')
    }

    const highlight = await db.storyHighlight.findUnique({
      where: { id },
      select: { id: true, userId: true, storyIds: true },
    })
    if (!highlight) return jsonError(404, 'Highlight not found')
    if (highlight.userId !== user.id) {
      return jsonError(403, 'You can only modify your own highlights')
    }

    // Verify story exists + belongs to user + not deleted
    const story = await db.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true, isDeleted: true },
    })
    if (!story || story.userId !== user.id || story.isDeleted) {
      return jsonError(400, 'Story not found or not owned by you')
    }

    const existing = (highlight.storyIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (existing.includes(storyId)) {
      return ok({
        id: highlight.id,
        storyIds: existing,
        alreadyExists: true,
      })
    }

    existing.push(storyId)
    const updated = await db.storyHighlight.update({
      where: { id },
      data: { storyIds: existing.join(',') },
    })

    return ok({
      id: updated.id,
      storyIds: existing,
      alreadyExists: false,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
