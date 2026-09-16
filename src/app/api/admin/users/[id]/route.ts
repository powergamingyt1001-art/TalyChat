import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/admin/users/[id] — full user details (admin view)
export async function GET(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    await requireAdmin(req)
    const { id } = await ctx.params

    const user = await db.user.findUnique({
      where: { id },
      include: {
        preferences: true,
      },
    })
    if (!user) return jsonError(404, 'User not found')

    // Strip passwordHash
    const { passwordHash, ...safe } = user

    const [conversations, reportsMade, reportsReceived, paymentProofs, subscriptions, referralsGiven, referralsReceived] =
      await Promise.all([
        db.conversationMember.findMany({
          where: { userId: id },
          include: {
            conversation: {
              select: {
                id: true,
                type: true,
                name: true,
                avatar: true,
                groupId: true,
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        }),
        db.report.findMany({
          where: { reporterId: id },
          orderBy: { createdAt: 'desc' },
        }),
        db.report.findMany({
          where: { reportedUserId: id },
          orderBy: { createdAt: 'desc' },
        }),
        db.paymentProof.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
        }),
        db.subscription.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
        }),
        db.referral.findMany({
          where: { referrerId: id },
          include: {
            referred: { select: { id: true, username: true, name: true, avatar: true } },
          },
        }),
        db.referral.findMany({
          where: { referredId: id },
          include: {
            referrer: { select: { id: true, username: true, name: true, avatar: true } },
          },
        }),
      ])

    return ok({
      ...safe,
      conversations,
      reports: { made: reportsMade, received: reportsReceived },
      paymentProofs,
      subscriptions,
      referrals: { given: referralsGiven, received: referralsReceived },
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/admin/users/[id] — update user (premium / restricted / role / premiumUntil)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    await requireAdmin(req)
    const { id } = await ctx.params

    const body = await req.json().catch(() => ({}))
    const { isPremium, premiumUntil, isRestricted, restrictedUntil, role } = body || {}

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return jsonError(404, 'User not found')

    const data: any = {}
    if (typeof isPremium === 'boolean') data.isPremium = isPremium
    if (typeof isRestricted === 'boolean') data.isRestricted = isRestricted
    if (role === 'admin' || role === 'user') data.role = role
    if (premiumUntil !== undefined) {
      data.premiumUntil = premiumUntil ? new Date(premiumUntil) : null
    }
    if (restrictedUntil !== undefined) {
      data.restrictedUntil = restrictedUntil ? new Date(restrictedUntil) : null
    }

    if (Object.keys(data).length === 0) {
      return jsonError(400, 'No valid fields to update')
    }

    const updated = await db.user.update({ where: { id }, data })
    const { passwordHash, ...safe } = updated
    return ok(safe)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/admin/users/[id] — soft-block (isBlocked=true)
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  await ensureSeed()
  try {
    const admin = await requireAdmin(req)
    const { id } = await ctx.params

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) return jsonError(404, 'User not found')

    // Cannot block main admin (admin.in)
    if (existing.email === 'admin.in' || existing.id === admin.id) {
      return jsonError(400, 'Cannot block the main admin account')
    }

    const updated = await db.user.update({
      where: { id },
      data: { isBlocked: true, isOnline: false },
    })
    const { passwordHash, ...safe } = updated
    return ok(safe)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
