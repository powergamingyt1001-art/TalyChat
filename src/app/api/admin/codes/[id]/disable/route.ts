import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/admin/codes/[id]/disable
export async function POST(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    await requireAdmin(req)
    const { id } = await ctx.params

    const existing = await db.redeemCode.findUnique({ where: { id } })
    if (!existing) return jsonError(404, 'Code not found')

    const updated = await db.redeemCode.update({
      where: { id },
      data: { isActive: false },
    })
    return ok(updated)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
