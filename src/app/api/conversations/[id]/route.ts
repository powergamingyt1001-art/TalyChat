import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/conversations/:id — get a conversation by id (must be a member)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const conv = await db.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                bio: true,
                isOnline: true,
                lastSeen: true,
                isPremium: true,
                premiumTier: true,
              },
            },
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            logo: true,
            description: true,
            category: true,
            isPublic: true,
            inviteCode: true,
            membersCount: true,
            ownerId: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    })

    if (!conv) return jsonError(404, 'Conversation not found')

    const meMember = conv.members.find((m) => m.userId === user.id)
    if (!meMember) return jsonError(403, 'Not a member of this conversation')

    const lastMessage = conv.messages[0] || null
    const otherMember =
      conv.type === 'private'
        ? conv.members.find((m) => m.userId !== user.id) || null
        : null

    return ok({
      conversation: {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatar: conv.avatar,
        ownerId: conv.ownerId,
        groupId: conv.groupId,
        wallpaper: conv.wallpaper,
        themeColor: conv.themeColor,
        muted: conv.muted,
        pinned: conv.pinned,
        autoDeleteAfter: conv.autoDeleteAfter,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        group: conv.group,
        otherUser: otherMember ? otherMember.user : null,
        members: conv.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          lastReadAt: m.lastReadAt,
          user: m.user,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              mediaUrl: lastMessage.mediaUrl,
              voiceDuration: lastMessage.voiceDuration,
              stickerId: lastMessage.stickerId,
              createdAt: lastMessage.createdAt,
              deletedAt: lastMessage.deletedAt,
              sender: lastMessage.sender,
            }
          : null,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/conversations/:id — update mutable fields (members only)
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    const meMember = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
    })
    if (!meMember) return jsonError(403, 'Not a member of this conversation')

    const data: any = {}
    if ('muted' in body) data.muted = Boolean(body.muted)
    if ('pinned' in body) data.pinned = Boolean(body.pinned)
    if ('wallpaper' in body) data.wallpaper = body.wallpaper
    if ('themeColor' in body) {
      // V7 — per-conversation accent color. Accepts a hex string or null to reset.
      const raw = body.themeColor
      if (raw === null || raw === undefined || raw === '') {
        data.themeColor = null
      } else {
        // Validate hex color (e.g. #10b981 or #10B981)
        const hex = String(raw).trim()
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
          return jsonError(400, 'themeColor must be a 6-digit hex string like #10b981')
        }
        data.themeColor = hex.toLowerCase()
      }
    }
    if ('autoDeleteAfter' in body) {
      const v = body.autoDeleteAfter
      data.autoDeleteAfter = v === null || v === undefined ? null : Number(v)
    }

    const conv = await db.conversation.update({
      where: { id },
      data,
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            lastReadAt: true,
            joinedAt: true,
          },
        },
      },
    })

    return ok({ conversation: conv })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/conversations/:id — leave/delete conversation
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const conv = await db.conversation.findUnique({
      where: { id },
      include: { members: { select: { userId: true } } },
    })
    if (!conv) return jsonError(404, 'Conversation not found')

    const meMember = conv.members.find((m) => m.userId === user.id)
    if (!meMember) return jsonError(403, 'Not a member of this conversation')

    // Remove the user's membership. Other members keep theirs.
    await db.conversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
    })

    // If the conversation has no more members, delete it entirely.
    const remaining = await db.conversationMember.count({
      where: { conversationId: id },
    })
    if (remaining === 0) {
      await db.conversation.delete({ where: { id } })
      return ok({ left: true, deleted: true })
    }

    // For group conversations, also leave the linked Group.
    if (conv.type === 'group' && conv.groupId) {
      try {
        await db.groupMember.delete({
          where: { groupId_userId: { groupId: conv.groupId, userId: user.id } },
        })
        await db.group.update({
          where: { id: conv.groupId },
          data: { membersCount: { decrement: 1 } },
        })
      } catch {
        // Already not a member; ignore
      }
    }

    return ok({ left: true, deleted: false })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
