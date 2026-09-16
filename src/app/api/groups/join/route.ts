import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

function serializeGroup(g: any) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    logo: g.logo,
    category: g.category,
    isPublic: g.isPublic,
    inviteCode: g.inviteCode,
    ownerId: g.ownerId,
    membersCount: g.membersCount,
    conversationId: g.conversation?.id || null,
  }
}

// POST /api/groups/join — join by inviteCode or groupId
// V2: For PRIVATE groups (isPublic=false), do NOT directly join.
// Instead, create a GroupRequest (status=pending). Return { requested: true, group }
// For PUBLIC groups, behave as before (direct join).
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { inviteCode, groupId, message } = body || {}

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

    // Idempotent: already member → return regardless of public/private
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
    })
    if (existing) {
      return ok({
        group: serializeGroup(group),
        alreadyMember: true,
        role: existing.role,
      })
    }

    // ---------- Private group → create join request (V2) ----------
    if (!group.isPublic) {
      // Owner of a private group is implicitly already a member (existing check
      // would have returned above). If we got here, the user is not a member.
      // Upsert a pending GroupRequest (@@unique([groupId, senderId])).
      const request = await db.groupRequest.upsert({
        where: { groupId_senderId: { groupId: group.id, senderId: user.id } },
        update: {
          message: typeof message === 'string' ? message : '',
          status: 'pending',
          decidedAt: null,
          createdAt: new Date(),
        },
        create: {
          groupId: group.id,
          senderId: user.id,
          message: typeof message === 'string' ? message : '',
          status: 'pending',
        },
      })

      // Notify group owner about the new request (best-effort)
      if (group.ownerId !== user.id) {
        try {
          await db.notification.create({
            data: {
              userId: group.ownerId,
              type: 'group',
              title: `New join request for ${group.name}`,
              body: `${user.name || user.username} requested to join your group.`,
              data: JSON.stringify({
                groupId: group.id,
                groupRequestId: request.id,
              }),
            },
          })
        } catch {}
      }

      return ok({
        requested: true,
        requestId: request.id,
        status: request.status,
        group: serializeGroup(group),
      })
    }

    // ---------- Public group → direct join (existing behavior) ----------
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
      include: { conversation: true },
    })

    return ok({
      group: serializeGroup(updated),
      alreadyMember: false,
      role: 'member',
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
