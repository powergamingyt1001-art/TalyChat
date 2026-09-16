import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/account/delete — permanently (soft-)delete the current user's account.
// Body: { password: string, confirmText: string }
//   - password: verified against passwordHash (bcrypt)
//   - confirmText: must equal "DELETE" exactly (double-confirmation)
// Returns: { ok: true } on success.
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const password = String(body?.password || '')
    const confirmText = String(body?.confirmText || '')

    if (!password) return jsonError(400, 'Password is required')
    if (confirmText !== 'DELETE') {
      return jsonError(400, 'Confirmation text must be exactly "DELETE"')
    }

    // Re-fetch the user's passwordHash + auth provider
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true, authProvider: true, email: true, username: true },
    })
    if (!me) return jsonError(404, 'Account not found')

    // OAuth users may not have a password — they must set one first.
    if (!me.passwordHash) {
      return jsonError(400, 'No password set on this account. Set a password in Settings before deleting.')
    }

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, me.passwordHash)
    if (!valid) {
      return jsonError(401, 'Incorrect password')
    }

    // ----- Soft-delete: anonymize the user -----
    await db.user.update({
      where: { id: user.id },
      data: {
        isBlocked: true,
        blockedUntil: null,
        banReason: 'Self-deleted',
        name: 'Deleted User',
        bio: '',
        avatar: '',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        isOnline: false,
      },
    })

    // ----- Soft-delete all messages this user sent -----
    const now = new Date()
    await db.message.updateMany({
      where: { senderId: user.id, deletedAt: null },
      data: { deletedAt: now },
    })

    // ----- Group memberships: remove from groups. If owner, transfer or delete. -----
    const ownedGroups = await db.group.findMany({
      where: { ownerId: user.id },
      include: {
        members: {
          where: { userId: { not: user.id } },
          orderBy: { joinedAt: 'asc' },
          take: 1,
        },
      },
    })

    for (const g of ownedGroups) {
      const successor = g.members[0]
      if (successor) {
        // Transfer ownership to the oldest remaining member.
        await db.groupMember.update({
          where: { id: successor.id },
          data: { role: 'owner' },
        })
        await db.group.update({
          where: { id: g.id },
          data: { ownerId: successor.userId },
        })
        if (g.conversation) {
          // Defensive — we may not have loaded conversation id; re-fetch
          const conv = await db.conversation.findFirst({
            where: { groupId: g.id },
            select: { id: true },
          })
          if (conv) {
            await db.conversation.updateMany({
              where: { groupId: g.id },
              data: { ownerId: successor.userId },
            })
            await db.conversationMember.updateMany({
              where: { conversationId: conv.id, userId: successor.userId },
              data: { role: 'owner' },
            })
          }
        }
      } else {
        // No one else — delete the group (cascade handles memberships/conversation).
        await db.group.delete({ where: { id: g.id } }).catch(() => {})
      }
    }

    // Remove all remaining group memberships (where this user was a regular member/admin).
    await db.groupMember.deleteMany({ where: { userId: user.id } })

    // ----- Conversation memberships -----
    // For each conversation the user is a member of:
    //  - If they're the only member, delete the whole conversation.
    //  - Otherwise, leave (delete just their membership row).
    const myMemberships = await db.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    })
    for (const m of myMemberships) {
      const convId = m.conversationId
      const remaining = await db.conversationMember.count({
        where: { conversationId: convId, userId: { not: user.id } },
      })
      await db.conversationMember.deleteMany({
        where: { conversationId: convId, userId: user.id },
      })
      if (remaining === 0) {
        await db.conversation.delete({ where: { id: convId } }).catch(() => {})
      }
    }

    // ----- Revoke push subscriptions + scheduled messages -----
    await db.pushSubscription.deleteMany({ where: { userId: user.id } })
    await db.scheduledMessage.updateMany({
      where: { senderId: user.id, isSent: false, isCancelled: false },
      data: { isCancelled: true },
    })

    return ok({ ok: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
