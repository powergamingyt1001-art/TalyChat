import { NextRequest } from 'next/server'
import { ensureSeed } from '@/lib/seed'
import { ok } from '@/lib/auth'

export const runtime = 'nodejs'

// GET /api/seed — manually trigger seeding (idempotent)
export async function GET(_req: NextRequest) {
  await ensureSeed()
  return ok({ ok: true, message: 'Seed complete' })
}
