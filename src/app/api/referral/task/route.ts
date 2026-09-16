import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { REFERRAL_TASK_TIERS } from '@/app/api/referral/tasks/route'

export const runtime = 'nodejs'

// POST /api/referral/task — select/start a referral task
// Body: { tier: '8members7d' | '18members15d' | '25members30d' }
// Validates: no currently active task. Creates ReferralTask with selectedAt=now,
// expiresAt=now+windowDays. Returns the task.
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { tier } = body || {}

    if (!tier || !REFERRAL_TASK_TIERS.some((t) => t.tier === tier)) {
      return jsonError(400, 'Invalid tier')
    }

    // Reject if user already has an active task
    const existingActive = await db.referralTask.findFirst({
      where: { userId: user.id, isActive: true },
    })
    if (existingActive) {
      return jsonError(409, 'You already have an active referral task. Complete or wait for it to expire before selecting another.')
    }

    const tierDef = REFERRAL_TASK_TIERS.find((t) => t.tier === tier)!
    const now = new Date()
    const expiresAt = new Date(now.getTime() + tierDef.windowDays * 24 * 60 * 60 * 1000)

    const task = await db.referralTask.create({
      data: {
        userId: user.id,
        tier: tierDef.tier,
        requiredCount: tierDef.requiredCount,
        windowDays: tierDef.windowDays,
        rewardMonths: tierDef.rewardMonths,
        selectedAt: now,
        expiresAt,
        isActive: true,
      },
    })

    return ok({ task }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
