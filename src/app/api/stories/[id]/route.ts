import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// DELETE /api/stories/[id] — delete own story (soft delete: isDeleted = true)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const story = await db.story.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!story) return jsonError(404, 'Story not found')
    if (story.userId !== user.id) {
      return jsonError(403, 'You can only delete your own stories')
    }

    await db.story.update({
      where: { id },
      data: { isDeleted: true },
    })

    // Clean up StoryView records as well
    await db.storyView.deleteMany({ where: { storyId: id } }).catch(() => {})

    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
