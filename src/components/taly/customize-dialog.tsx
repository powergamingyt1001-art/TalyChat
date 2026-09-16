'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Lock,
  MoreHorizontal,
  Sparkles,
  Upload,
  Check,
  Palette,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import {
  useCustomizer,
  WALLPAPERS,
  FONT_OPTIONS,
  MESSAGE_STYLES,
  getWallpaperStyle,
} from '@/components/taly/customizer-context'
import { cn } from '@/lib/utils'

interface CustomizeDialogProps {
  open: boolean
  /** Canonical close handler (V2 spec). */
  onClose?: () => void
  /** Backward-compat: shadcn-style open-change handler. Falls back to onClose. */
  onOpenChange?: (open: boolean) => void
  conversationId?: string
  /** Optional label flag — kept for backward-compat with the existing ChatView call. */
  isGroup?: boolean
  /** V13 — per-conversation theme color (chat background). Null = default. */
  currentThemeColor?: string | null
  /** V13 — callback when user picks a new chat background color. */
  onApplyThemeColor?: (color: string | null) => void
}

// ---------------------------------------------------------------------------
// V13 — Chat background color presets (4 swatches, available to ALL users).
// These map directly to per-conversation `themeColor` overrides.
// ---------------------------------------------------------------------------
const CHAT_BG_PRESETS: { key: string; label: string; hex: string }[] = [
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { key: 'pink', label: 'Pink', hex: '#ec4899' },
]

