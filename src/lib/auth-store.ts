'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  username: string
  name: string
  role: 'user' | 'admin'
  isPremium: boolean
  premiumTier?: string // free | bronze | silver | gold (V2 — premium ring)
  avatar?: string | null
  bio?: string
  isRestricted?: boolean
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  hydrated: boolean
  setAuth: (user: AuthUser, token: string) => void
  updateUser: (patch: Partial<AuthUser>) => void
  logout: () => void
  setHydrated: (h: boolean) => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      hydrated: false,
      setAuth: (user, token) => set({ user, token }),
      updateUser: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      logout: () => set({ user: null, token: null }),
      setHydrated: (h) => set({ hydrated: h }),
    }),
    {
      name: 'talychat-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
