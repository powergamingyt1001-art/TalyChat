import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

const VALID_PLANS = ['2mo', '6mo', '1yr']

// POST /api/payment/submit — submit payment proof.
// Body: { plan, amount, transactionId, utrNumber?, screenshotUrl?, notes? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { plan, amount, transactionId, utrNumber, screenshotUrl, notes } = body || {}

    if (!plan || !VALID_PLANS.includes(plan)) {
      return jsonError(400, 'Invalid plan. Must be one of: ' + VALID_PLANS.join(', '))
    }
    if (!transactionId) {
      return jsonError(400, 'transactionId is required')
    }
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return jsonError(400, 'amount is required')
    }

    const proof = await db.paymentProof.create({
      data: {
        userId: user.id,
        plan: String(plan),
        amount: Number(amount),
        transactionId: String(transactionId),
        utrNumber: utrNumber ? String(utrNumber) : null,
        screenshotUrl: screenshotUrl ? String(screenshotUrl) : null,
        notes: notes ? String(notes) : null,
        status: 'pending',
      },
    })

    return ok({ ok: true, id: proof.id })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
