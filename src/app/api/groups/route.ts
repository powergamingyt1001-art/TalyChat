import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// GET /api/groups — list groups the current user is a member of
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const memberships = await db.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            conversation: {
              include: {
                messages: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    const result = memberships.map((m: any) => {
      const lastMessage = m.group?.conversation?.messages?.[0] || null
      return {
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        logo: m.group.logo,
        category: m.group.category,
        isPublic: m.group.isPublic,
        inviteCode: m.group.inviteCode,
        ownerId: m.group.ownerId,
        membersCount: m.group.membersCount,
        createdAt: m.group.createdAt,
        updatedAt: m.group.updatedAt,
        role: m.role,
        joinedAt: m.joinedAt,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        conversationId: m.group.conversation?.id || null,
      }
    })

    return ok({ groups: result })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/groups — create a group
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { name, description, logo, category, isPublic } = body || {}
    if (!name || !category) {
      return jsonError(400, 'name and category are required')
    }

    let inviteCode = genCode()
    // ensure uniqueness
    let attempts = 0
    while (await db.group.findUnique({ where: { inviteCode } })) {
      inviteCode = genCode()
      attempts++
      if (attempts > 10) break
    }

    const group = await db.group.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description) : '',
        logo: logo ? String(logo) : null,
        category: String(category),
        isPublic: Boolean(isPublic),
        inviteCode,
        ownerId: user.id,
        creatorId: user.id,
        membersCount: 1,
      },
    })

    await db.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'owner' },
    })

    const conversation = await db.conversation.create({
      data: {
        type: 'group',
        name: group.name,
        groupId: group.id,
        ownerId: user.id,
      },
    })

    await db.conversationMember.create({
      data: {
        conversationId: conversation.id,
        userId: user.id,
        role: 'owner',
      },
    })

    return ok(
      {
        group: {
          id: group.id,
          name: group.name,
          description: group.description,
          logo: group.logo,
          category: group.category,
          isPublic: group.isPublic,
          inviteCode: group.inviteCode,
          ownerId: group.ownerId,
          creatorId: group.creatorId,
          membersCount: group.membersCount,
          createdAt: group.createdAt,
          conversationId: conversation.id,
        },
      },
      201,
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
