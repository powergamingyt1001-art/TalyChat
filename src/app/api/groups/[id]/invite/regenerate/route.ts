import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

// POST /api/groups/[id]/invite/regenerate — regenerate invite code (owner/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await params

    const group = await db.group.findUnique({ where: { id } })
    if (!group) return jsonError(404, 'Group not found')

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: user.id } },
    })
    if (!myMembership || (myMembership.role !== 'owner' && myMembership.role !== 'admin')) {
      return jsonError(403, 'Only owner or admin can regenerate invite code')
    }

    let inviteCode = genCode()
    let attempts = 0
    while (await db.group.findUnique({ where: { inviteCode } })) {
      inviteCode = genCode()
      attempts++
      if (attempts > 10) break
    }

    const updated = await db.group.update({
      where: { id },
      data: { inviteCode },
    })

    return ok({ inviteCode: updated.inviteCode, groupId: updated.id })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
