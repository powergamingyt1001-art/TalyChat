import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { bumpTierForShortReward } from '@/lib/premium'

export const runtime = 'nodejs'

// ============================================================
// R1-3 — Daily Login Reward redesign
// ============================================================
//
// Two reward loops, each spread across a 7-day cycle:
//
//   WELCOME loop (one-time per user, 180 days total):
//     Day 1: 7 days, Days 2-7: [29, 29, 29, 29, 29, 28] days each
//     Total = 7 + 29*5 + 28 = 180 days (≈6 months premium)
//
//   DEACTIVATION loop (when user returns after 15+ days offline):
//     Day 1: 1 day (24h validity), Days 2-7: [2, 2, 2, 3, 2, 3] days each
//     Total = 1 + 2+2+2+3+2+3 = 15 days
//
// Rules:
//   - Each claim is 24h after the previous one.
//   - Welcome loop is one-time per user (welcomeBonusClaimed=true after
//     day 7 is claimed).
//   - After welcome is complete, daily rewards unlock ONLY when the user
//     comes back after being offline 15+ days (lastDeactivatedAt is set
//     at login in that case).
//   - After deactivation day 7 is claimed, the loop resets to 'welcome'
//     but welcomeBonusClaimed stays true, so the next unlock still
//     requires another 15+ day offline gap.

const WELCOME_REWARD_DAYS: Record<number, number> = {
  1: 7,
  2: 29,
  3: 29,
  4: 29,
  5: 29,
  6: 29,
  7: 28,
}

const DEACTIVATION_REWARD_DAYS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 2,
  4: 2,
  5: 3,
  6: 2,
  7: 3,
}

const CYCLE_LENGTH = 7
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours

type RewardLoop = 'welcome' | 'deactivation'

function rewardTableFor(loop: RewardLoop): Record<number, number> {
  return loop === 'deactivation' ? DEACTIVATION_REWARD_DAYS : WELCOME_REWARD_DAYS
}

function sanitizeLoop(value: unknown): RewardLoop {
  return value === 'deactivation' ? 'deactivation' : 'welcome'
}

