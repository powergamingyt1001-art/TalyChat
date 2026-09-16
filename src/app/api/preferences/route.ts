import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/preferences
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const prefs = await db.userPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    })
    return ok(prefs)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// PUT /api/preferences
export async function PUT(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const allowed = [
      'theme', 'wallpaper', 'messageStyle', 'fontFamily', 'fontSize',
      'customFontUrl', 'language', 'layoutMode',
      'lastSeenPublic', 'onlinePublic', 'readReceipts',
      'notifMessages', 'notifGroups',
    ]
    const data: any = {}
    for (const k of allowed) {
      if (k in body) data[k] = body[k]
    }
    const prefs = await db.userPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...data },
    })
    return ok(prefs)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
