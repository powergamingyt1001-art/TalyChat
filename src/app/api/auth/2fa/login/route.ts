import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/2fa/login
// Body: { tempToken: string, token: string }
//   - tempToken: user.id returned by /api/auth/login when `requiresTwoFactor` is true
//   - token:     6-digit TOTP code entered by the user
// Verifies the TOTP token and completes the login flow.
// Returns: { user, token } on success (mirrors /api/auth/login).
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const body = await req.json().catch(() => ({}))
    const tempToken = String(body?.tempToken || '')
    const token = String(body?.token || '').replace(/\s+/g, '').trim()

    if (!tempToken) return jsonError(400, 'tempToken is required')
    if (!token) return jsonError(400, 'Token is required')
    if (!/^\d{6}$/.test(token)) {
      return jsonError(400, 'Token must be exactly 6 digits')
    }

    // Look up the user by the temp token (= user id).
    const user = await db.user.findUnique({
      where: { id: tempToken },
    })
    if (!user) return jsonError(401, 'Invalid session')
    if (user.isBlocked) {
      return jsonError(403, user.banReason || 'Account is blocked')
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return jsonError(400, '2FA is not enabled for this account')
    }

    const { authenticator } = await import('otplib')
    authenticator.options = { window: 1 }
    const valid = authenticator.verify({ token, secret: user.twoFactorSecret })
    if (!valid) {
      return jsonError(401, 'Invalid 2FA code')
    }

    await db.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    })

    return ok({ user: serializeUser(user), token: user.id })
  } catch (e: any) {
    return jsonError(500, e.message || 'Failed to verify 2FA')
  }
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