// V13 — Bubble color presets (sent + received). Available to ALL users.
// Selecting null resets to default.
const BUBBLE_COLOR_PRESETS: { key: string; label: string; hex: string | null }[] = [
  { key: 'default', label: 'Default', hex: null },
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { key: 'pink', label: 'Pink', hex: '#ec4899' },
  { key: 'orange', label: 'Orange', hex: '#f97316' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e' },
  { key: 'teal', label: 'Teal', hex: '#14b8a6' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 18

function useCustomizerSafe() {
  try {
    return useCustomizer()
  } catch {
    // No provider — return null and let the caller handle.
    return null
  }
}

// Apply a theme on the document root (light/dark/system)
function applyTheme(theme: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', isDark)
}

// Bubble preview style (for message-style cards and live preview)
function previewBubbleClass(style: string, isMine: boolean): string {
  switch (style) {
    case 'sharp':
      return 'rounded-none'
    case 'tail':
      return isMine
        ? 'rounded-2xl rounded-br-md'
        : 'rounded-2xl rounded-bl-md'
    case 'none':
      return 'rounded-none bg-transparent border-0 shadow-none'
    default:
      return 'rounded-2xl'
  }
}

// Determine readable text color (white/black) for a given hex bubble background.
function readableTextOn(hex: string | null): string {
  if (!hex) return ''
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return ''
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  // YIQ contrast formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#111111' : '#ffffff'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  )
}

function ThemeSegmented({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const options = ['light', 'dark', 'system'] as const
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-card p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors min-h-[36px]',
            value === opt
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-accent'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// V13 — Chat background color picker. 4 swatches + reset.
function ChatBackgroundPicker({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (hex: string | null) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {CHAT_BG_PRESETS.map((t) => {
          const isActive = selected?.toLowerCase() === t.hex.toLowerCase()
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.hex)}
              aria-pressed={isActive}
              aria-label={t.label}
              className="flex flex-col items-center gap-1.5 focus:outline-none"
            >
              <span
                className={cn(
                  'flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105',
                  isActive && 'ring-2 ring-offset-2 ring-offset-background'
                )}
                style={{
                  backgroundColor: t.hex,
                  // @ts-expect-error CSS var for ring color
                  '--tw-ring-color': t.hex,
                }}
              >
                {isActive && <Check className="h-5 w-5 text-white drop-shadow" />}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {t.label}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all min-h-[44px]',
          selected === null
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border text-muted-foreground hover:border-primary/40'
        )}
      >
        <RotateCcw className="h-4 w-4" />
        Reset to default
      </button>
    </div>
  )
}

// V13 — Bubble color picker for sent/received messages.
function BubbleColorPicker({
  label,
  selected,
  onSelect,
  isMine,
}: {
  label: string
  selected: string | null
  onSelect: (hex: string | null) => void
  isMine: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
        {BUBBLE_COLOR_PRESETS.map((c) => {
          const isActive =
            (selected || null) === (c.hex || null) ||
            (!!selected && !!c.hex && selected.toLowerCase() === c.hex.toLowerCase())
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect(c.hex)}
              aria-pressed={isActive}
              aria-label={c.label}
              title={c.label}
              className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              style={{
                backgroundColor: c.hex || 'transparent',
                borderColor: isActive
                  ? 'var(--primary)'
                  : c.hex
                    ? 'transparent'
                    : 'var(--border)',
                backgroundImage: !c.hex
                  ? 'linear-gradient(135deg, var(--muted) 0%, var(--card) 100%)'
                  : undefined,
                boxShadow: isActive ? '0 0 0 2px var(--primary)' : undefined,
              }}
            >
              {isActive && (
                <Check
                  className="h-4 w-4"
                  style={{ color: c.hex ? readableTextOn(c.hex) : 'var(--foreground)' }}
                />
              )}
              {!c.hex && !isActive && (
                <span className="text-[9px] font-medium text-muted-foreground">Def</span>
              )}
            </button>
          )
        })}
      </div>
      {/* Preview bubble */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
        <span className="text-[11px] font-medium text-muted-foreground min-w-[60px]">
          Preview:
        </span>
        <div
          className={cn(
            'max-w-[78%] rounded-2xl px-3 py-1.5 text-sm shadow-sm',
            isMine ? 'rounded-br-md' : 'rounded-bl-md'
          )}
          style={{
            backgroundColor: selected || (isMine ? '#10b981' : 'var(--card)'),
            color: selected ? readableTextOn(selected) : isMine ? '#fff' : 'var(--foreground)',
            border: !selected && !isMine ? '1px solid var(--border)' : 'none',
          }}
        >
          {isMine ? 'Hi 👋' : 'Hey! 😊'}
        </div>
      </div>
    </div>
  )
}

function WallpaperGrid({
  selected,
  onSelect,
  isPremium,
}: {
  selected: string
  onSelect: (id: string) => void
  isPremium: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const { toast } = useToast()

  // Per PRD: [0] is "default" — visible wallpapers are slice(1, 13) (12 wallpapers).
  // "More" expands to slice(13) (the remaining 14).
  const visible = WALLPAPERS.slice(1, 13)
  const more = WALLPAPERS.slice(13)

  const handleSelect = (w: (typeof WALLPAPERS)[number]) => {
    if (!isPremium) {
      toast({ title: 'Image wallpapers are a Premium feature' })
      return
    }
    onSelect(w.id)
  }

  const renderItem = (w: (typeof WALLPAPERS)[number]) => {
    const isActive = selected === w.id
    return (
      <button
        key={w.id}
        type="button"
        onClick={() => handleSelect(w)}
        aria-label={w.name}
        aria-pressed={isActive}
        className={cn(
          'relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
          isActive
            ? 'border-primary ring-2 ring-primary'
            : 'border-border hover:border-primary/50',
          !isPremium && 'cursor-not-allowed'
        )}
        style={getWallpaperStyle(w) as React.CSSProperties}
      >
        {/* Active check */}
        {isActive && isPremium && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
        {/* Premium lock overlay for non-premium users */}
        {!isPremium && (
          <>
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
              <Lock className="h-4 w-4 text-white drop-shadow" />
            </span>
            <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-bold uppercase text-white shadow">
              <Sparkles className="h-2.5 w-2.5" /> Premium
            </span>
          </>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {!isPremium && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Image wallpapers are a <span className="font-semibold">Premium</span>{' '}
            feature. Upgrade to unlock all 25 wallpapers.
          </span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {visible.map(renderItem)}
        {expanded && more.map(renderItem)}
      </div>
      {!expanded && more.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-accent/50 min-h-[40px]"
        >
          <MoreHorizontal className="h-3.5 w-3.5" /> More wallpapers ({more.length})
        </button>
      )}
    </div>
  )
}

function MessageStyleCards({
  selected,
  onSelect,
  fontSizePx,
  fontFamilyClass,
}: {
  selected: string
  onSelect: (v: string) => void
  fontSizePx: number
  fontFamilyClass: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {MESSAGE_STYLES.map((s) => {
        const isActive = selected === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={isActive}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all min-h-[44px]',
              isActive
                ? 'border-primary ring-2 ring-primary'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div
              className={cn(
                'max-w-full bg-primary px-2.5 py-1.5 text-primary-foreground shadow-sm',
                previewBubbleClass(s.id, true)
              )}
              style={{
                fontSize: `${fontSizePx}px`,
                fontFamily: 'inherit',
              }}
            >
              <span className={cn('whitespace-nowrap', fontFamilyClass)}>Hi 👋</span>
            </div>
            <span className="text-xs font-medium">{s.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function FontList({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FONT_OPTIONS.map((f) => {
        const isActive = selected === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-all min-h-[40px]',
              isActive
                ? 'border-primary ring-2 ring-primary'
                : 'border-border hover:border-primary/50',
              f.className
            )}
          >
            <span>{f.name}</span>
            {f.isPremium && <span aria-label="Premium font">👑</span>}
          </button>
        )
      })}
    </div>
  )
}

function FontImport({
  onUploaded,
}: {
  onUploaded: (url: string) => void
}) {
  const { toast } = useToast()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { apiUpload } = await import('@/lib/api')
      const res: any = await apiUpload('/api/upload', file, 'file')
      const url = res?.url
      if (!url) throw new Error('Upload did not return a URL')
      onUploaded(url)
      toast({ title: 'Custom font applied' })
    } catch (err: any) {
      toast({
        title: err?.message || 'Font upload failed',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="min-h-[40px]"
      >
        {uploading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-1 h-4 w-4" />
        )}
        Upload .ttf / .otf
      </Button>
      <p className="text-xs text-muted-foreground">
        Upload a font file to apply as your custom chat font.
      </p>
    </div>
  )
}

function LivePreview({
  wallpaper,
  messageStyle,
  fontFamily,
  fontSize,
}: {
  wallpaper: (typeof WALLPAPERS)[number]
  messageStyle: string
  fontFamily: (typeof FONT_OPTIONS)[number]
  fontSize: number
}) {
  const wpStyle = getWallpaperStyle(wallpaper) as React.CSSProperties
  return (
    <div
      className="rounded-xl border border-border p-3"
      style={wpStyle}
    >
      <div className="flex flex-col gap-2">
        {/* Received */}
        <div className="flex justify-start">
          <div
            className={cn(
              'max-w-[78%] bg-card px-3 py-1.5 text-foreground shadow-sm border border-border',
              previewBubbleClass(messageStyle, false)
            )}
            style={{ fontSize: `${fontSize}px` }}
          >
            <span className={cn('whitespace-pre-wrap', fontFamily.className)}>
              Hey! How are you? 😊
            </span>
          </div>
        </div>
        {/* Sent */}
        <div className="flex justify-end">
          <div
            className={cn(
              'max-w-[78%] bg-primary px-3 py-1.5 text-primary-foreground shadow-sm',
              previewBubbleClass(messageStyle, true)
            )}
            style={{ fontSize: `${fontSize}px` }}
          >
            <span className={cn('whitespace-pre-wrap', fontFamily.className)}>
              I&apos;m great! Thanks 🙌
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Premium gate (for global prefs — theme/fonts/message style)
// ---------------------------------------------------------------------------

function PremiumGateOverlay() {
  const { toast } = useToast()
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-50/60 p-6 text-center dark:bg-amber-950/20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
        <Lock className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-semibold">Premium Feature</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Global themes, fonts, and message styles are Premium features. Color
          theming and wallpapers are available above.
        </p>
      </div>
      <Button
        type="button"
        className="btn-brand min-h-[40px]"
        onClick={() => toast({ title: 'Visit Profile to upgrade' })}
      >
        <Sparkles className="mr-1 h-4 w-4" /> Upgrade
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomizeDialog({
  open,
  onClose,
  onOpenChange,
  conversationId,
  isGroup: _isGroup,
  currentThemeColor,
  onApplyThemeColor,
}: CustomizeDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const customizer = useCustomizerSafe()

  // Local state mirrors customizer preferences so the dialog can work even
  // when the provider has not been mounted yet.
  const [prefs, setPrefs] = React.useState<any>(customizer?.preferences || null)
  const [saving, setSaving] = React.useState<string | null>(null)
  const [fontImportUrl, setFontImportUrl] = React.useState<string | null>(null)
  const [applyingColor, setApplyingColor] = React.useState(false)

  // V13 — per-conversation color state (chat background, sent + received bubbles).
  const [localBgColor, setLocalBgColor] = React.useState<string | null>(
    currentThemeColor || null,
  )

  // Per-conversation bubble colors (stored on the Conversation row, optimistically
  // mirrored locally so the swatch reflects the current state).
  const [localSentColor, setLocalSentColor] = React.useState<string | null>(null)
  const [localReceivedColor, setLocalReceivedColor] = React.useState<string | null>(null)

  // Sync from customizer context when it changes
  React.useEffect(() => {
    if (customizer?.preferences) setPrefs(customizer.preferences)
  }, [customizer?.preferences])

  // Sync per-conversation color state when the dialog opens or themeColor changes.
  React.useEffect(() => {
    setLocalBgColor(currentThemeColor || null)
  }, [open, currentThemeColor])

  // Fetch fresh prefs + per-conversation bubble colors when the dialog opens.
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await apiFetch('/api/preferences').catch(() => null)
        const p = res && (res.preferences || res)
        if (!cancelled && p) setPrefs(p)
      } catch {}
      if (conversationId) {
        try {
          const convRes: any = await apiFetch(`/api/conversations/${conversationId}`)
          const conv = convRes?.conversation || convRes
          if (!cancelled) {
            setLocalSentColor(conv?.sentBubbleColor || null)
            setLocalReceivedColor(conv?.receivedBubbleColor || null)
          }
        } catch {}
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, conversationId])

  const isPremium = !!(user as any)?.isPremium

  const handleOpenChange = (o: boolean) => {
    if (o) {
      onOpenChange?.(true)
      return
    }
    // Closing — prefer canonical `onClose`, then `onOpenChange(false)`.
    if (onClose) onClose()
    else onOpenChange?.(false)
  }

  // Save a single preference key — uses customizer context when available,
  // otherwise falls back to apiFetch directly. Also updates local state.
  const savePref = async (patch: Record<string, any>) => {
    setPrefs((p: any) => ({ ...(p || {}), ...patch }))
    if (customizer) {
      try {
        await customizer.setPreference(patch)
      } catch {}
      return
    }
    setSaving(Object.keys(patch).join(','))
    try {
      await apiFetch('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  // V13 — Apply per-conversation chat background color (immediately on tap).
  const applyBgColor = async (hex: string | null) => {
    setLocalBgColor(hex)
    onApplyThemeColor?.(hex)
    if (!conversationId) return
    setApplyingColor(true)
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ themeColor: hex }),
      })
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to update chat background',
        variant: 'destructive',
      })
    } finally {
      setApplyingColor(false)
    }
  }

  // V13 — Apply per-conversation sent bubble color.
  const applySentColor = async (hex: string | null) => {
    setLocalSentColor(hex)
    if (!conversationId) return
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sentBubbleColor: hex }),
      })
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to update sent bubble color',
        variant: 'destructive',
      })
    }
  }

  // V13 — Apply per-conversation received bubble color.
  const applyReceivedColor = async (hex: string | null) => {
    setLocalReceivedColor(hex)
    if (!conversationId) return
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ receivedBubbleColor: hex }),
      })
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to update received bubble color',
        variant: 'destructive',
      })
    }
  }

  // ----- Derived selections -----
  const theme: string = prefs?.theme || 'system'
  const wallpaperId: string = prefs?.wallpaper || 'default'
  const messageStyle: string = prefs?.messageStyle || 'bubble'
  const fontSize: number = Number(prefs?.fontSize) || 14
  const fontFamilyId: string = prefs?.fontFamily || 'sans'

  const wallpaper =
    WALLPAPERS.find((w) => w.id === wallpaperId) || WALLPAPERS[0]
  const fontFamily =
    FONT_OPTIONS.find((f) => f.id === fontFamilyId) || FONT_OPTIONS[0]

  const setTheme = (v: string) => {
    applyTheme(v)
    savePref({ theme: v })
  }

  const setWallpaper = (id: string) => savePref({ wallpaper: id })
  const setMessageStyle = (v: string) => savePref({ messageStyle: v })
  const setFontFamily = (id: string) => savePref({ fontFamily: id })
  const setFontSize = (v: number) => savePref({ fontSize: v })

  const handleFontImport = async (url: string) => {
    setFontImportUrl(url)
    await savePref({ customFontUrl: url, fontFamily: 'custom' })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Customize
            {applyingColor && (
              <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Personalize your chat with chat background colors, bubble colors,
            and image wallpapers.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[78dvh]">
          <div className="space-y-6 p-4">
            {/* Saving indicator */}
            {saving && (
              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </div>
            )}

            {/* ====================================================
                Section 1 (V13): Chat background — 4 color swatches
                Available to ALL users (per-conversation override).
                ==================================================== */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionTitle>Chat Background</SectionTitle>
                <span className="text-[11px] text-muted-foreground">
                  Per-conversation
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pick a color to tint this chat&apos;s background.
              </p>
              <ChatBackgroundPicker
                selected={localBgColor}
                onSelect={applyBgColor}
              />
            </section>

            {/* ====================================================
                Section 2 (V13): Bubble colors — sent + received
                Available to ALL users (per-conversation override).
                ==================================================== */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Message Bubble Colors</SectionTitle>
                <span className="text-[11px] text-muted-foreground">
                  Per-conversation
                </span>
              </div>
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
                <BubbleColorPicker
                  label="Sent bubble color"
                  selected={localSentColor}
                  onSelect={applySentColor}
                  isMine
                />
                <BubbleColorPicker
                  label="Received bubble color"
                  selected={localReceivedColor}
                  onSelect={applyReceivedColor}
                  isMine={false}
                />
              </div>
            </section>

            {/* ====================================================
                Section 3 (V13): Image wallpapers — LOCKED for non-premium.
                Per-task: lock icon overlay + Premium badge per item.
                ==================================================== */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionTitle>Image Wallpapers</SectionTitle>
                {!isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    <Lock className="h-2.5 w-2.5" /> Premium
                  </span>
                )}
              </div>
              <WallpaperGrid
                selected={wallpaperId}
                onSelect={setWallpaper}
                isPremium={isPremium}
              />
            </section>

            {/* ====================================================
                Sections 4-8: Premium-only global customizations
                (theme, message style, font size, font family, font import)
                ==================================================== */}
            {!isPremium ? (
              <section className="space-y-2">
                <SectionTitle>Global Themes &amp; Fonts</SectionTitle>
                <PremiumGateOverlay />
              </section>
            ) : (
              <>
                {/* Section 4: Theme */}
                <section className="space-y-2">
                  <SectionTitle>Theme</SectionTitle>
                  <ThemeSegmented value={theme} onChange={setTheme} />
                </section>

                {/* Section 5: Message Style */}
                <section className="space-y-2">
                  <SectionTitle>Message Style</SectionTitle>
                  <MessageStyleCards
                    selected={messageStyle}
                    onSelect={setMessageStyle}
                    fontSizePx={fontSize}
                    fontFamilyClass={fontFamily.className}
                  />
                </section>

                {/* Section 6: Font Size */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Font Size</SectionTitle>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {fontSize}px
                    </span>
                  </div>
                  <Slider
                    min={FONT_SIZE_MIN}
                    max={FONT_SIZE_MAX}
                    step={1}
                    value={[fontSize]}
                    onValueChange={(v) => setFontSize(Number(v[0]) || fontSize)}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{FONT_SIZE_MIN}px</span>
                    <span>{FONT_SIZE_MAX}px</span>
                  </div>
                </section>

                {/* Section 7: Font Family */}
                <section className="space-y-2">
                  <SectionTitle>Font Family</SectionTitle>
                  <FontList selected={fontFamilyId} onSelect={setFontFamily} />
                  {fontImportUrl && (
                    <p className="text-xs text-primary">
                      Custom font applied: <code>{fontImportUrl}</code>
                    </p>
                  )}
                </section>

                {/* Section 8: Font Import */}
                <section className="space-y-2">
                  <SectionTitle>Import Custom Font</SectionTitle>
                  <FontImport onUploaded={handleFontImport} />
                </section>

                {/* Live Preview */}
                <section className="space-y-2">
                  <SectionTitle>Live Preview</SectionTitle>
                  <LivePreview
                    wallpaper={wallpaper}
                    messageStyle={messageStyle}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                  />
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
