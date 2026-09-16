import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/users/me — get current user's full profile + preferences
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        gender: true,
        dob: true,
        role: true,
        isPremium: true,
        premiumTier: true,
        premiumUntil: true,
        isOnline: true,
        lastSeen: true,
        isRestricted: true,
        restrictedUntil: true,
        authProvider: true,
        createdAt: true,
      },
    })
    const prefs = await db.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })
    return ok({ user: full, preferences: prefs })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/users/me — update profile
// Body: name, bio, avatar, username, gender, dob
export async function PATCH(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const data: any = {}

    if ('name' in body && body.name !== undefined) data.name = String(body.name).trim()
    if ('bio' in body && body.bio !== undefined) data.bio = String(body.bio)
    if ('avatar' in body && body.avatar !== undefined) data.avatar = body.avatar === '' ? '' : String(body.avatar)
    if ('gender' in body && body.gender !== undefined) {
      const g = String(body.gender)
      if (['male', 'female', 'other'].includes(g)) data.gender = g
    }
    if ('dob' in body && body.dob !== undefined) {
      data.dob = body.dob === null || body.dob === '' ? null : String(body.dob)
    }
    if ('username' in body && body.username !== undefined) {
      const newUsername = String(body.username).trim()
      if (!newUsername) return jsonError(400, 'Username cannot be empty')
      if (newUsername !== user.username) {
        const exists = await db.user.findUnique({ where: { username: newUsername } })
        if (exists) return jsonError(409, 'Username already taken')
        data.username = newUsername
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        gender: true,
        dob: true,
        role: true,
        isPremium: true,
        premiumTier: true,
        premiumUntil: true,
        createdAt: true,
      },
    })
    return ok({ user: updated })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
