import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { emitScheduledMessage } from '@/lib/realtime-emit'

export const runtime = 'nodejs'

// POST /api/messages/schedule/process — process due scheduled messages.
//
// Finds all ScheduledMessage rows where:
//   isSent = false AND isCancelled = false AND scheduledFor <= now
// and "sends" them — i.e. creates a real Message record via the same
// logic as POST /api/messages (content/type/mediaUrl/replyToId copied,
// senderId preserved), creates notifications for other members, emits
// a `message:send` socket event so realtime clients receive the new
// message live, then marks the ScheduledMessage as isSent=true with
// sentAt=now.
//
// Auth: this endpoint is callable either by an authenticated user
// (the in-app polling in taly-app.tsx hits it every 60s) OR by an
// external cron job passing an `x-cron-token` header. The token is
// read from the CRON_TOKEN env var; if unset, the endpoint allows
// any caller (development convenience).

const CRON_TOKEN = process.env.CRON_TOKEN || ''

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

function authorize(req: NextRequest): boolean {
  if (req.headers.get('x-cron-token') === CRON_TOKEN && CRON_TOKEN) {
    return true
  }
  // If no CRON_TOKEN is configured, allow any caller (dev convenience).
  // In production, set CRON_TOKEN to lock this down.
  if (!CRON_TOKEN) return true
  // Also accept the standard x-user-id header (authenticated polling).
  const userId = req.headers.get('x-user-id')
  return !!userId
}

export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    if (!authorize(req)) {
      return jsonError(401, 'Unauthorized')
    }

    const now = new Date()
    // Pull a batch of due scheduled messages.
    const due = await db.scheduledMessage.findMany({
      where: {
        isSent: false,
        isCancelled: false,
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    })

    if (due.length === 0) {
      return ok({ processed: 0, sent: [] })
    }

    // Pre-load sender + conversation info to avoid N+1 queries inside the
    // processing loop.
    const senderIds = Array.from(new Set(due.map((s) => s.senderId)))
    const convIds = Array.from(new Set(due.map((s) => s.conversationId)))
    const senders = await db.user.findMany({
      where: { id: { in: senderIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isPremium: true,
        premiumTier: true,
        isOnline: true,
        role: true,
        isRestricted: true,
        restrictedUntil: true,
      },
    })
    const senderMap = new Map(senders.map((u) => [u.id, u]))

    const conversations = await db.conversation.findMany({
      where: { id: { in: convIds } },
      include: { members: { select: { userId: true, role: true } } },
    })
    const convMap = new Map(conversations.map((c) => [c.id, c]))

    let processed = 0
    const sentList: Array<{ id: string; messageId: string | null }> = []

    for (const sm of due) {
      const sender = senderMap.get(sm.senderId)
      const conv = convMap.get(sm.conversationId)

      // Defensive: if the sender or conversation no longer exists, mark as
      // sent (so we don't retry forever) without creating a real message.
      if (!sender || !conv) {
        await db.scheduledMessage.update({
          where: { id: sm.id },
          data: { isSent: true, sentAt: new Date() },
        })
        processed++
        sentList.push({ id: sm.id, messageId: null })
        continue
      }

      // Restricted senders cannot post to group conversations. Skip sending
      // but mark as processed to avoid retry loops.
      const isRestrictedNow =
        sender.role !== 'admin' &&
        conv.type === 'group' &&
        sender.isRestricted &&
        (!sender.restrictedUntil || sender.restrictedUntil.getTime() > now.getTime())
      if (isRestrictedNow) {
        await db.scheduledMessage.update({
          where: { id: sm.id },
          data: { isSent: true, sentAt: now },
        })
        processed++
        sentList.push({ id: sm.id, messageId: null })
        continue
      }

      // Create the real message.
      const message = await db.message.create({
        data: {
          conversationId: sm.conversationId,
          senderId: sm.senderId,
          content: sm.content || '',
          type: sm.type || 'text',
          mediaUrl: sm.mediaUrl || null,
          replyToId: sm.replyToId || null,
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

      // Bump conversation order.
      await db.conversation.update({
        where: { id: sm.conversationId },
        data: { updatedAt: now },
      })

      // Create notifications for other members.
      const otherMemberIds = conv.members
        .map((m) => m.userId)
        .filter((uid) => uid !== sm.senderId)
      const notifyIds: string[] = []
      if (conv.type === 'private') {
        notifyIds.push(...otherMemberIds)
      } else if (!conv.muted) {
        notifyIds.push(...otherMemberIds)
      }

      const preview = buildPreview(message.content, message.type)
      const senderName = sender.name || sender.username
      for (const uid of notifyIds) {
        try {
          await db.notification.create({
            data: {
              userId: uid,
              type: 'message',
              title: `${senderName}`,
              body: preview,
              data: JSON.stringify({
                conversationId: sm.conversationId,
                messageId: message.id,
                senderId: sm.senderId,
                conversationType: conv.type,
                groupName: conv.type === 'group' ? conv.name : undefined,
              }),
            },
          })
        } catch {
          // Non-fatal — notification failures shouldn't block the send.
        }
      }

      // Mark scheduled message as sent.
      await db.scheduledMessage.update({
        where: { id: sm.id },
        data: { isSent: true, sentAt: now },
      })

      // Emit socket event so realtime clients receive the message live.
      // Fire-and-forget; if the chat-service is unreachable the message is
      // still persisted and clients will see it on the next polling tick.
      const serialized = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        sender: message.sender,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        voiceDuration: message.voiceDuration ?? null,
        stickerId: message.stickerId ?? null,
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
      }
      void emitScheduledMessage(sm.conversationId, serialized)

      processed++
      sentList.push({ id: sm.id, messageId: message.id })
    }

    return ok({ processed, sent: sentList })
  } catch (e: any) {
    return jsonError(500, e.message)
  }
}
