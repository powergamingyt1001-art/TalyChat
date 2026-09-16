import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/2fa/verify
// Body: { token: string }
// Verifies the TOTP token against the stored secret. If valid, enables 2FA.
// Returns: { ok: true }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const token = String(body?.token || '').replace(/\s+/g, '').trim()

    if (!token) return jsonError(400, 'Token is required')
    if (!/^\d{6}$/.test(token)) {
      return jsonError(400, 'Token must be exactly 6 digits')
    }

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
    })
    if (!me) return jsonError(404, 'User not found')
    if (!me.twoFactorSecret) {
      return jsonError(400, 'No 2FA secret found. Please set up 2FA first.')
    }
    if (me.twoFactorEnabled) {
      return jsonError(400, '2FA is already enabled for this account')
    }

    const { authenticator } = await import('otplib')
    // Allow a ±1 step window (30s default) for clock drift tolerance.
    authenticator.options = { window: 1 }
    const valid = authenticator.verify({ token, secret: me.twoFactorSecret })
    if (!valid) {
      return jsonError(401, 'Invalid 2FA code. Please try again.')
    }

    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    })

    return ok({ ok: true, enabled: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message || 'Failed to verify 2FA')
  }
}
