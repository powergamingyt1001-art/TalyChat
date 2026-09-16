import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function serializeAuthor(u: any) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    isPremium: u.isPremium,
    premiumTier: u.premiumTier,
  }
}

// POST /api/groups/[id]/announcements — create announcement (owner/admin only)
// Body: { content: string }
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const content = String(body?.content || '').trim()
    if (!content) return jsonError(400, 'Content cannot be empty')
    if (content.length > 2000) return jsonError(400, 'Content too long (max 2000 chars)')

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only the group owner or admin can post announcements')
    }

    const ann = await db.groupAnnouncement.create({
      data: {
        groupId: id,
        authorId: user.id,
        content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
            premiumTier: true,
          },
        },
      },
    })

    return ok({
      announcement: {
        id: ann.id,
        groupId: ann.groupId,
        authorId: ann.authorId,
        content: ann.content,
        isActive: ann.isActive,
        createdAt: ann.createdAt,
        updatedAt: ann.updatedAt,
        author: serializeAuthor(ann.author),
      },
    }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// GET /api/groups/[id]/announcements — list active announcements (any member / public viewer)
// Returns: { announcements: [...] }
export async function GET(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    // Visibility: members can view; non-public restricted to members
    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!group.isPublic && !myMembership) {
      return jsonError(403, 'You are not a member of this private group')
    }

    const list = await db.groupAnnouncement.findMany({
      where: { groupId: id, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isPremium: true,
            premiumTier: true,
          },
        },
      },
    })

    return ok({
      announcements: list.map((a) => ({
        id: a.id,
        groupId: a.groupId,
        authorId: a.authorId,
        content: a.content,
        isActive: a.isActive,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        author: serializeAuthor(a.author),
      })),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
