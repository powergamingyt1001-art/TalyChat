import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/admin/password — change admin password
// Body: { currentPassword, newPassword }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const admin = await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { currentPassword, newPassword } = body || {}

    if (!currentPassword || !newPassword) {
      return jsonError(400, 'currentPassword and newPassword are required')
    }
    if (String(newPassword).length < 6) {
      return jsonError(400, 'New password must be at least 6 characters')
    }

    const user = await db.user.findUnique({ where: { id: admin.id } })
    if (!user) return jsonError(404, 'Admin user not found')
    if (!user.passwordHash) {
      return jsonError(400, 'No password set on this admin account (OAuth-only)')
    }

    const bcrypt = await import('bcryptjs')
    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash)
    if (!valid) {
      return jsonError(401, 'Current password is incorrect')
    }

    const newHash = await bcrypt.hash(String(newPassword), 10)
    await db.user.update({
      where: { id: admin.id },
      data: { passwordHash: newHash },
    })

    return ok({ success: true, message: 'Password updated' })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
