import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { REFERRAL_TASK_TIERS } from '@/app/api/referral/tasks/route'

export const runtime = 'nodejs'

// GET /api/referral/me — current user's referral data
// Returns (V2 shape, backward-compatible):
//   {
//     code: username,
//     count / activeReferrals: count of active referrals,
//     recent: [...],
//     tierReached, progress: x/15,
//     currentTask: { tier, requiredCount, windowDays, rewardMonths, progress, expiresAt, completedAt } | null,
//     completedTasks: [...]
//   }
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const referrals = await db.referral.findMany({
      where: { referrerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        referred: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPremium: true,
            createdAt: true,
          },
        },
      },
    })

    const active = referrals.filter((r) => r.status === 'active')
    const recent = referrals.slice(0, 20).map((r) => ({
      id: r.id,
      status: r.status,
      tierReached: r.tierReached,
      rewardGranted: r.rewardGranted,
      createdAt: r.createdAt,
      activatedAt: r.activatedAt,
      referred: r.referred,
    }))

    const count = active.length

    // tierReached: highest tier this user has unlocked based on count.
    let tierReached: '4' | '7' | '15' | null = null
    if (count >= 15) tierReached = '15'
    else if (count >= 7) tierReached = '7'
    else if (count >= 4) tierReached = '4'

    // ---------- V2: referral tasks ----------
    const [activeTask, completedTasks] = await Promise.all([
      db.referralTask.findFirst({
        where: { userId: user.id, isActive: true },
        orderBy: { selectedAt: 'desc' },
      }),
      db.referralTask.findMany({
        where: { userId: user.id, isActive: false, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
      }),
    ])

    let currentTask: any = null
    if (activeTask) {
      const activeReferralsSinceTask = await db.referral.count({
        where: {
          referrerId: user.id,
          status: 'active',
          createdAt: { gte: activeTask.selectedAt },
        },
      })
      currentTask = {
        id: activeTask.id,
        tier: activeTask.tier,
        requiredCount: activeTask.requiredCount,
        windowDays: activeTask.windowDays,
        rewardMonths: activeTask.rewardMonths,
        progress: activeReferralsSinceTask,
        selectedAt: activeTask.selectedAt,
        expiresAt: activeTask.expiresAt,
        completedAt: activeTask.completedAt,
        isActive: true,
      }
    }

    return ok({
      code: user.username,
      count,
      activeReferrals: count,
      recent,
      tierReached,
      progress: `${Math.min(count, 15)}/15`,
      // V2 task fields
      taskTiers: REFERRAL_TASK_TIERS,
      currentTask,
      completedTasks: completedTasks.map((t) => ({
        id: t.id,
        tier: t.tier,
        requiredCount: t.requiredCount,
        windowDays: t.windowDays,
        rewardMonths: t.rewardMonths,
        selectedAt: t.selectedAt,
        completedAt: t.completedAt,
        expiresAt: t.expiresAt,
      })),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
