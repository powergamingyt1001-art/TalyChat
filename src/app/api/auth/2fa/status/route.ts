import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/auth/2fa/status
// Returns whether 2FA is currently enabled for the authenticated user.
// Returns: { enabled: boolean }
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    })
    if (!me) return jsonError(404, 'User not found')
    return ok({ enabled: !!me.twoFactorEnabled, hasSecret: !!me.twoFactorSecret })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
