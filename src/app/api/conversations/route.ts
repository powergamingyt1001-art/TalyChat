import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth, HttpError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/conversations — list conversations for current user
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const conversations = await db.conversation.findMany({
      where: {
        members: { some: { userId: user.id } },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                isOnline: true,
                lastSeen: true,
                isPremium: true,
                premiumTier: true,
              },
            },
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            logo: true,
            category: true,
            membersCount: true,
            isPublic: true,
            inviteCode: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const result = conversations.map((c) => {
      const lastMessage = c.messages[0] || null
      const otherMember =
        c.type === 'private'
          ? c.members.find((m) => m.userId !== user.id) || null
          : null
      return {
        id: c.id,
        type: c.type,
        name: c.name,
        avatar: c.avatar,
        ownerId: c.ownerId,
        groupId: c.groupId,
        wallpaper: c.wallpaper,
        muted: c.muted,
        pinned: c.pinned,
        autoDeleteAfter: c.autoDeleteAfter,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        group: c.group,
        otherUser: otherMember ? otherMember.user : null,
        members: c.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          lastReadAt: m.lastReadAt,
          user: m.user,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              mediaUrl: lastMessage.mediaUrl,
              voiceDuration: lastMessage.voiceDuration,
              stickerId: lastMessage.stickerId,
              createdAt: lastMessage.createdAt,
              deletedAt: lastMessage.deletedAt,
              sender: lastMessage.sender,
            }
          : null,
      }
    })

    return ok({ conversations: result })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/conversations — create new conversation (private or group)
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { type, participantId, name, groupId } = body || {}

    if (!type || !['private', 'group'].includes(type)) {
      return jsonError(400, 'Invalid type (private | group)')
    }

    if (type === 'private') {
      // ----- Private (1-to-1) conversation -----
      if (!participantId) {
        return jsonError(400, 'participantId required for private conversation')
      }
      if (participantId === user.id) {
        return jsonError(400, 'Cannot create conversation with yourself')
      }

      // Check that the participant exists
      const participant = await db.user.findUnique({
        where: { id: participantId },
        select: { id: true, isBlocked: true },
      })
      if (!participant) {
        return jsonError(404, 'Participant not found')
      }

      // Block check (either direction)
      const block = await db.block.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: participantId },
            { blockerId: participantId, blockedId: user.id },
          ],
        },
      })
      if (block) {
        return jsonError(403, 'Cannot message this user (blocked)')
      }

      // Check if a private conversation already exists between these two users
      const existing = await db.conversation.findFirst({
        where: {
          type: 'private',
          AND: [
            { members: { some: { userId: user.id } } },
            { members: { some: { userId: participantId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
      })

      if (existing) {
        // Ensure current user is still a member (could have left earlier)
        const meStillMember = existing.members.some((m) => m.userId === user.id)
        if (!meStillMember) {
          await db.conversationMember.create({
            data: { conversationId: existing.id, userId: user.id },
          })
        }
        return ok({ conversation: serializeConversation(existing, user.id) }, 200)
      }

      // Create the private conversation + 2 members
      const conv = await db.conversation.create({
        data: {
          type: 'private',
          ownerId: user.id,
          members: {
            create: [
              { userId: user.id, role: 'member' },
              { userId: participantId, role: 'member' },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
      })

      return ok({ conversation: serializeConversation(conv, user.id) }, 201)
    }

    // ----- Group conversation -----
    // Group conversations must be linked to a Group. Either an explicit groupId
    // is provided (must already be a member of that group), or we create a new
    // Group + its conversation.
    let group: any

    if (groupId) {
      // Join an existing group's conversation (must already be a group member)
      const gm = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: user.id } },
      })
      if (!gm) {
        return jsonError(403, 'You are not a member of this group')
      }
      group = await db.group.findUnique({ where: { id: groupId } })
      if (!group) return jsonError(404, 'Group not found')

      // The conversation is auto-created with the group (1-to-1 relation via groupId unique)
      let conv = await db.conversation.findUnique({
        where: { groupId: group.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  avatar: true,
                  isOnline: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
      })

      if (!conv) {
        // Create conversation for the group with all current members
        const groupMembers = await db.groupMember.findMany({
          where: { groupId: group.id },
          select: { userId: true, role: true },
        })
        conv = await db.conversation.create({
          data: {
            type: 'group',
            name: group.name,
            groupId: group.id,
            ownerId: group.ownerId,
            members: {
              create: groupMembers.map((gm) => ({
                userId: gm.userId,
                role: gm.role,
              })),
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                    isOnline: true,
                    lastSeen: true,
                  },
                },
              },
            },
          },
        })
      } else {
        // Make sure the user is part of the conversation members
        const meStillMember = conv.members.some((m) => m.userId === user.id)
        if (!meStillMember) {
          await db.conversationMember.create({
            data: {
              conversationId: conv.id,
              userId: user.id,
              role: gm.role,
            },
          })
          conv = await db.conversation.findUnique({
            where: { id: conv.id },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      name: true,
                      avatar: true,
                      isOnline: true,
                      lastSeen: true,
                    },
                  },
                },
              },
            },
          })
        }
      }

      return ok({ conversation: serializeConversation(conv, user.id) }, 200)
    }

    // Create a brand-new group + its conversation
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const groupName = name || `${user.name}'s Group`
    group = await db.group.create({
      data: {
        name: groupName,
        ownerId: user.id,
        creatorId: user.id,
        isPublic: true,
        inviteCode,
        membersCount: 1,
      },
    })
    await db.groupMember.create({
      data: { groupId: group.id, userId: user.id, role: 'owner' },
    })

    const conv = await db.conversation.create({
      data: {
        type: 'group',
        name: groupName,
        groupId: group.id,
        ownerId: user.id,
        members: {
          create: [{ userId: user.id, role: 'owner' }],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
        },
      },
    })

    return ok(
      {
        conversation: serializeConversation(conv, user.id),
        group: { id: group.id, inviteCode: group.inviteCode },
      },
      201,
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    if (e instanceof HttpError) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// Helper to serialize a conversation with its members + otherUser
function serializeConversation(conv: any, currentUserId: string) {
  const otherMember =
    conv.type === 'private'
      ? conv.members.find((m: any) => m.userId !== currentUserId) || null
      : null
  return {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    avatar: conv.avatar,
    ownerId: conv.ownerId,
    groupId: conv.groupId,
    wallpaper: conv.wallpaper,
    muted: conv.muted,
    pinned: conv.pinned,
    autoDeleteAfter: conv.autoDeleteAfter,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    otherUser: otherMember ? otherMember.user : null,
    members: conv.members.map((m: any) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
      user: m.user,
    })),
  }
}
