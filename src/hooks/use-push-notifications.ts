'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-store'
import {
  getPermission,
  isNotificationSupported,
  isPushSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '@/lib/push-notifications'

type Status = 'unsupported' | 'default' | 'granted' | 'denied' | 'subscribed'

function computeStatus(): { permission: NotificationPermission; status: Status } {
  if (!isNotificationSupported()) {
    return { permission: 'denied' as NotificationPermission, status: 'unsupported' }
  }
  const p = getPermission()
  let st: Status = 'default'
  if (p === 'denied') st = 'denied'
  else if (p === 'granted') st = 'granted'
  else st = 'default'
  return { permission: p, status: st }
}

/**
 * V8 — Push notifications hook.
 *
 * Auto-subscribes the user to push notifications shortly after login (with
 * a one-time localStorage flag so we don't re-prompt on every page load).
 * Returns helpers the Settings dialog uses to enable/disable and check
 * status.
 *
 * IMPORTANT: this hook never requests permission on mount — it only
 * re-registers an existing subscription if the browser already granted
 * permission. The first-time prompt is always driven by a user gesture
 * (the Settings toggle).
 */
export function usePushNotifications() {
  const { user, hydrated } = useAuth()
  const supported = isNotificationSupported()
  const pushSupported = isPushSupported()
  const [state, setState] = useState(() => computeStatus())

  const refresh = useCallback(() => {
    setState(computeStatus())
  }, [])

  // Sync local state with the actual browser permission whenever this
  // component re-mounts or window focus changes (so the Settings toggle
  // updates if the user changes permission in browser settings).
  useEffect(() => {
    const handler = () => setState(computeStatus())
    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [])

  // After login: if the user previously granted permission, silently
  // re-subscribe (browser may have evicted the old subscription). We
  // gate this on a localStorage flag so we only run it once per user
  // until they explicitly toggle in Settings.
  useEffect(() => {
    if (!hydrated || !user) return
    if (!pushSupported) return
    if (getPermission() !== 'granted') return
    const flagKey = `talychat:push:auto:${user.id}`
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(flagKey) === '1') {
      // Already auto-subscribed once — just refresh silently.
      void subscribeToPushNotifications().then((ok) => {
        if (ok) {
          setState((s) => (s.status === 'subscribed' ? s : { ...s, status: 'subscribed' }))
        }
      })
      return
    }
    // Mark as "auto-subscribed" so we don't retry on every render.
    try {
      window.localStorage.setItem(flagKey, '1')
    } catch {
      // ignore
    }
    void subscribeToPushNotifications().then((ok) => {
      if (ok) {
        setState((s) => (s.status === 'subscribed' ? s : { ...s, status: 'subscribed' }))
      }
    })
  }, [hydrated, user, pushSupported])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false
    const granted = await requestNotificationPermission()
    setState(computeStatus())
    if (!granted) {
      return false
    }
    if (!pushSupported) {
      // No Push API (e.g. iOS Safari) — but the user has granted
      // notifications, so local notifications will still work.
      return true
    }
    const ok = await subscribeToPushNotifications()
    if (ok) {
      setState((s) => ({ ...s, status: 'subscribed' }))
    }
    return ok
  }, [supported, pushSupported])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    const ok = await unsubscribeFromPushNotifications()
    setState(computeStatus())
    return ok
  }, [])

  return {
    supported,
    pushSupported,
    permission: state.permission,
    status: state.status,
    subscribe,
    unsubscribe,
    refresh,
  }
}
