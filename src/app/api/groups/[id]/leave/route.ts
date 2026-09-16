import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/groups/[id]/leave — leave a group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const group = await db.group.findUnique({
      where: { id },
      include: { conversation: true },
    })
    if (!group) return jsonError(404, 'Group not found')

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!membership) {
      return jsonError(400, 'You are not a member of this group')
    }

    // Remove from group + conversation
    await db.groupMember.delete({ where: { id: membership.id } })
    if (group.conversation) {
      try {
        await db.conversationMember.deleteMany({
          where: { conversationId: group.conversation.id, userId: user.id },
        })
      } catch {}
    }

    // Count remaining members
    const remaining = await db.groupMember.count({ where: { groupId: id } })

    if (remaining === 0) {
      // Delete the group entirely (cascade will remove leftover memberships, conversation, etc.)
      await db.group.delete({ where: { id } })
      return ok({ left: true, groupDeleted: true })
    }

    // If owner left — transfer ownership
    if (membership.role === 'owner') {
      // Find oldest admin
      const oldestAdmin = await db.groupMember.findFirst({
        where: { groupId: id, role: 'admin' },
        orderBy: { joinedAt: 'asc' },
      })
      let newOwner = oldestAdmin
      if (!newOwner) {
        // Fall back to longest-tenured member
        newOwner = await db.groupMember.findFirst({
          where: { groupId: id },
          orderBy: { joinedAt: 'asc' },
        })
      }
      if (newOwner) {
        await db.groupMember.update({
          where: { id: newOwner.id },
          data: { role: 'owner' },
        })
        await db.group.update({
          where: { id },
          data: { ownerId: newOwner.userId },
        })
        // If there's a conversation, update its owner too
        if (group.conversation) {
          await db.conversation.updateMany({
            where: { groupId: id },
            data: { ownerId: newOwner.userId },
          })
          await db.conversationMember.updateMany({
            where: {
              conversationId: group.conversation.id,
              userId: newOwner.userId,
            },
            data: { role: 'owner' },
          })
        }
      }
    }

    const updated = await db.group.update({
      where: { id },
      data: { membersCount: { decrement: 1 } },
    })

    return ok({
      left: true,
      groupDeleted: false,
      group: {
        id: updated.id,
        name: updated.name,
        membersCount: updated.membersCount,
        ownerId: updated.ownerId,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
