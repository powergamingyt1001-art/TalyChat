import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/groups/join — join by inviteCode or groupId
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { inviteCode, groupId } = body || {}

    if (!inviteCode && !groupId) {
      return jsonError(400, 'inviteCode or groupId is required')
    }

    let group
    if (inviteCode) {
      group = await db.group.findUnique({
        where: { inviteCode: String(inviteCode).toUpperCase().trim() },
        include: { conversation: true },
      })
    } else {
      group = await db.group.findUnique({
        where: { id: String(groupId) },
        include: { conversation: true },
      })
    }
    if (!group) return jsonError(404, 'Group not found')

    // Idempotent: already member
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
    })
    if (existing) {
      return ok({
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          logo: group.logo,
          category: group.category,
          isPublic: group.isPublic,
          inviteCode: group.inviteCode,
          ownerId: group.ownerId,
          membersCount: group.membersCount,
          conversationId: group.conversation?.id || null,
        },
        alreadyMember: true,
        role: existing.role,
      })
    }

    // Join: create membership + conversation membership
    await db.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'member' },
    })

    if (group.conversation) {
      try {
        await db.conversationMember.create({
          data: {
            conversationId: group.conversation.id,
            userId: user.id,
            role: 'member',
          },
        })
      } catch {}
    }

    const updated = await db.group.update({
      where: { id: group.id },
      data: { membersCount: { increment: 1 } },
    })

    return ok({
      group: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        logo: updated.logo,
        category: updated.category,
        isPublic: updated.isPublic,
        inviteCode: updated.inviteCode,
        ownerId: updated.ownerId,
        membersCount: updated.membersCount,
        conversationId: group.conversation?.id || null,
      },
      alreadyMember: false,
      role: 'member',
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
