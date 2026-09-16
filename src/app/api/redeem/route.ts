import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/redeem — redeem a code. Body: { code }
// Validates: exists, active, not expired, not already redeemed by user.
// On success: create RedeemUse, extend premium by premiumMonths, create Subscription
// with source='redeem'. Mark code as used (deactivate if count <= redemptions+1).
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { code } = body || {}
    if (!code) return jsonError(400, 'Code is required')

    const normalized = String(code).trim().toUpperCase()
    const redeemCode = await db.redeemCode.findUnique({
      where: { code: normalized },
    })
    if (!redeemCode) return jsonError(404, 'Invalid code')
    if (!redeemCode.isActive) return jsonError(400, 'Code is no longer active')

    if (redeemCode.expiry && redeemCode.expiry < new Date()) {
      return jsonError(400, 'Code has expired')
    }

    // already redeemed by user?
    const existingUse = await db.redeemUse.findUnique({
      where: { codeId_userId: { codeId: redeemCode.id, userId: user.id } },
    })
    if (existingUse) return jsonError(409, 'You have already redeemed this code')

    // count existing redemptions
    const redemptionCount = await db.redeemUse.count({
      where: { codeId: redeemCode.id },
    })
    if (redeemCode.count > 0 && redemptionCount >= redeemCode.count) {
      // exhausted; deactivate just in case
      if (redeemCode.isActive) {
        await db.redeemCode.update({
          where: { id: redeemCode.id },
          data: { isActive: false },
        })
      }
      return jsonError(400, 'Code usage limit reached')
    }

    // Compute new premiumUntil = max(current or now) + premiumMonths
    const fullUser = await db.user.findUnique({ where: { id: user.id } })
    if (!fullUser) return jsonError(404, 'User not found')
    const now = new Date()
    const base = fullUser.premiumUntil && fullUser.premiumUntil > now
      ? new Date(fullUser.premiumUntil)
      : new Date(now)
    const newPremiumUntil = new Date(base)
    newPremiumUntil.setMonth(newPremiumUntil.getMonth() + redeemCode.premiumMonths)

    const newRedemptionCount = redemptionCount + 1
    const shouldDeactivate = redeemCode.count > 0 && redeemCode.count <= newRedemptionCount

    // Transaction: create RedeemUse, update user, create Subscription, maybe deactivate code
    await db.$transaction([
      db.redeemUse.create({
        data: { codeId: redeemCode.id, userId: user.id },
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
          plan: `${redeemCode.premiumMonths}mo`,
          amount: 0,
          startAt: now,
          expireAt: newPremiumUntil,
          isActive: true,
          source: 'redeem',
        },
      }),
      shouldDeactivate
        ? db.redeemCode.update({
            where: { id: redeemCode.id },
            data: { isActive: false },
          })
        : db.redeemCode.update({
            where: { id: redeemCode.id },
            data: {},
          }),
    ])

    return ok({ ok: true, premiumUntil: newPremiumUntil })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
