import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { emitScheduledMessage } from '@/lib/realtime-emit'
import { sendPushToUser } from '@/lib/push'

export const runtime = 'nodejs'

// ============================================================
// POST /api/stories/:id/reply
// ============================================================
// Reply to a story (Instagram-style). Sends the user's message to
// the story author's private conversation, prefixed with a short
// reference to the story so the author has context.
//
// Body: { message: string }
// Returns: { conversationId, messageId }
//
// Validation:
//   - User must be authenticated.
//   - Story must exist + not be expired + not be deleted.
//   - Cannot reply to your own story (frontend hides the input for
//     own stories — this is a defensive check).
//   - Block check (either direction).
//
// The reply is a regular text message with a prefix like:
//   "📷 Reply to your story \"Hello\": <user message>"
// or for image stories:
//   "📷 Reply to your photo story: <user message>"
// ============================================================

const MAX_REPLY_LENGTH = 1000

function buildStoryPreview(story: { type: string; content: string; caption: string | null }): string {
  if (story.type === 'image') {
    if (story.caption && story.caption.trim()) {
      const c = story.caption.trim()
      return `Photo${c.length > 40 ? ` "${c.slice(0, 40)}…"` : ` "${c}"`}`
    }
    return 'your photo'
  }
  // text story
  const text = (story.content || '').trim()
  if (!text) return 'your story'
  if (text.length > 40) return `"${text.slice(0, 40)}…"`
  return `"${text}"`
}

function buildReplyContent(
  story: { type: string; content: string; caption: string | null },
  userMessage: string,
): string {
  const preview = buildStoryPreview(story)
  return `📷 Reply to your story ${preview}: ${userMessage}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const message = (body?.message ?? '').toString().trim()

    if (!message) {
      return jsonError(400, 'Message is required')
    }
    if (message.length > MAX_REPLY_LENGTH) {
      return jsonError(
        400,
        `Reply too long (max ${MAX_REPLY_LENGTH} characters)`,
      )
    }

    // ----- Fetch story -----
    const story = await db.story.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        type: true,
        content: true,
        caption: true,
        expiresAt: true,
        isDeleted: true,
      },
    })
    if (!story) return jsonError(404, 'Story not found')
    if (story.isDeleted) return jsonError(404, 'Story no longer available')
    if (story.expiresAt.getTime() < Date.now()) {
      return jsonError(410, 'Story has expired')
    }
    if (story.userId === user.id) {
      return jsonError(400, 'Cannot reply to your own story')
    }

    // ----- Block check (either direction) -----
    const block = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: story.userId },
          { blockerId: story.userId, blockedId: user.id },
        ],
      },
    })
    if (block) {
      return jsonError(403, 'Cannot message this user (blocked)')
    }

    // ----- Find or create private conversation with story author -----
    const existing = await db.conversation.findFirst({
      where: {
        type: 'private',
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: story.userId } } },
        ],
      },
      include: {
        members: { select: { userId: true, role: true } },
      },
    })

    let conversationId: string
    let otherMemberIds: string[]

    if (existing) {
      // Ensure current user is still a member (could have left earlier)
      const meStillMember = existing.members.some((m) => m.userId === user.id)
      if (!meStillMember) {
        await db.conversationMember.create({
          data: { conversationId: existing.id, userId: user.id },
        })
      }
      conversationId = existing.id
      otherMemberIds = existing.members
        .map((m) => m.userId)
        .filter((uid) => uid !== user.id)
      // If we re-added ourselves, the other side is still just the story author.
      if (!otherMemberIds.includes(story.userId)) {
        otherMemberIds.push(story.userId)
      }
    } else {
      const conv = await db.conversation.create({
        data: {
          type: 'private',
          ownerId: user.id,
          members: {
            create: [
              { userId: user.id, role: 'member' },
              { userId: story.userId, role: 'member' },
            ],
          },
        },
        include: {
          members: { select: { userId: true, role: true } },
        },
      })
      conversationId = conv.id
      otherMemberIds = conv.members
        .map((m) => m.userId)
        .filter((uid) => uid !== user.id)
    }

    // ----- Create the reply message -----
    const replyContent = buildReplyContent(story, message)
    const created = await db.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: replyContent,
        type: 'text',
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

    // ----- Notification + push for the story author -----
    const preview = `📷 ${message.slice(0, 80)}${message.length > 80 ? '…' : ''}`
    for (const uid of otherMemberIds) {
      try {
        await db.notification.create({
          data: {
            userId: uid,
            type: 'message',
            title: `${user.name || user.username}`,
            body: preview,
            data: JSON.stringify({
              conversationId,
              messageId: created.id,
              senderId: user.id,
              conversationType: 'private',
            }),
          },
        })
      } catch {
        // Non-fatal
      }
      try {
        void sendPushToUser(uid, {
          title: `${user.name || user.username}`,
          body: preview,
          conversationId,
          messageId: created.id,
          senderId: user.id,
          tag: `conv:${conversationId}`,
        })
      } catch {
        // Ignore — push must not break reply
      }
    }

    // ----- Emit socket event for live delivery -----
    const serialized = {
      id: created.id,
      conversationId: created.conversationId,
      senderId: created.senderId,
      sender: created.sender,
      content: created.content,
      type: created.type,
      mediaUrl: created.mediaUrl,
      voiceDuration: created.voiceDuration ?? null,
      stickerId: created.stickerId ?? null,
      replyToId: created.replyToId,
      replyTo: created.replyTo
        ? {
            id: created.replyTo.id,
            content: created.replyTo.content,
            type: created.replyTo.type,
            sender: created.replyTo.sender,
            deletedAt: created.replyTo.deletedAt,
          }
        : null,
      forwardedFromId: created.forwardedFromId || null,
      forwardedFrom: created.forwardedFrom
        ? {
            id: created.forwardedFrom.id,
            content: created.forwardedFrom.content,
            type: created.forwardedFrom.type,
            mediaUrl: created.forwardedFrom.mediaUrl,
            sender: created.forwardedFrom.sender,
          }
        : null,
      reactions: created.reactions,
      editedAt: created.editedAt,
      deletedAt: created.deletedAt,
      pinnedAt: created.pinnedAt,
      seenBy: created.seenBy,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }
    void emitScheduledMessage(conversationId, serialized)

    return ok(
      {
        conversationId,
        messageId: created.id,
      },
      201,
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
