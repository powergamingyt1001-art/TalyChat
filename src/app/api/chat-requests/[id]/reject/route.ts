import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/chat-requests/[id]/reject
// - Only the receiver can reject.
// - Sets status=rejected, decidedAt=now.
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const request = await db.chatRequest.findUnique({ where: { id } })
    if (!request) return jsonError(404, 'Chat request not found')
    if (request.receiverId !== user.id) {
      return jsonError(403, 'Only the receiver can reject this request')
    }
    if (request.status !== 'pending') {
      return jsonError(400, `Request already ${request.status}`)
    }

    await db.chatRequest.update({
      where: { id: request.id },
      data: { status: 'rejected', decidedAt: new Date() },
    })

    return ok({ ok: true, id: request.id, status: 'rejected' })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
