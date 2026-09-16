'use client'

import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'

export const WALLPAPERS = [
  { id: 'default', name: 'Default', type: 'gradient', value: 'linear-gradient(135deg, oklch(0.985 0 0), oklch(0.97 0 0))' },
  { id: 'wp_01', name: 'Sunset', type: 'image', value: '/wallpapers/wp_01.png' },
  { id: 'wp_02', name: 'Mountains', type: 'image', value: '/wallpapers/wp_02.png' },
  { id: 'wp_03', name: 'Ocean', type: 'image', value: '/wallpapers/wp_03.png' },
  { id: 'wp_04', name: 'Forest', type: 'image', value: '/wallpapers/wp_04.png' },
  { id: 'wp_05', name: 'Sky', type: 'image', value: '/wallpapers/wp_05.png' },
  { id: 'wp_06', name: 'Galaxy', type: 'image', value: '/wallpapers/wp_06.png' },
  { id: 'wp_07', name: 'Aurora', type: 'image', value: '/wallpapers/wp_07.png' },
  { id: 'wp_08', name: 'City', type: 'image', value: '/wallpapers/wp_08.png' },
  { id: 'wp_09', name: 'Pastel 1', type: 'image', value: '/wallpapers/wp_09.jpeg' },
  { id: 'wp_10', name: 'Pastel 2', type: 'image', value: '/wallpapers/wp_10.jpeg' },
  { id: 'wp_11', name: 'Cute', type: 'image', value: '/wallpapers/wp_11.jpeg' },
  { id: 'wp_12', name: 'Texture', type: 'image', value: '/wallpapers/wp_12.jpeg' },
  { id: 'wp_13', name: 'Photo 1', type: 'image', value: '/wallpapers/wp_13.png' },
  { id: 'wp_14', name: 'Photo 2', type: 'image', value: '/wallpapers/wp_14.png' },
  { id: 'wp_15', name: 'Photo 3', type: 'image', value: '/wallpapers/wp_15.png' },
  { id: 'wp_16', name: 'Photo 4', type: 'image', value: '/wallpapers/wp_16.png' },
  { id: 'wp_17', name: 'Photo 5', type: 'image', value: '/wallpapers/wp_17.png' },
  { id: 'wp_18', name: 'Photo 6', type: 'image', value: '/wallpapers/wp_18.png' },
  { id: 'wp_19', name: 'Photo 7', type: 'image', value: '/wallpapers/wp_19.png' },
  { id: 'wp_20', name: 'Photo 8', type: 'image', value: '/wallpapers/wp_20.png' },
  { id: 'wp_21', name: 'Photo 9', type: 'image', value: '/wallpapers/wp_21.png' },
  { id: 'wp_22', name: 'Photo 10', type: 'image', value: '/wallpapers/wp_22.png' },
  { id: 'wp_23', name: 'Photo 11', type: 'image', value: '/wallpapers/wp_23.png' },
  { id: 'wp_24', name: 'Photo 12', type: 'image', value: '/wallpapers/wp_24.png' },
  { id: 'wp_25', name: 'Photo 13', type: 'image', value: '/wallpapers/wp_25.jpg' },
  // CSS gradient alternatives (theme ZIP)
  { id: 'grad_emerald', name: 'Emerald', type: 'gradient', value: 'linear-gradient(135deg, #10b981, #059669)' },
] as const

export const VISIBLE_WALLPAPER_COUNT = 12 // PRD: 12 visible, "More" expands rest

export const FONT_OPTIONS = [
  { id: 'sans', name: 'Default Sans', className: '', isPremium: false },
  { id: 'mono', name: 'Mono', className: 'font-mono', isPremium: false },
  { id: 'hindi', name: 'Hindi (Noto)', className: 'font-hindi', isPremium: false },
  { id: 'alfa-slab', name: 'Alfa Slab One', className: 'font-alfa-slab', isPremium: true },
  { id: 'creepster', name: 'Creepster', className: 'font-creepster', isPremium: true },
  { id: 'doppio', name: 'Doppio One', className: 'font-doppio', isPremium: true },
  { id: 'estonia', name: 'Estonia', className: 'font-estonia', isPremium: true },
  { id: 'league-gothic', name: 'League Gothic', className: 'font-league-gothic', isPremium: true },
  { id: 'lobster-two', name: 'Lobster Two', className: 'font-lobster-two', isPremium: true },
  { id: 'quattrocento', name: 'Quattrocento', className: 'font-quattrocento', isPremium: true },
  { id: 'sacramento', name: 'Sacramento', className: 'font-sacramento', isPremium: true },
  { id: 'syne-tactile', name: 'Syne Tactile', className: 'font-syne-tactile', isPremium: true },
  { id: 'yuyu', name: 'Yuyu', className: 'font-yuyu', isPremium: true },
] as const

export const MESSAGE_STYLES = [
  { id: 'bubble', name: 'Bubble' },
  { id: 'sharp', name: 'Sharp' },
  { id: 'tail', name: 'Tail' },
  { id: 'none', name: 'None' },
] as const

export const CATEGORIES = [
  'Gaming', 'Technology', 'AI', 'Education', 'Cricket', 'Sports',
  'Entertainment', 'Movies', 'Music', 'Memes', 'Jobs', 'Business',
  'Finance', 'News', 'Local', 'Other',
] as const

interface CustomizerContextValue {
  preferences: any
  wallpaper: typeof WALLPAPERS[number] | null
  fontFamily: typeof FONT_OPTIONS[number] | null
  messageStyle: string
  fontSize: number
  setPreference: (patch: Record<string, any>) => Promise<void>
}

const Ctx = createContext<CustomizerContextValue | null>(null)

export function useCustomizer() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomizer must be used within CustomizerProvider')
  return v
}

export function CustomizerProvider({
  children,
  preferences: initialPrefs,
}: {
  children: ReactNode
  preferences: any
}) {
  const [prefs, setPrefs] = useState<any>(initialPrefs)

  // Keep in sync when parent updates
  useEffect(() => {
    setPrefs(initialPrefs)
  }, [initialPrefs])

  const setPreference = async (patch: Record<string, any>) => {
    setPrefs((p: any) => ({ ...p, ...patch }))
    try {
      const { apiFetch } = await import('@/lib/api')
      await apiFetch('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
    } catch {}
  }

  const wallpaper = useMemo(
    () => WALLPAPERS.find((w) => w.id === prefs?.wallpaper) || WALLPAPERS[0],
    [prefs?.wallpaper]
  )
  const fontFamily = useMemo(
    () => FONT_OPTIONS.find((f) => f.id === prefs?.fontFamily) || FONT_OPTIONS[0],
    [prefs?.fontFamily]
  )
  const messageStyle = prefs?.messageStyle || 'bubble'
  const fontSize = prefs?.fontSize || 14

  const value: CustomizerContextValue = {
    preferences: prefs,
    wallpaper,
    fontFamily,
    messageStyle,
    fontSize,
    setPreference,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function getWallpaperStyle(wallpaper: typeof WALLPAPERS[number] | null, theme?: string) {
  if (!wallpaper) return {}
  if (wallpaper.type === 'image') {
    return {
      backgroundImage: `url(${wallpaper.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (wallpaper.type === 'gradient') {
    return { background: wallpaper.value }
  }
  return {}
}
