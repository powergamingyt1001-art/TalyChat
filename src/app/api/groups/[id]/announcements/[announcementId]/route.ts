import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string; announcementId: string }>
}

function serializeAuthor(u: any) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    isPremium: u.isPremium,
    premiumTier: u.premiumTier,
  }
}

// Verify the user is owner/admin of the group the announcement belongs to.
async function assertCanManage(
  userId: string,
  groupId: string,
  announcementId: string,
) {
  const ann = await db.groupAnnouncement.findUnique({
    where: { id: announcementId },
    select: { groupId: true },
  })
  if (!ann) return { error: 'Announcement not found' as const, status: 404 }
  if (ann.groupId !== groupId) {
    return { error: 'Announcement not found' as const, status: 404 }
  }
  const myMembership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
    return { error: 'Only the group owner or admin can manage announcements' as const, status: 403 }
  }
  return { ok: true as const }
}

// PATCH /api/groups/[id]/announcements/[announcementId] — update content (owner/admin only)
// Body: { content: string }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, announcementId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const content = String(body?.content || '').trim()
    if (!content) return jsonError(400, 'Content cannot be empty')
    if (content.length > 2000) return jsonError(400, 'Content too long (max 2000 chars)')

    const guard = await assertCanManage(user.id, id, announcementId)
    if ('error' in guard) return jsonError(guard.status, guard.error)

    const updated = await db.groupAnnouncement.update({
      where: { id: announcementId },
      data: { content },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
            premiumTier: true,
          },
        },
      },
    })

    return ok({
      announcement: {
        id: updated.id,
        groupId: updated.groupId,
        authorId: updated.authorId,
        content: updated.content,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        author: serializeAuthor(updated.author),
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/groups/[id]/announcements/[announcementId] — soft-delete (set isActive=false). Owner/admin only.
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, announcementId } = await ctx.params

    const guard = await assertCanManage(user.id, id, announcementId)
    if ('error' in guard) return jsonError(guard.status, guard.error)

    await db.groupAnnouncement.update({
      where: { id: announcementId },
      data: { isActive: false },
    })

    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
