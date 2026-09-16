import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, getSessionUser, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/auth/me
export async function GET(req: NextRequest) {
  await ensureSeed()
  const user = await getSessionUser(req)
  if (!user) return jsonError(401, 'Not authenticated')
  const prefs = await db.userPreference.findUnique({ where: { userId: user.id } })
  return ok({ user, preferences: prefs })
}
