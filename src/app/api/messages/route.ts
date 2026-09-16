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
        forwardedFrom: {
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
            premiumTier: true,
            isOnline: true,
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
        forwardedFromId: m.forwardedFromId || null,
        forwardedFrom: m.forwardedFrom
          ? {
              id: m.forwardedFrom.id,
              content: m.forwardedFrom.content,
              type: m.forwardedFrom.type,
              mediaUrl: m.forwardedFrom.mediaUrl,
              sender: m.forwardedFrom.sender,
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
      forwardedFromId,
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

    // Behavior check: behaviorScore must be >= 50 to send messages.
    // (Admins are exempt.)
    if (user.role !== 'admin') {
      const me = await db.user.findUnique({
        where: { id: user.id },
        select: { behaviorScore: true },
      })
      if (me && me.behaviorScore < 50) {
        return jsonError(403, 'Behavior too low. Watch ads to increase your score.')
      }
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

    // Forwarding: if forwardedFromId is provided, fetch the original message
    // and copy its content/type/mediaUrl/voiceDuration/stickerId. The new
    // message's senderId is the current user, replyToId is null (forwards are
    // not replies), and forwardedFromId points to the original message.
    let forwardedPayload: {
      content: string
      type: string
      mediaUrl: string | null
      voiceDuration: number | null
      stickerId: string | null
    } | null = null
    if (forwardedFromId) {
      const original = await db.message.findUnique({
        where: { id: forwardedFromId },
        select: {
          id: true,
          content: true,
          type: true,
          mediaUrl: true,
          voiceDuration: true,
          stickerId: true,
          deletedAt: true,
        },
      })
      if (!original) {
        return jsonError(404, 'Original message for forwarding not found')
      }
      if (original.deletedAt) {
        return jsonError(400, 'Cannot forward a deleted message')
      }
      forwardedPayload = {
        content: original.content,
        type: original.type,
        mediaUrl: original.mediaUrl,
        voiceDuration: original.voiceDuration,
        stickerId: original.stickerId,
      }
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: forwardedPayload ? forwardedPayload.content : (content || ''),
        type: forwardedPayload ? forwardedPayload.type : msgType,
        mediaUrl: forwardedPayload ? forwardedPayload.mediaUrl : (mediaUrl || null),
        voiceDuration: forwardedPayload
          ? forwardedPayload.voiceDuration
          : voiceDuration !== undefined && voiceDuration !== null
            ? Number(voiceDuration)
            : null,
        stickerId: forwardedPayload ? forwardedPayload.stickerId : (stickerId || null),
        replyToId: forwardedPayload ? null : (replyToId || null),
        forwardedFromId: forwardedFromId || null,
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
        forwardedFrom: {
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
            premiumTier: true,
            isOnline: true,
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
          forwardedFromId: message.forwardedFromId || null,
          forwardedFrom: message.forwardedFrom
            ? {
                id: message.forwardedFrom.id,
                content: message.forwardedFrom.content,
                type: message.forwardedFrom.type,
                mediaUrl: message.forwardedFrom.mediaUrl,
                sender: message.forwardedFrom.sender,
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
