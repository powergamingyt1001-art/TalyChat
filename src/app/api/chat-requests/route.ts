import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/chat-requests — create a chat request from current user to receiver
// Body: { receiverId, message? }
// Validation:
//   - cannot request yourself
//   - cannot request if blocked (either direction)
//   - cannot request if a pending request already exists (either direction)
//   - cannot request if a private conversation already exists between the two
// Returns the request (with receiver info).
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { receiverId, message } = body || {}

    if (!receiverId) return jsonError(400, 'receiverId is required')
    if (receiverId === user.id) {
      return jsonError(400, 'Cannot send a chat request to yourself')
    }

    const receiver = await db.user.findUnique({
      where: { id: String(receiverId) },
      select: { id: true, isBlocked: true, role: true },
    })
    if (!receiver) return jsonError(404, 'Receiver not found')
    if (receiver.isBlocked) return jsonError(403, 'This account is not available')

    // Block check (either direction)
    const block = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: receiver.id },
          { blockerId: receiver.id, blockedId: user.id },
        ],
      },
    })
    if (block) {
      return jsonError(403, 'Cannot send a chat request to this user (blocked)')
    }

    // Pending request check (either direction)
    const pending = await db.chatRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { senderId: user.id, receiverId: receiver.id },
          { senderId: receiver.id, receiverId: user.id },
        ],
      },
    })
    if (pending) {
      return jsonError(409, 'A pending chat request already exists between you and this user')
    }

    // Existing private conversation check (either direction)
    const existingConv = await db.conversation.findFirst({
      where: {
        type: 'private',
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: receiver.id } } },
        ],
      },
    })
    if (existingConv) {
      return jsonError(409, 'A conversation already exists with this user')
    }

    // Upsert because of @@unique([senderId, receiverId]) — if a previously
    // rejected/decided request exists in this direction, reset to pending.
    const request = await db.chatRequest.upsert({
      where: { senderId_receiverId: { senderId: user.id, receiverId: receiver.id } },
      update: {
        message: typeof message === 'string' ? message : '',
        status: 'pending',
        decidedAt: null,
        createdAt: new Date(),
      },
      create: {
        senderId: user.id,
        receiverId: receiver.id,
        message: typeof message === 'string' ? message : '',
        status: 'pending',
      },
      include: {
        receiver: {
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
        sender: {
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
    })

    return ok({ request }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// GET /api/chat-requests — list pending chat requests sent to me (receiverId = me)
// Includes sender info.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const requests = await db.chatRequest.findMany({
      where: { receiverId: user.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true,
            gender: true,
            isOnline: true,
            isPremium: true,
            premiumTier: true,
            lastSeen: true,
          },
        },
      },
    })

    return ok({
      requests: requests.map((r) => ({
        id: r.id,
        senderId: r.senderId,
        receiverId: r.receiverId,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        sender: r.sender,
      })),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
