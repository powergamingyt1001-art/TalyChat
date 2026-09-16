import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// Available referral task tiers (V2)
export const REFERRAL_TASK_TIERS = [
  { tier: '8members7d', requiredCount: 8, windowDays: 7, rewardMonths: 2 },
  { tier: '18members15d', requiredCount: 18, windowDays: 15, rewardMonths: 6 },
  { tier: '25members30d', requiredCount: 25, windowDays: 30, rewardMonths: 12 },
] as const

// GET /api/referral/tasks — return all available task tiers
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAuth(req)
    return ok({ tasks: REFERRAL_TASK_TIERS })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
