import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/messages/search?q=xxx
// Search messages across all conversations the current user is a member of.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    if (q.trim().length < 2) {
      return ok({ results: [], total: 0 })
    }
    const query = q.trim().toLowerCase()

    // Find all conversations the user is a member of
    const memberships = await db.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    })
    const conversationIds = memberships.map((m) => m.conversationId)
    if (conversationIds.length === 0) {
      return ok({ results: [], total: 0 })
    }

    // Search messages (case-insensitive via SQLite LIKE)
    const messages = await db.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        deletedAt: null,
        content: { contains: query },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatar: true, isPremium: true, premiumTier: true },
        },
        conversation: {
          select: {
            id: true,
            type: true,
            name: true,
            avatar: true,
            members: {
              where: { userId: { not: user.id } },
              take: 1,
              include: {
                user: {
                  select: { id: true, name: true, username: true, avatar: true, isOnline: true, isPremium: true, premiumTier: true },
                },
              },
            },
          },
        },
      },
    })

    const results = messages.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt,
      sender: m.sender,
      conversationId: m.conversationId,
      conversationName:
        m.conversation.type === 'private'
          ? m.conversation.members[0]?.user?.name || 'Unknown'
          : m.conversation.name || 'Group',
      conversationAvatar:
        m.conversation.type === 'private'
          ? m.conversation.members[0]?.user?.avatar
          : m.conversation.avatar,
      conversationType: m.conversation.type,
      otherUserId: m.conversation.type === 'private' ? m.conversation.members[0]?.user?.id : null,
    }))

    return ok({ results, total: results.length })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
