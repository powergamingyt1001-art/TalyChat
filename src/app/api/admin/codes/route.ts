import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/codes
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const codes = await db.redeemCode.findMany({
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
        _count: {
          select: { redemptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({
      codes: codes.map((c) => ({
        ...c,
        redemptionCount: c._count.redemptions,
      })),
      total: codes.length,
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/admin/codes — create code(s)
// Body: { code?, months, note, count=1, expiry? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const admin = await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { code, months, note, count = 1, expiry } = body || {}

    if (months === undefined) return jsonError(400, 'months required')
    const monthsNum = parseInt(months, 10)
    if (isNaN(monthsNum) || monthsNum < 1) {
      return jsonError(400, 'months must be a positive integer')
    }

    const countNum = Math.max(1, Math.min(100, parseInt(count, 10) || 1))
    const expiryDate = expiry ? new Date(expiry) : null
    const noteStr = String(note || '')

    const created: any[] = []

    if (countNum === 1) {
      const finalCode = (code || randomCode()).toUpperCase()
      // Verify uniqueness if code provided
      if (code) {
        const exists = await db.redeemCode.findUnique({ where: { code: finalCode } })
        if (exists) return jsonError(409, `Code '${finalCode}' already exists`)
      } else {
        // ensure uniqueness for auto-generated
        await ensureUnique(finalCode)
      }
      const rec = await db.redeemCode.create({
        data: {
          code: finalCode,
          premiumMonths: monthsNum,
          note: noteStr,
          count: 1,
          expiry: expiryDate,
          isActive: true,
          createdById: admin.id,
        },
      })
      created.push(rec)
    } else {
      // Generate `count` codes
      const base = code ? String(code).toUpperCase() : randomCode()
      for (let i = 0; i < countNum; i++) {
        const finalCode = code ? `${base}-${i + 1}` : await ensureUnique(randomCode())
        // If user provided base code, check uniqueness of suffixed variant
        if (code) {
          const exists = await db.redeemCode.findUnique({ where: { code: finalCode } })
          if (exists) continue // skip duplicates
        }
        const rec = await db.redeemCode.create({
          data: {
            code: finalCode,
            premiumMonths: monthsNum,
            note: noteStr,
            count: countNum,
            expiry: expiryDate,
            isActive: true,
            createdById: admin.id,
          },
        })
        created.push(rec)
      }
    }

    return ok({ created, count: created.length }, 201)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// ---------------- helpers ----------------
function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return `TALY-${s}`
}

async function ensureUnique(prefix: string): Promise<string> {
  let candidate = prefix
  for (let i = 0; i < 5; i++) {
    const exists = await db.redeemCode.findUnique({ where: { code: candidate } })
    if (!exists) return candidate
    candidate = `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`
  }
  return candidate
}
