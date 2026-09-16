import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/messages?conversationId=...&cursor=<iso>&limit=50
// Returns messages newest-first with cursor-based pagination.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const conversationId = url.searchParams.get('conversationId')
    const cursorParam = url.searchParams.get('cursor')
    const limitRaw = Number(url.searchParams.get('limit') || 50)
    const limit = Math.min(Math.max(limitRaw || 50, 1), 100)

    if (!conversationId) {
      return jsonError(400, 'conversationId is required')
    }

    // Privacy: must be a member to read messages.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // Cursor = ISO timestamp; we want messages strictly older than the cursor.
    // For the first page (no cursor), grab the newest messages.
    const where: any = { conversationId }
    if (cursorParam) {
      const cursorDate = new Date(cursorParam)
      if (!isNaN(cursorDate.getTime())) {
        where.createdAt = { lt: cursorDate }
      }
    }

    const messages = await db.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // +1 to determine hasMore
      include: {
        reactions: true,
        replyTo: {
          include: {
            sender: {
              select: { id: true, username: true, name: true, avatar: true },
            },
          },
        },
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
          },
        },
      },
    })

    const hasMore = messages.length > limit
    const slice = hasMore ? messages.slice(0, limit) : messages
    const nextCursor =
      slice.length > 0 ? slice[slice.length - 1].createdAt : null

    return ok({
      messages: slice.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: m.sender,
        content: m.content,
        type: m.type,
        mediaUrl: m.mediaUrl,
        voiceDuration: m.voiceDuration,
        stickerId: m.stickerId,
        replyToId: m.replyToId,
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              content: m.replyTo.content,
              type: m.replyTo.type,
              sender: m.replyTo.sender,
              deletedAt: m.replyTo.deletedAt,
            }
          : null,
        reactions: m.reactions,
        editedAt: m.editedAt,
        deletedAt: m.deletedAt,
        pinnedAt: m.pinnedAt,
        seenBy: m.seenBy,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      hasMore,
      nextCursor,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/messages — send a message
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const {
      conversationId,
      content,
      type,
      mediaUrl,
      voiceDuration,
      stickerId,
      replyToId,
    } = body || {}

    if (!conversationId) {
      return jsonError(400, 'conversationId is required')
    }

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    const conv = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: { select: { userId: true, role: true } },
      },
    })
    if (!conv) return jsonError(404, 'Conversation not found')

    // Restricted users cannot send messages in group conversations.
    if (user.role !== 'admin' && conv.type === 'group') {
      const me = await db.user.findUnique({
        where: { id: user.id },
        select: { isRestricted: true, restrictedUntil: true },
      })
      const isCurrentlyRestricted =
        me?.isRestricted &&
        (!me.restrictedUntil || me.restrictedUntil.getTime() > Date.now())
      if (isCurrentlyRestricted) {
        return jsonError(403, 'You are restricted and cannot send messages in groups')
      }
    }

    const msgType = type || 'text'
    if (!['text', 'image', 'voice', 'sticker', 'system'].includes(msgType)) {
      return jsonError(400, 'Invalid message type')
    }

    // Validate replyToId if provided
    if (replyToId) {
      const reply = await db.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true },
      })
      if (!reply || reply.conversationId !== conversationId) {
        return jsonError(400, 'replyToId must belong to the same conversation')
      }
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: content || '',
        type: msgType,
        mediaUrl: mediaUrl || null,
        voiceDuration:
          voiceDuration !== undefined && voiceDuration !== null
            ? Number(voiceDuration)
            : null,
        stickerId: stickerId || null,
        replyToId: replyToId || null,
      },
      include: {
        reactions: true,
        replyTo: {
          include: {
            sender: {
              select: { id: true, username: true, name: true, avatar: true },
            },
          },
        },
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
          },
        },
      },
    })

    // Bump conversation order
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Create notifications for other members.
    const otherMemberIds = conv.members
      .map((m) => m.userId)
      .filter((uid) => uid !== user.id)

    // For groups, only notify members whose muted flag on the conversation is false.
    // (We track muted on the conversation itself in this schema; if a future
    // per-member muted flag is added, it should be honored here.)
    const notifyIds: string[] = []
    if (conv.type === 'private') {
      notifyIds.push(...otherMemberIds)
    } else {
      // Group: only notify if conversation is not muted.
      if (!conv.muted) {
        notifyIds.push(...otherMemberIds)
      }
    }

    const preview = buildPreview(message.content, message.type)
    for (const uid of notifyIds) {
      await db.notification.create({
        data: {
          userId: uid,
          type: 'message',
          title: `${user.name || user.username}`,
          body: preview,
          data: JSON.stringify({
            conversationId,
            messageId: message.id,
            senderId: user.id,
            conversationType: conv.type,
            groupName: conv.type === 'group' ? conv.name : undefined,
          }),
        },
      })
    }

    return ok(
      {
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: message.sender,
          content: message.content,
          type: message.type,
          mediaUrl: message.mediaUrl,
          voiceDuration: message.voiceDuration,
          stickerId: message.stickerId,
          replyToId: message.replyToId,
          replyTo: message.replyTo
            ? {
                id: message.replyTo.id,
                content: message.replyTo.content,
                type: message.replyTo.type,
                sender: message.replyTo.sender,
                deletedAt: message.replyTo.deletedAt,
              }
            : null,
          reactions: message.reactions,
          editedAt: message.editedAt,
          deletedAt: message.deletedAt,
          pinnedAt: message.pinnedAt,
          seenBy: message.seenBy,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      },
      201,
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

function buildPreview(content: string, type: string): string {
  switch (type) {
    case 'image':
      return '📷 Photo'
    case 'voice':
      return '🎤 Voice message'
    case 'sticker':
      return '🎨 Sticker'
    case 'system':
      return content || 'System message'
    default:
      return content || 'New message'
  }
}
