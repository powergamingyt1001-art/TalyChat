import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const VALID_ROLES = ['admin', 'moderator', 'member']

// PATCH /api/groups/[id]/members/[userId] — change role (owner/admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, userId } = await params
    const body = await req.json().catch(() => ({}))
    const { role } = body || {}

    if (!role || !VALID_ROLES.includes(String(role))) {
      return jsonError(400, 'role must be one of admin | moderator | member')
    }

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only owner or admin can change roles')
    }

    const target = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
      include: { user: true },
    })
    if (!target) return jsonError(404, 'Member not found')

    if (target.role === 'owner') {
      return jsonError(400, 'Cannot change the role of the owner')
    }

    // Admin cannot promote/demote another admin (only owner can)
    if (myMembership.role === 'admin' && target.role === 'admin') {
      return jsonError(403, 'Admins cannot modify other admins. Only the owner can.')
    }

    const updated = await db.groupMember.update({
      where: { id: target.id },
      data: { role: String(role) },
    })

    // Sync role on conversation member if group has a conversation
    const conv = await db.conversation.findUnique({ where: { groupId: id } })
    if (conv) {
      await db.conversationMember.updateMany({
        where: { conversationId: conv.id, userId },
        data: { role: String(role) },
      })
    }

    return ok({
      member: {
        id: updated.id,
        role: updated.role,
        joinedAt: updated.joinedAt,
        user: target.user
          ? {
              id: target.user.id,
              username: target.user.username,
              name: target.user.name,
              avatar: target.user.avatar,
              email: target.user.email,
            }
          : null,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/groups/[id]/members/[userId] — kick member (owner/admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, userId } = await params

    const group = await db.group.findUnique({
      where: { id },
      include: { conversation: true },
    })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only owner or admin can kick members')
    }

    const target = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    })
    if (!target) return jsonError(404, 'Member not found')

    if (target.role === 'owner') {
      return jsonError(400, 'Cannot kick the owner')
    }

    // Admin cannot kick another admin
    if (myMembership.role === 'admin' && target.role === 'admin') {
      return jsonError(403, 'Admins cannot kick other admins. Only the owner can.')
    }

    await db.groupMember.delete({ where: { id: target.id } })

    if (group.conversation) {
      try {
        await db.conversationMember.deleteMany({
          where: { conversationId: group.conversation.id, userId },
        })
      } catch {}
    }

    await db.group.update({
      where: { id },
      data: { membersCount: { decrement: 1 } },
    })

    return ok({ kicked: true, userId, groupId: id })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
