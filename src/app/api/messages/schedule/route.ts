import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// POST /api/messages/schedule — schedule a message for a future time.
// Body: { conversationId, content, type?, mediaUrl?, replyToId?, scheduledFor }
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
      replyToId,
      scheduledFor,
    } = body || {}

    if (!conversationId) {
      return jsonError(400, 'conversationId is required')
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''
    // Image messages may have empty text content (only mediaUrl).
    const msgType = type || 'text'
    if (!['text', 'image'].includes(msgType)) {
      return jsonError(400, 'Invalid message type — only text or image can be scheduled')
    }
    if (msgType === 'text' && !trimmedContent) {
      return jsonError(400, 'content is required')
    }
    if (msgType === 'image' && !mediaUrl) {
      return jsonError(400, 'mediaUrl is required for image messages')
    }

    if (!scheduledFor) {
      return jsonError(400, 'scheduledFor is required')
    }
    const when = new Date(scheduledFor)
    if (isNaN(when.getTime())) {
      return jsonError(400, 'scheduledFor must be a valid ISO date string')
    }
    const now = new Date()
    if (when.getTime() <= now.getTime()) {
      return jsonError(400, 'scheduledFor must be in the future')
    }
    if (when.getTime() - now.getTime() > MAX_SCHEDULE_AHEAD_MS) {
      return jsonError(400, 'scheduledFor cannot be more than 30 days in the future')
    }

    // Privacy: sender must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // Behavior check (mirrors POST /api/messages).
    if (user.role !== 'admin') {
      const me = await db.user.findUnique({
        where: { id: user.id },
        select: { behaviorScore: true },
      })
      if (me && me.behaviorScore < 50) {
        return jsonError(403, 'Behavior too low. Watch ads to increase your score.')
      }
    }

    // Validate replyToId if provided.
    if (replyToId) {
      const reply = await db.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true },
      })
      if (!reply || reply.conversationId !== conversationId) {
        return jsonError(400, 'replyToId must belong to the same conversation')
      }
    }

    const scheduled = await db.scheduledMessage.create({
      data: {
        senderId: user.id,
        conversationId,
        content: trimmedContent,
        type: msgType,
        mediaUrl: mediaUrl || null,
        replyToId: replyToId || null,
        scheduledFor: when,
        isSent: false,
        isCancelled: false,
      },
    })

    return ok({ scheduledMessage: serializeScheduled(scheduled) }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// GET /api/messages/schedule — list the current user's pending scheduled
// messages (isSent=false, isCancelled=false), sorted by scheduledFor asc.
// Includes conversation info (id, type, name, avatar, otherUser) so the
// UI can render a label without a second round-trip.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const list = await db.scheduledMessage.findMany({
      where: {
        senderId: user.id,
        isSent: false,
        isCancelled: false,
      },
      orderBy: { scheduledFor: 'asc' },
    })

    if (list.length === 0) {
      return ok({ scheduledMessages: [] })
    }

    // Hydrate conversation info for each scheduled message.
    const convIds = Array.from(new Set(list.map((s) => s.conversationId)))
    const conversations = await db.conversation.findMany({
      where: { id: { in: convIds } },
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
                isPremium: true,
                premiumTier: true,
              },
            },
          },
        },
        group: { select: { id: true, name: true, logo: true } },
      },
    })
    const convMap = new Map(conversations.map((c) => [c.id, c]))

    const out = list.map((s) => {
      const conv = convMap.get(s.conversationId)
      let otherUser: any = null
      if (conv && conv.type === 'private') {
        const otherMember = conv.members.find((m) => m.userId !== user.id)
        otherUser = otherMember?.user || null
      }
      return {
        ...serializeScheduled(s),
        conversation: conv
          ? {
              id: conv.id,
              type: conv.type,
              name: conv.name,
              avatar: conv.avatar,
              group: conv.group
                ? { id: conv.group.id, name: conv.group.name, logo: conv.group.logo }
                : null,
              otherUser,
            }
          : null,
      }
    })

    return ok({ scheduledMessages: out })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

function serializeScheduled(s: any) {
  return {
    id: s.id,
    senderId: s.senderId,
    conversationId: s.conversationId,
    content: s.content,
    type: s.type,
    mediaUrl: s.mediaUrl,
    replyToId: s.replyToId,
    scheduledFor: s.scheduledFor,
    isSent: s.isSent,
    isCancelled: s.isCancelled,
    createdAt: s.createdAt,
    sentAt: s.sentAt,
  }
}
