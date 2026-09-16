import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/settings — list all settings
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const settings = await db.appSetting.findMany({
      orderBy: { key: 'asc' },
    })
    // Return as key-value object
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    return ok({ settings: map, raw: settings })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// PUT /api/admin/settings — upsert one or more settings
// Body: { key: value, ... }
export async function PUT(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError(400, 'Body must be a JSON object of key/value pairs')
    }

    const entries = Object.entries(body)
    if (entries.length === 0) {
      return jsonError(400, 'No settings provided')
    }

    const results: Record<string, string> = {}
    for (const [key, value] of entries) {
      if (typeof key !== 'string' || key.length === 0) continue
      const strVal = String(value)
      const updated = await db.appSetting.upsert({
        where: { key },
        update: { value: strVal },
        create: { key, value: strVal },
      })
      results[updated.key] = updated.value
    }

    return ok({ updated: results, count: Object.keys(results).length })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
