import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// Per PRD: daily login reward premium days per day of cycle (1-7)
const REWARD_DAYS: Record<number, number> = {
  1: 5,
  2: 5,
  3: 7,
  4: 8,
  5: 10,
  6: 10,
  7: 15,
}

const CYCLE_LENGTH = 7
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

// GET /api/daily-reward — return current day number (1-7), nextClaimAt, today's reward (premium days)
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({ where: { id: user.id } })
    if (!full) return jsonError(404, 'User not found')

    const now = new Date()
    // Get the most recent DailyReward to determine cycle/day
    const last = await db.dailyReward.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: 'desc' },
    })

    let dayNumber = 1
    let nextClaimAt: Date | null = null
    let cycleStart = last?.cycleStart || new Date(now)

    if (last) {
      dayNumber = ((last.dayNumber) % CYCLE_LENGTH) + 1
      nextClaimAt = new Date(new Date(last.claimedAt).getTime() + CLAIM_COOLDOWN_MS)
    } else {
      // never claimed — claimable now
      nextClaimAt = null
    }

    const todayReward = REWARD_DAYS[dayNumber] || 0
    const canClaim = !nextClaimAt || nextClaimAt.getTime() <= now.getTime()

    return ok({
      dayNumber,
      nextClaimAt,
      todayRewardDays: todayReward,
      canClaim,
      cycleStart,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/daily-reward — claim today's reward.
// Validate 24h elapsed. Create DailyReward record. Extend premium.
// If day was 7, reset cycleStart to today (next claim = day 1).
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({ where: { id: user.id } })
    if (!full) return jsonError(404, 'User not found')

    const now = new Date()
    const last = await db.dailyReward.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: 'desc' },
    })

    // Determine current cycle start
    let cycleStart: Date
    let claimDay: number
    if (!last) {
      cycleStart = new Date(now)
      claimDay = 1
    } else {
      // Validate 24h elapsed
      const nextAllowed = new Date(new Date(last.claimedAt).getTime() + CLAIM_COOLDOWN_MS)
      if (nextAllowed > now) {
        return jsonError(429, 'You can claim again later')
      }
      // If last claim was day 7, reset cycle
      if (last.dayNumber >= CYCLE_LENGTH) {
        cycleStart = new Date(now)
        claimDay = 1
      } else {
        cycleStart = last.cycleStart
        claimDay = last.dayNumber + 1
      }
    }

    const daysAwarded = REWARD_DAYS[claimDay] || 0
    if (daysAwarded <= 0) {
      return jsonError(400, 'No reward available for this day')
    }

    // Extend user premium by awarded days
    const base = full.premiumUntil && full.premiumUntil > now
      ? new Date(full.premiumUntil)
      : new Date(now)
    const newPremiumUntil = new Date(base.getTime() + daysAwarded * 24 * 60 * 60 * 1000)

    await db.$transaction([
      db.dailyReward.create({
        data: {
          userId: user.id,
          dayNumber: claimDay,
          daysAwarded,
          cycleStart,
          claimedAt: now,
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          isPremium: true,
          premiumUntil: newPremiumUntil,
        },
      }),
      db.subscription.create({
        data: {
          userId: user.id,
          plan: `daily-${claimDay}`,
          amount: 0,
          startAt: now,
          expireAt: newPremiumUntil,
          isActive: true,
          source: 'daily',
        },
      }),
    ])

    return ok({
      dayNumber: claimDay,
      daysAwarded,
      premiumUntil: newPremiumUntil,
      cycleReset: claimDay === CYCLE_LENGTH,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
