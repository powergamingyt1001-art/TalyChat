import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/chat-requests/[id]/accept
// - Only the receiver can accept.
// - Creates a private conversation between sender and receiver (if missing).
// - Marks the request as accepted with decidedAt=now.
// - Returns the conversation (serialized).
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const request = await db.chatRequest.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isOnline: true,
            isPremium: true,
            lastSeen: true,
            isBlocked: true,
          },
        },
      },
    })

    if (!request) return jsonError(404, 'Chat request not found')
    if (request.receiverId !== user.id) {
      return jsonError(403, 'Only the receiver can accept this request')
    }
    if (request.status !== 'pending') {
      return jsonError(400, `Request already ${request.status}`)
    }

    // Block check (either direction) — in case things changed since the request
    const block = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: request.senderId },
          { blockerId: request.senderId, blockedId: user.id },
        ],
      },
    })
    if (block) {
      return jsonError(403, 'Cannot accept — blocked relationship exists')
    }

    // Look for an existing private conversation between the two users.
    let conversation: any = await db.conversation.findFirst({
      where: {
        type: 'private',
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: request.senderId } } },
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
                isPremium: true,
              },
            },
          },
        },
      },
    })

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          type: 'private',
          ownerId: user.id,
          members: {
            create: [
              { userId: user.id, role: 'member' },
              { userId: request.senderId, role: 'member' },
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
                  isPremium: true,
                },
              },
            },
          },
        },
      })
    } else {
      // Ensure both users are still members (in case one had left previously)
      const meIn = conversation.members.some((m: any) => m.userId === user.id)
      const themIn = conversation.members.some((m: any) => m.userId === request.senderId)
      const toAdd: { userId: string; role: string }[] = []
      if (!meIn) toAdd.push({ userId: user.id, role: 'member' })
      if (!themIn) toAdd.push({ userId: request.senderId, role: 'member' })
      if (toAdd.length > 0) {
        await db.conversationMember.createMany({
          data: toAdd.map((m) => ({ conversationId: conversation.id, ...m })),
        })
        conversation = await db.conversation.findUnique({
          where: { id: conversation.id },
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
                  },
                },
              },
            },
          },
        })
      }
    }

    // Mark the request as accepted
    await db.chatRequest.update({
      where: { id: request.id },
      data: { status: 'accepted', decidedAt: new Date() },
    })

    // Notify the sender that their request was accepted
    await db.notification.create({
      data: {
        userId: request.senderId,
        type: 'system',
        title: `${user.name || user.username} accepted your chat request`,
        body: 'You can now start messaging each other.',
        data: JSON.stringify({
          conversationId: conversation.id,
          chatRequestId: request.id,
        }),
      },
    })

    const otherMember =
      conversation.type === 'private'
        ? conversation.members.find((m: any) => m.userId !== user.id) || null
        : null

    return ok({
      conversation: {
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        avatar: conversation.avatar,
        ownerId: conversation.ownerId,
        groupId: conversation.groupId,
        wallpaper: conversation.wallpaper,
        muted: conversation.muted,
        pinned: conversation.pinned,
        autoDeleteAfter: conversation.autoDeleteAfter,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        otherUser: otherMember ? otherMember.user : null,
        members: conversation.members.map((m: any) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          lastReadAt: m.lastReadAt,
          user: m.user,
        })),
      },
      request: {
        id: request.id,
        status: 'accepted',
        decidedAt: new Date(),
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
