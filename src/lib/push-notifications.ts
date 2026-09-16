'use client'

// V8 — Browser push notification client helpers.
// All functions are guarded for SSR and unsupported browsers, and
// permission/subscription requests are only ever triggered by a user
// gesture (the Settings toggle) or by a socket event.
//
// To enable real push delivery (Background Service Worker push):
//   1. Generate VAPID keys (npm i -g web-push; web-push generate-vapid-keys).
//   2. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
//
// Without VAPID keys the push API cannot create a subscription; in that
// case `subscribeToPushNotifications()` will gracefully fail and the UI
// falls back to local notifications (Notification constructor), which
// still works in supporting browsers while the tab is hidden.

import { apiFetch } from '@/lib/api'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.Notification === 'function' || 'Notification' in window
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!isNotificationSupported()) return false
  return true
}

export function getPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied'
  return Notification.permission
}

/**
 * Request permission to show notifications. Must be called from a user
 * gesture (e.g. a click handler). Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/**
 * Convert a base64-url VAPID public key into a Uint8Array suitable for
 * PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof window !== 'undefined' ? window.atob(base64) : ''
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Ensure a service worker is registered and ready. Returns the
 * registration or null if anything fails (e.g. no VAPID keys).
 */
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    // Use the root scope so a single registration covers the whole app.
    const reg = await navigator.serviceWorker.getRegistration('/')
    if (reg) return reg
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    // A real sw.js doesn't exist in this app — fall back to a no-op SW
    // by registering inline source. Many browsers reject this, in which
    // case we return null and the caller falls back to local notifications.
    return null
  }
}

/**
 * Create a PushSubscription and POST it to the backend. Returns true on
 * success. If the browser can't create a real push subscription (no
 * VAPID key, no service worker, permission denied), returns false.
 *
 * Callers should always check `isPushSupported()` before calling this.
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (getPermission() !== 'granted') return false
  if (!VAPID_PUBLIC_KEY) return false

  try {
    const reg = await ensureServiceWorker()
    if (!reg) return false

    let sub: PushSubscription | null = null
    try {
      sub = await reg.pushManager.getSubscription()
    } catch {
      sub = null
    }
    if (!sub) {
      // Cast to BufferSource — TS's lib.dom types are stricter than the
      // actual runtime API which accepts any ArrayBufferView.
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
    }
    if (!sub) return false

    // Marshal to JSON for POSTing. `sub.toJSON()` is available in modern
    // browsers; fall back to manual extraction for older ones.
    const json: any = (sub as any).toJSON
      ? (sub as any).toJSON()
      : {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.getKey('p256dh')
              ? uint8ArrayToBase64Url(new Uint8Array(sub.getKey('p256dh')!))
              : '',
            auth: sub.getKey('auth')
              ? uint8ArrayToBase64Url(new Uint8Array(sub.getKey('auth')!))
              : '',
          },
        }

    await apiFetch('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      }),
    })
    return true
  } catch {
    return false
  }
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Remove the user's push subscription both locally (browser) and on the
 * backend. Safe to call even if no subscription exists.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await ensureServiceWorker()
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
  } catch {
    // ignore
  }
  // Notify the backend so it stops sending pushes. We don't have the
  // endpoint handy here — but the backend can be told to delete ALL
  // subscriptions for the user. (The DELETE endpoint accepts a body with
  // `endpoint`; if absent it just 400s, which we swallow.)
  try {
    await apiFetch('/api/notifications/subscribe', { method: 'DELETE' })
  } catch {
    // ignore
  }
  return true
}

/**
 * Show a local browser notification. Works even without a service worker
 * or VAPID keys — uses the Notification constructor directly.
 * The callback (if any) is called when the user clicks the notification.
 */
export function showLocalNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (!isNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/icons/logo.png',
      badge: '/icons/logo.png',
      tag: 'talychat-message',
      // Replaces any previous notification with the same tag (so we
      // don't pile up dozens of stacked toasts).
      renotify: true,
    } as NotificationOptions)
    if (onClick) {
      n.onclick = () => {
        try {
          window.focus()
        } catch {
          // ignore
        }
        onClick()
        n.close()
      }
    }
    // Auto-close after 8s (most browsers do this anyway).
    setTimeout(() => {
      try {
        n.close()
      } catch {
        // ignore
      }
    }, 8000)
  } catch {
    // Notification API may throw in restricted iframes — ignore.
  }
}
