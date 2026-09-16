import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// PUT /api/messages/:id — edit own message (content only, sets editedAt)
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const { content } = body || {}

    if (typeof content !== 'string') {
      return jsonError(400, 'content is required and must be a string')
    }

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    })
    if (!message) return jsonError(404, 'Message not found')
    if (message.senderId !== user.id) {
      return jsonError(403, 'You can only edit your own messages')
    }
    if (message.deletedAt) {
      return jsonError(400, 'Cannot edit a deleted message')
    }

    const updated = await db.message.update({
      where: { id },
      data: {
        content,
        editedAt: new Date(),
      },
      include: {
        reactions: true,
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
      },
    })

    return ok({
      message: {
        id: updated.id,
        conversationId: updated.conversationId,
        senderId: updated.senderId,
        sender: updated.sender,
        content: updated.content,
        type: updated.type,
        mediaUrl: updated.mediaUrl,
        voiceDuration: updated.voiceDuration,
        stickerId: updated.stickerId,
        replyToId: updated.replyToId,
        replyTo: updated.replyTo
          ? {
              id: updated.replyTo.id,
              content: updated.replyTo.content,
              type: updated.replyTo.type,
              sender: updated.replyTo.sender,
              deletedAt: updated.replyTo.deletedAt,
            }
          : null,
        forwardedFromId: updated.forwardedFromId || null,
        forwardedFrom: updated.forwardedFrom
          ? {
              id: updated.forwardedFrom.id,
              content: updated.forwardedFrom.content,
              type: updated.forwardedFrom.type,
              mediaUrl: updated.forwardedFrom.mediaUrl,
              sender: updated.forwardedFrom.sender,
            }
          : null,
        reactions: updated.reactions,
        editedAt: updated.editedAt,
        deletedAt: updated.deletedAt,
        pinnedAt: updated.pinnedAt,
        seenBy: updated.seenBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/messages/:id — soft delete own message (sender only OR admin)
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const message = await db.message.findUnique({
      where: { id },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    })
    if (!message) return jsonError(404, 'Message not found')

    const isAdmin = user.role === 'admin'
    if (message.senderId !== user.id && !isAdmin) {
      return jsonError(403, 'You can only delete your own messages')
    }
    if (message.deletedAt) {
      // Already deleted — idempotent
      return ok({ deleted: true, alreadyDeleted: true })
    }

    await db.message.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return ok({ deleted: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
