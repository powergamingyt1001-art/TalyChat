import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

function serializeUser(u: any) {
  if (!u) return null
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    bio: u.bio,
    gender: u.gender,
    isPremium: u.isPremium,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
    role: u.role,
  }
}

// GET /api/groups/[id]/members — list members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    // Private groups require membership to read
    if (!group.isPublic) {
      const myMembership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId: id, userId: user.id } },
      })
      if (!myMembership) {
        return jsonError(403, 'You are not a member of this private group')
      }
    }

    const members = await db.groupMember.findMany({
      where: { groupId: id },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    })

    return ok({
      members: members.map((m: any) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: serializeUser(m.user),
      })),
      membersCount: group.membersCount,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/groups/[id]/members — add a member (owner/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { userId } = body || {}

    if (!userId) return jsonError(400, 'userId is required')

    const group = await db.group.findUnique({
      where: { id },
      include: { conversation: true },
    })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only owner or admin can add members')
    }

    const targetUser = await db.user.findUnique({ where: { id: String(userId) } })
    if (!targetUser) return jsonError(404, 'User not found')

    // Idempotent
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: String(userId) } },
    })
    if (existing) {
      return ok({
        added: false,
        alreadyMember: true,
        member: {
          id: existing.id,
          role: existing.role,
          joinedAt: existing.joinedAt,
          user: serializeUser(targetUser),
        },
      })
    }

    const membership = await db.groupMember.create({
      data: { groupId: id, userId: String(userId), role: 'member' },
    })

    if (group.conversation) {
      try {
        await db.conversationMember.create({
          data: {
            conversationId: group.conversation.id,
            userId: String(userId),
            role: 'member',
          },
        })
      } catch {}
    }

    await db.group.update({
      where: { id },
      data: { membersCount: { increment: 1 } },
    })

    return ok(
      {
        added: true,
        alreadyMember: false,
        member: {
          id: membership.id,
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: serializeUser(targetUser),
        },
      },
      201,
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
