import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// 24 hours in milliseconds
const STORY_TTL_MS = 24 * 60 * 60 * 1000

interface StoryRow {
  id: string
  userId: string
  type: string
  content: string
  bgColor: string
  textColor: string
  caption: string | null
  createdAt: Date
  expiresAt: Date
  viewedBy: string
  isDeleted: boolean
  viewsCount: number
  hasViewed: boolean
}

interface UserSummary {
  id: string
  name: string
  username: string
  avatar: string | null
  isPremium: boolean
  premiumTier: string | null
}

interface FriendGroup {
  user: UserSummary
  stories: StoryRow[]
  hasUnviewed: boolean
}

// GET /api/stories — list stories visible to the current user
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const now = new Date()

    // 1) Find all user IDs that the current user "knows":
    //    - users in any private conversation they're a member of
    //    - users in any group conversation they're a member of
    // (A story is visible to me if the author is me, OR is in a private
    // conversation with me, OR is in a group conversation I'm in.)
    const myConvMemberships = await db.conversationMember.findMany({
      where: { userId: user.id },
      select: {
        conversation: {
          select: {
            type: true,
            members: { select: { userId: true } },
          },
        },
      },
    })

    const visibleUserIds = new Set<string>()
    for (const m of myConvMemberships) {
      for (const member of m.conversation.members) {
        if (member.userId !== user.id) {
          visibleUserIds.add(member.userId)
        }
      }
    }

    // 2) Fetch all active (non-deleted, not expired) stories from these users + my own
    const targetUserIds = Array.from(visibleUserIds)
    targetUserIds.push(user.id)

    const stories = await db.story.findMany({
      where: {
        userId: { in: targetUserIds },
        expiresAt: { gt: now },
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        views: {
          where: { userId: user.id },
          select: { id: true, viewedAt: true },
        },
        _count: { select: { views: true } },
      },
    })

    // 3) Fetch all related users in one query
    const userIds = Array.from(new Set(stories.map((s) => s.userId)))
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isPremium: true,
        premiumTier: true,
      },
    })
    const userById = new Map(users.map((u) => [u.id, u]))

    // 4) Group stories by user
    const byUser = new Map<string, StoryRow[]>()
    for (const s of stories) {
      const hasViewed = s.views.length > 0
      const row: StoryRow = {
        id: s.id,
        userId: s.userId,
        type: s.type,
        content: s.content,
        bgColor: s.bgColor,
        textColor: s.textColor,
        caption: s.caption,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        viewedBy: s.viewedBy,
        isDeleted: s.isDeleted,
        viewsCount: s._count.views,
        hasViewed,
      }
      const arr = byUser.get(s.userId) || []
      arr.push(row)
      byUser.set(s.userId, arr)
    }

    // 5) Build the response: myStories + friends
    const myStories = (byUser.get(user.id) || []).map((s) => ({
      ...s,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        isPremium: user.isPremium,
        premiumTier: user.premiumTier,
      },
    }))

    const friends: FriendGroup[] = []
    for (const [uid, arr] of byUser.entries()) {
      if (uid === user.id) continue
      const u = userById.get(uid)
      if (!u) continue
      const sorted = arr.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )
      const hasUnviewed = sorted.some((s) => !s.hasViewed)
      friends.push({
        user: {
          id: u.id,
          name: u.name,
          username: u.username,
          avatar: u.avatar,
          isPremium: u.isPremium,
          premiumTier: u.premiumTier,
        },
        stories: sorted,
        hasUnviewed,
      })
    }

    // Sort friends: those with unviewed stories first, then by name
    friends.sort((a, b) => {
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1
      return (a.user.name || '').localeCompare(b.user.name || '')
    })

    return ok({ myStories, friends, totalFriends: friends.length })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/stories — create a new story
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const {
      type,
      content,
      bgColor,
      textColor,
      caption,
    } = body || {}

    const storyType = (type || 'text').toLowerCase()
    if (!['text', 'image'].includes(storyType)) {
      return jsonError(400, 'Invalid type (must be text or image)')
    }

    if (storyType === 'text') {
      if (!content || !String(content).trim()) {
        return jsonError(400, 'Text content is required for text stories')
      }
      if (String(content).length > 500) {
        return jsonError(400, 'Text content too long (max 500 chars)')
      }
    } else {
      // image
      if (!content || !String(content).trim()) {
        return jsonError(400, 'Image URL is required for image stories')
      }
    }

    if (caption && String(caption).length > 280) {
      return jsonError(400, 'Caption too long (max 280 chars)')
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + STORY_TTL_MS)

    const story = await db.story.create({
      data: {
        userId: user.id,
        type: storyType,
        content: String(content || ''),
        bgColor: String(bgColor || '#10b981'),
        textColor: String(textColor || '#ffffff'),
        caption: caption ? String(caption) : null,
        expiresAt,
      },
    })

    return ok(
      {
        id: story.id,
        userId: story.userId,
        type: story.type,
        content: story.content,
        bgColor: story.bgColor,
        textColor: story.textColor,
        caption: story.caption,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      },
      201
    )
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
