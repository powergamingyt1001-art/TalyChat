import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/payments?status=pending|approved|rejected
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const where: any = {}
    if (status) where.status = status

    const payments = await db.paymentProof.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            isPremium: true,
            premiumUntil: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ payments, total: payments.length })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/admin/payments — approve/reject a payment
// Body: { id, action: 'approve'|'reject', note? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { id, action, note } = body || {}
    if (!id) return jsonError(400, 'Payment id required')
    if (action !== 'approve' && action !== 'reject') {
      return jsonError(400, "action must be 'approve' or 'reject'")
    }

    const payment = await db.paymentProof.findUnique({ where: { id } })
    if (!payment) return jsonError(404, 'Payment proof not found')

    if (action === 'reject') {
      const updated = await db.paymentProof.update({
        where: { id },
        data: {
          status: 'rejected',
          adminNote: note || null,
          reviewedAt: new Date(),
        },
      })
      return ok(updated)
    }

    // approve — set user premium based on plan
    const monthsMap: Record<string, number> = {
      '2mo': 2,
      '6mo': 6,
      '1yr': 12,
    }
    const months = monthsMap[payment.plan] || 2
    const now = new Date()
    // If user already has premiumUntil in the future, extend from there; else from now
    const user = await db.user.findUnique({ where: { id: payment.userId } })
    const base = user && user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now
    const newPremiumUntil = new Date(base)
    newPremiumUntil.setMonth(newPremiumUntil.getMonth() + months)

    const updated = await db.paymentProof.update({
      where: { id },
      data: {
        status: 'approved',
        adminNote: note || null,
        reviewedAt: new Date(),
      },
    })

    await db.user.update({
      where: { id: payment.userId },
      data: {
        isPremium: true,
        premiumUntil: newPremiumUntil,
      },
    })

    await db.subscription.create({
      data: {
        userId: payment.userId,
        plan: payment.plan,
        amount: payment.amount,
        startAt: now,
        expireAt: newPremiumUntil,
        isActive: true,
        source: 'payment',
      },
    })

    return ok({
      payment: updated,
      premiumUntil: newPremiumUntil,
      monthsAdded: months,
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
