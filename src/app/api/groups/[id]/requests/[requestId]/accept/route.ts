import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>
}

// POST /api/groups/[id]/requests/[requestId]/accept
// - Owner/admin only.
// - Creates GroupMember + ConversationMember (idempotent), increments membersCount.
// - Sets request status=accepted, decidedAt=now.
// - Notifies the sender that they were accepted.
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id, requestId } = await ctx.params

    const group = await db.group.findUnique({
      where: { id },
      include: { conversation: true },
    })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only the group owner or admin can accept join requests')
    }

    const request = await db.groupRequest.findUnique({ where: { id: requestId } })
    if (!request || request.groupId !== id) {
      return jsonError(404, 'Join request not found')
    }
    if (request.status !== 'pending') {
      return jsonError(400, `Request already ${request.status}`)
    }

    // Idempotent: already a member?
    const existingMember = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: request.senderId } },
    })

    if (!existingMember) {
      await db.groupMember.create({
        data: { groupId: id, userId: request.senderId, role: 'member' },
      })

      if (group.conversation) {
        try {
          await db.conversationMember.create({
            data: {
              conversationId: group.conversation.id,
              userId: request.senderId,
              role: 'member',
            },
          })
        } catch {}
      }

      await db.group.update({
        where: { id },
        data: { membersCount: { increment: 1 } },
      })
    }

    await db.groupRequest.update({
      where: { id: requestId },
      data: { status: 'accepted', decidedAt: new Date() },
    })

    // Notify the requester
    try {
      await db.notification.create({
        data: {
          userId: request.senderId,
          type: 'group',
          title: `You joined ${group.name}`,
          body: 'Your join request was accepted.',
          data: JSON.stringify({
            groupId: id,
            groupRequestId: requestId,
            conversationId: group.conversation?.id || null,
          }),
        },
      })
    } catch {}

    return ok({ ok: true, id: requestId, status: 'accepted', groupId: id })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
