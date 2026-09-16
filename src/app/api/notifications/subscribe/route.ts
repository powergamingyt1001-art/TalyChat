import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/notifications/subscribe — register a browser push subscription
// Body: { endpoint, keys: { p256dh, auth } }
// Persists the subscription so we can later push notifications to this user.
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const endpoint = body?.endpoint
    const keys = body?.keys || {}
    const p256dh = keys.p256dh
    const auth = keys.auth

    if (!endpoint || !p256dh || !auth) {
      return jsonError(400, 'endpoint, keys.p256dh, keys.auth are required')
    }

    // Upsert by endpoint so re-subscribing (same endpoint) doesn't
    // produce duplicate rows for the same user.
    const existing = await db.pushSubscription.findFirst({
      where: { endpoint },
      select: { id: true, userId: true },
    })

    let sub
    if (existing) {
      // If the endpoint is already owned by this user, just update the keys
      // (in case they rotated). If it was owned by a different user (very
      // rare — endpoint reuse), re-assign it to the current user.
      sub = await db.pushSubscription.update({
        where: { id: existing.id },
        data: { userId: user.id, p256dh, auth },
      })
    } else {
      sub = await db.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint,
          p256dh,
          auth,
        },
      })
    }

    return ok({ subscription: { id: sub.id, endpoint: sub.endpoint } }, 201)
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/notifications/subscribe?endpoint=<url-encoded-endpoint>
// OR DELETE with body { endpoint } — remove the user's subscription.
export async function DELETE(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    let endpoint: string | undefined = url.searchParams.get('endpoint') || undefined
    if (!endpoint) {
      const body = await req.json().catch(() => ({}))
      endpoint = body?.endpoint
    }
    if (!endpoint) {
      return jsonError(400, 'endpoint is required (query param or body)')
    }

    // Only delete the subscription if it belongs to the current user — this
    // prevents one user from unsubscribing another's device.
    const existing = await db.pushSubscription.findFirst({
      where: { endpoint, userId: user.id },
      select: { id: true },
    })
    if (existing) {
      await db.pushSubscription.delete({ where: { id: existing.id } })
    }

    return ok({ removed: true })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
