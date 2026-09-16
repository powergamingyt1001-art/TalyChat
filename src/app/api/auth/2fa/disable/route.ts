import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/2fa/disable
// Body: { password: string }
// Verifies the user's password, then disables 2FA + clears the stored secret.
// Returns: { ok: true }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const password = String(body?.password || '')

    if (!password) return jsonError(400, 'Password is required')

    const me = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
        authProvider: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    })
    if (!me) return jsonError(404, 'User not found')
    if (!me.twoFactorEnabled && !me.twoFactorSecret) {
      return jsonError(400, '2FA is not enabled for this account')
    }

    // OAuth users may not have a password — require them to set one first.
    if (!me.passwordHash) {
      return jsonError(400, 'No password set on this account. Set a password before disabling 2FA.')
    }

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(password, me.passwordHash)
    if (!valid) {
      return jsonError(401, 'Incorrect password')
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    })

    return ok({ ok: true, enabled: false })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message || 'Failed to disable 2FA')
  }
}
