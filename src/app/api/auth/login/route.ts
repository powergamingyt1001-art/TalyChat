import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/login
export async function POST(req: NextRequest) {
  await ensureSeed()
  const body = await req.json().catch(() => ({}))
  const { email, password } = body || {}
  if (!email || !password) {
    return jsonError(400, 'Email and password are required')
  }
  const identifier = String(email).toLowerCase().trim()
  // admin.in special login
  let user
  if (identifier === 'admin.in') {
    user = await db.user.findUnique({ where: { email: 'admin.in' } })
    if (!user) return jsonError(401, 'Admin not seeded. Try /api/seed first.')
    if (user.passwordHash) {
      const bcrypt = await import('bcryptjs')
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) return jsonError(401, 'Invalid admin credentials')
    } else {
      return jsonError(401, 'Admin password not set')
    }
  } else {
    user = await db.user.findUnique({ where: { email: identifier } })
    if (!user) return jsonError(401, 'No account with this email')
    if (!user.passwordHash) return jsonError(401, 'Use social login instead')
    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return jsonError(401, 'Incorrect password')
  }

  // V9 — Self-deleted accounts are blocked from logging in.
  if (user.isBlocked) {
    return jsonError(403, user.banReason || 'Account is blocked')
  }

  // V9 — Two-factor authentication: if the user has 2FA enabled, do NOT
  // complete the login here. Return a temp token (= user.id) so the client
  // can prompt for the 6-digit code and call /api/auth/2fa/login.
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    return ok({
      requiresTwoFactor: true,
      tempToken: user.id,
      // Hint for the UI — tells the user which account they're logging into
      // so they know where the authenticator code is coming from.
      username: user.username || user.email,
    })
  }

  await db.user.update({
    where: { id: user.id },
    data: { isOnline: true, lastSeen: new Date() },
  })
  return ok({ user: serializeUser(user), token: user.id })
}

function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    isPremium: u.isPremium,
    avatar: u.avatar,
    bio: u.bio,
    isRestricted: u.isRestricted,
  }
}
