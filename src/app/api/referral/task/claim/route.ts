import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { tierFromMonths } from '@/lib/premium'

export const runtime = 'nodejs'

// POST /api/referral/task/claim — claim reward for the user's active task
// Validates: active task exists, hasn't expired, active referrals >= requiredCount.
// On success:
//   - grant premium months (extend or set premiumUntil)
//   - mark task completedAt=now, isActive=false
//   - create Subscription with source='referral'
// Returns { ok, premiumUntil, monthsAdded, task }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)

    const activeTask = await db.referralTask.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { selectedAt: 'desc' },
    })

    if (!activeTask) {
      return jsonError(404, 'No active referral task to claim')
    }
    if (activeTask.completedAt) {
      return jsonError(400, 'Task already completed')
    }

    const now = new Date()
    if (activeTask.expiresAt && activeTask.expiresAt < now) {
      // Expired — auto-close the task as failed
      await db.referralTask.update({
        where: { id: activeTask.id },
        data: { isActive: false },
      })
      return jsonError(400, 'Task has expired. You can select a new task.')
    }

    // Count active referrals created since selectedAt
    const activeReferrals = await db.referral.count({
      where: {
        referrerId: user.id,
        status: 'active',
        createdAt: { gte: activeTask.selectedAt },
      },
    })

    if (activeReferrals < activeTask.requiredCount) {
      return jsonError(400, `Task not complete: ${activeReferrals}/${activeTask.requiredCount} active referrals`)
    }

    // Grant premium months
    const me = await db.user.findUnique({ where: { id: user.id } })
    if (!me) return jsonError(404, 'User not found')

    const base = me.premiumUntil && me.premiumUntil > now ? new Date(me.premiumUntil) : new Date(now)
    const newPremiumUntil = new Date(base)
    newPremiumUntil.setMonth(newPremiumUntil.getMonth() + activeTask.rewardMonths)

    // V3: auto-assign premium tier based on the task's rewardMonths.
    //   2 months -> bronze, 6 -> silver, 12 -> gold. Never downgrade an
    //   existing higher tier.
    const newTier = tierFromMonths(activeTask.rewardMonths)
    const currentTier = (me.premiumTier || 'free').toLowerCase()
    const tierRank: Record<string, number> = { free: 0, bronze: 1, silver: 2, gold: 3 }
    const finalTier =
      (tierRank[currentTier] ?? 0) >= (tierRank[newTier] ?? 0)
        ? (currentTier as string)
        : newTier

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          isPremium: true,
          premiumUntil: newPremiumUntil,
          premiumTier: finalTier,
        },
      }),
      db.referralTask.update({
        where: { id: activeTask.id },
        data: {
          completedAt: now,
          isActive: false,
        },
      }),
      db.subscription.create({
        data: {
          userId: user.id,
          plan: `${activeTask.rewardMonths}mo`,
          amount: 0,
          startAt: now,
          expireAt: newPremiumUntil,
          isActive: true,
          source: 'referral',
        },
      }),
    ])

    return ok({
      ok: true,
      monthsAdded: activeTask.rewardMonths,
      premiumUntil: newPremiumUntil,
      premiumTier: finalTier,
      task: {
        id: activeTask.id,
        tier: activeTask.tier,
        requiredCount: activeTask.requiredCount,
        windowDays: activeTask.windowDays,
        rewardMonths: activeTask.rewardMonths,
        selectedAt: activeTask.selectedAt,
        expiresAt: activeTask.expiresAt,
        completedAt: now,
        isActive: false,
        activeReferrals,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
