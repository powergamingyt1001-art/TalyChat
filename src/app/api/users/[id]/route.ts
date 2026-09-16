import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/users/[id] — get a public user profile.
// Only return: id, name, username, avatar, bio, isPremium, isOnline,
// lastSeen (only if lastSeenPublic=true in their prefs), createdAt.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const requester = await requireAuth(req).catch(() => null)
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        isPremium: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        preferences: true,
      },
    })

    if (!user) return jsonError(404, 'User not found')

    const lastSeenPublic = user.preferences?.lastSeenPublic === true
    void requester

    return ok({
      id: user.id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      isPremium: user.isPremium,
      isOnline: user.isOnline,
      lastSeen: lastSeenPublic ? user.lastSeen : null,
      createdAt: user.createdAt,
    })
  } catch (e: any) {
    return jsonError(500, e.message)
  }
}
