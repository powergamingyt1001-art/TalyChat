// V8 — Server-side push notification sender using the web-push library.
// Wrap in try/catch at all call sites so push failures never block a
// message send or a socket emit.
//
// Configuration (env vars):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — exposed to the client for subscription
//   VAPID_PRIVATE_KEY            — server-only, used to sign pushes
//   VAPID_SUBJECT                — mailto: or https:// URL contact
//
// If the keys are missing, push sending is a no-op (logged once).

import webpush, { type PushSubscription as WPushSubscription } from 'web-push'
import { db } from '@/lib/db'

let configured = false
let configureWarningShown = false

function configure() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@talychat.local'

  if (!publicKey || !privateKey) {
    if (!configureWarningShown) {
      configureWarningShown = true
      console.warn(
        '[push] VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to enable web push'
      )
    }
    return
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  } catch (e) {
    console.warn('[push] Failed to configure VAPID:', (e as Error).message)
  }
}

export interface PushPayload {
  title: string
  body: string
  conversationId?: string
  messageId?: string
  senderId?: string
  url?: string
  tag?: string
}

/**
 * Send a push notification to ALL of a user's subscribed devices.
 * Returns the count of successful sends. Never throws — failures are
 * caught and logged so callers can ignore the result.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  configure()
  if (!configured) return 0

  let subs
  try {
    subs = await db.pushSubscription.findMany({ where: { userId } })
  } catch {
    return 0
  }
  if (!subs.length) return 0

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    conversationId: payload.conversationId,
    messageId: payload.messageId,
    senderId: payload.senderId,
    url:
      payload.url ||
      (payload.conversationId ? `/?conv=${payload.conversationId}` : '/'),
    tag: payload.tag || payload.conversationId || 'message',
    // Click action — handled by the client's serviceWorker instead of a
    // `action` link, since browsers no longer honor arbitrary URLs in the
    // `action` field for security reasons.
    requireInteraction: false,
    // Higher priority for incoming messages so they appear promptly.
    urgency: 'high',
  })

  const pushSub: WPushSubscription = {
    endpoint: '',
    keys: { p256dh: '', auth: '' },
  }

  let sent = 0
  // Sequentially send — push requests aren't free, and we want to be able
  // to delete subscriptions that 410 (Gone) without race conditions.
  for (const s of subs) {
    pushSub.endpoint = s.endpoint
    pushSub.keys.p256dh = s.p256dh
    pushSub.keys.auth = s.auth
    try {
      await webpush.sendNotification(pushSub, notificationPayload, {
        urgency: 'high' as any,
        TTL: 60 * 60 * 24, // 24h
      })
      sent++
    } catch (e: any) {
      const status = e?.statusCode
      // 404 / 410 = subscription is no longer valid — delete it.
      if (status === 404 || status === 410) {
        try {
          await db.pushSubscription.delete({ where: { id: s.id } })
        } catch {
          // ignore
        }
      } else {
        console.warn('[push] sendNotification failed:', status, e?.message)
      }
    }
  }
  return sent
}