// GET /api/daily-reward — return the current loop type, day number
// (1-7), next claim time, today's reward in premium days, and whether
// the user can claim right now. Also lazily triggers the deactivation
// loop when lastDeactivatedAt is set and welcomeBonusClaimed is true.
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({ where: { id: user.id } })
    if (!full) return jsonError(404, 'User not found')

    const now = new Date()
    let currentLoop = sanitizeLoop(full.rewardLoop)

    // Get the most recent DailyReward to determine cycle/day
    const last = await db.dailyReward.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: 'desc' },
    })

    // R1-3 — Deactivation trigger.
    // If we have a fresh lastDeactivatedAt (set at login when the user
    // was offline 15+ days) AND the welcome loop is already complete,
    // switch to the deactivation loop and reset the cycle so the user
    // can claim day 1 of the 15-day mini loop.
    if (
      full.lastDeactivatedAt &&
      full.welcomeBonusClaimed &&
      currentLoop !== 'deactivation'
    ) {
      currentLoop = 'deactivation'
      await db.user.update({
        where: { id: user.id },
        data: { rewardLoop: 'deactivation' },
      })
    }

    // R1-3 — If welcome bonus is already claimed and we're not in a
    // deactivation loop (i.e. lastDeactivatedAt is null or stale), there
    // is no active reward loop. The dialog should show "no reward
    // available — come back after being offline for 15+ days".
    const noActiveLoop =
      full.welcomeBonusClaimed && currentLoop !== 'deactivation'

    let dayNumber = 1
    let nextClaimAt: Date | null = null
    let cycleStart = last?.cycleStart || new Date(now)

    if (last && !noActiveLoop) {
      dayNumber = ((last.dayNumber) % CYCLE_LENGTH) + 1
      nextClaimAt = new Date(new Date(last.claimedAt).getTime() + CLAIM_COOLDOWN_MS)
    } else if (!last) {
      // never claimed — claimable now (only if there's an active loop)
      nextClaimAt = null
    } else if (noActiveLoop) {
      // We have a prior claim but no active loop. Surface day 0 / no
      // reward so the dialog can render an "away" message.
      dayNumber = 0
      nextClaimAt = null
    }

    const rewardDays = rewardTableFor(currentLoop)
    const todayReward = noActiveLoop ? 0 : (rewardDays[dayNumber] || 0)
    const canClaim = !noActiveLoop && (!nextClaimAt || nextClaimAt.getTime() <= now.getTime())

    return ok({
      rewardLoop: noActiveLoop ? 'none' : currentLoop,
      dayNumber,
      nextClaimAt,
      todayRewardDays: todayReward,
      canClaim,
      cycleStart,
      welcomeBonusClaimed: full.welcomeBonusClaimed,
      lastDeactivatedAt: full.lastDeactivatedAt,
      cycleLength: CYCLE_LENGTH,
      // Per-day reward breakdown for the dialog to render the 7-day
      // visualization. Hidden math is not exposed — we only send per-day
      // amounts.
      rewardTable: Object.fromEntries(
        Array.from({ length: CYCLE_LENGTH }, (_, i) => i + 1).map((d) => [
          d,
          rewardDays[d] || 0,
        ])
      ) as Record<number, number>,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/daily-reward — claim today's reward for the current loop.
// Validates 24h elapsed since the last claim, extends the user's
// premium by the awarded days, and records a DailyReward entry.
// If the day being claimed is day 7, the loop completes: welcome
// becomes "claimed", deactivation resets back to "welcome".
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const full = await db.user.findUnique({ where: { id: user.id } })
    if (!full) return jsonError(404, 'User not found')

    const now = new Date()
    let currentLoop = sanitizeLoop(full.rewardLoop)

    // R1-3 — Same lazy deactivation trigger as in GET, so a direct POST
    // (e.g. from the dialog's first click) also switches the loop.
    if (
      full.lastDeactivatedAt &&
      full.welcomeBonusClaimed &&
      currentLoop !== 'deactivation'
    ) {
      currentLoop = 'deactivation'
      await db.user.update({
        where: { id: user.id },
        data: { rewardLoop: 'deactivation' },
      })
    }

    // Refuse claiming if there's no active loop (welcome already
    // claimed and not in a deactivation cycle).
    if (full.welcomeBonusClaimed && currentLoop !== 'deactivation') {
      return jsonError(
        409,
        'Daily reward currently unavailable. Come back after being offline for 15+ days.',
      )
    }

    const last = await db.dailyReward.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: 'desc' },
    })

    // Determine current cycle start + day
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

    const rewardDays = rewardTableFor(currentLoop)
    const daysAwarded = rewardDays[claimDay] || 0
    if (daysAwarded <= 0) {
      return jsonError(400, 'No reward available for this day')
    }

    // Extend user premium by awarded days
    const base = full.premiumUntil && full.premiumUntil > now
      ? new Date(full.premiumUntil)
      : new Date(now)
    const newPremiumUntil = new Date(base.getTime() + daysAwarded * 24 * 60 * 60 * 1000)

    // Daily-reward grants are short (< 2 months of premium), so the
    // natural tier is "bronze". But we never want to downgrade a
    // silver/gold user — only bump if currently free or bronze.
    const finalTier = bumpTierForShortReward(full.premiumTier)

    // R1-3 — If this is the last day of a loop, handle completion:
    //   welcome loop  -> welcomeBonusClaimed = true
    //   deactivation  -> reset rewardLoop back to 'welcome'
    const isLastDay = claimDay === CYCLE_LENGTH
    const completingWelcome = isLastDay && currentLoop === 'welcome'
    const completingDeactivation = isLastDay && currentLoop === 'deactivation'

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
          premiumTier: finalTier,
          ...(completingWelcome ? { welcomeBonusClaimed: true } : {}),
          ...(completingDeactivation
            ? { rewardLoop: 'welcome', lastDeactivatedAt: null }
            : {}),
        },
      }),
      db.subscription.create({
        data: {
          userId: user.id,
          plan: `daily-${currentLoop}-${claimDay}`,
          amount: 0,
          startAt: now,
          expireAt: newPremiumUntil,
          isActive: true,
          source: 'daily',
        },
      }),
    ])

    return ok({
      rewardLoop: completingDeactivation ? 'welcome' : currentLoop,
      dayNumber: claimDay,
      daysAwarded,
      premiumUntil: newPremiumUntil,
      premiumTier: finalTier,
      cycleReset: isLastDay,
      welcomeBonusClaimed: full.welcomeBonusClaimed || completingWelcome,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
