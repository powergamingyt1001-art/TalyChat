import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// DELETE /api/highlights/[id] — delete a highlight (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const highlight = await db.storyHighlight.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!highlight) return jsonError(404, 'Highlight not found')
    if (highlight.userId !== user.id) {
      return jsonError(403, 'You can only delete your own highlights')
    }

    await db.storyHighlight.delete({ where: { id } })
    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/highlights/[id] — update highlight title/coverColor (owner only)
// Body: { title?, coverColor? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const highlight = await db.storyHighlight.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!highlight) return jsonError(404, 'Highlight not found')
    if (highlight.userId !== user.id) {
      return jsonError(403, 'You can only edit your own highlights')
    }

    const data: any = {}
    if (typeof body.title === 'string' && body.title.trim()) {
      data.title = body.title.trim().slice(0, 50)
    }
    if (body.coverColor) {
      const c = String(body.coverColor).trim()
      if (/^#[0-9a-fA-F]{6}$/.test(c)) data.coverColor = c.toLowerCase()
    }

    if (Object.keys(data).length === 0) {
      return jsonError(400, 'No updatable fields provided')
    }

    const updated = await db.storyHighlight.update({
      where: { id },
      data,
    })
    return ok({
      id: updated.id,
      title: updated.title,
      coverColor: updated.coverColor,
      storyIds: updated.storyIds,
      updatedAt: updated.updatedAt,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
