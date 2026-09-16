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

// GET /api/groups/[id] — group details with members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const group = await db.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
          orderBy: { joinedAt: 'asc' },
        },
        conversation: true,
      },
    })

    if (!group) return jsonError(404, 'Group not found')

    // Visibility: members can view; non-public restricted to members
    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!group.isPublic && !myMembership) {
      return jsonError(403, 'You are not a member of this private group')
    }

    const members = group.members.map((m: any) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: serializeUser(m.user),
    }))

    return ok({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        logo: group.logo,
        category: group.category,
        isPublic: group.isPublic,
        inviteCode: group.inviteCode,
        ownerId: group.ownerId,
        creatorId: group.creatorId,
        membersCount: group.membersCount,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        conversationId: group.conversation?.id || null,
        members,
        myRole: myMembership?.role || null,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/groups/[id] — update group (owner/admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only owner or admin can update this group')
    }

    const allowed: any = {}
    const fields = ['name', 'description', 'logo', 'category', 'isPublic']
    for (const k of fields) {
      if (k in body) allowed[k] = body[k]
    }

    if (allowed.name !== undefined && (!allowed.name || !String(allowed.name).trim())) {
      return jsonError(400, 'name cannot be empty')
    }

    const updated = await db.group.update({
      where: { id },
      data: allowed,
    })

    // keep conversation name in sync if name changed
    if (allowed.name) {
      await db.conversation.updateMany({
        where: { groupId: id },
        data: { name: allowed.name },
      })
    }

    return ok({
      group: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        logo: updated.logo,
        category: updated.category,
        isPublic: updated.isPublic,
        inviteCode: updated.inviteCode,
        ownerId: updated.ownerId,
        membersCount: updated.membersCount,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
