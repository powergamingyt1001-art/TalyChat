import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// DELETE /api/messages/schedule/[id] — cancel a scheduled message
// (sets isCancelled=true). Only the original sender can cancel.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const sm = await db.scheduledMessage.findUnique({
      where: { id },
      select: { senderId: true, isSent: true, isCancelled: true },
    })
    if (!sm) return jsonError(404, 'Scheduled message not found')
    if (sm.senderId !== user.id) {
      return jsonError(403, 'Only the sender can cancel this message')
    }
    if (sm.isSent) {
      return jsonError(400, 'Cannot cancel a message that has already been sent')
    }
    if (sm.isCancelled) {
      // Idempotent — already cancelled.
      return ok({ ok: true })
    }

    await db.scheduledMessage.update({
      where: { id },
      data: { isCancelled: true },
    })
    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/messages/schedule/[id] — update the scheduled time.
// Sender only. Body: { scheduledFor }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { scheduledFor } = body || {}

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

    const sm = await db.scheduledMessage.findUnique({
      where: { id },
      select: { senderId: true, isSent: true, isCancelled: true },
    })
    if (!sm) return jsonError(404, 'Scheduled message not found')
    if (sm.senderId !== user.id) {
      return jsonError(403, 'Only the sender can edit this message')
    }
    if (sm.isSent) {
      return jsonError(400, 'Cannot edit a message that has already been sent')
    }
    if (sm.isCancelled) {
      return jsonError(400, 'Cannot edit a cancelled message')
    }

    const updated = await db.scheduledMessage.update({
      where: { id },
      data: { scheduledFor: when },
    })
    return ok({
      scheduledMessage: {
        id: updated.id,
        senderId: updated.senderId,
        conversationId: updated.conversationId,
        content: updated.content,
        type: updated.type,
        mediaUrl: updated.mediaUrl,
        replyToId: updated.replyToId,
        scheduledFor: updated.scheduledFor,
        isSent: updated.isSent,
        isCancelled: updated.isCancelled,
        createdAt: updated.createdAt,
        sentAt: updated.sentAt,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
