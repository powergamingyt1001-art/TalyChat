'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch } from '@/lib/api'
import { AuthScreen } from '@/components/auth/auth-screen'
import { TalyApp } from '@/components/taly-app'
import { AdminApp } from '@/components/admin/admin-app'
import { Splash } from '@/components/splash'
import { ErrorBoundary } from '@/components/error-boundary'

export default function Home() {
  const { user, token, hydrated, setAuth, logout } = useAuth()
  const [authState, setAuthState] = useState<'checking' | 'done'>('checking')

  useEffect(() => {
    if (!hydrated) return
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuthState('done')
      return
    }
    let cancelled = false
    apiFetch('/api/auth/me')
      .then((res: any) => {
        if (cancelled) return
        if (res?.user) setAuth(res.user, token)
        else logout()
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setAuthState('done')
      })
    return () => {
      cancelled = true
    }
  }, [hydrated, token])

  if (!hydrated || (token && authState === 'checking')) {
    return <Splash />
  }

  if (!user) {
    return <ErrorBoundary><AuthScreen /></ErrorBoundary>
  }

  if (user.role === 'admin') {
    return <ErrorBoundary><AdminApp /></ErrorBoundary>
  }

  return <ErrorBoundary><TalyApp /></ErrorBoundary>
}
