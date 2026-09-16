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
} from 'lucide-react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, apiUpload } from '@/lib/api'
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
}

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
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
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

function WallpaperGrid({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)

  // Per PRD: [0] is "default" — visible wallpapers are slice(1, 13) (12 wallpapers).
  // "More" expands to slice(13) (the remaining 14).
  const visible = WALLPAPERS.slice(1, 13)
  const more = WALLPAPERS.slice(13)

  const renderItem = (w: (typeof WALLPAPERS)[number]) => {
    const isActive = selected === w.id
    return (
      <button
        key={w.id}
        type="button"
        onClick={() => onSelect(w.id)}
        aria-label={w.name}
        aria-pressed={isActive}
        className={cn(
          'relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
          isActive
            ? 'border-primary ring-2 ring-primary'
            : 'border-border hover:border-primary/50'
        )}
        style={getWallpaperStyle(w) as React.CSSProperties}
      >
        {isActive && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {visible.map(renderItem)}
        {expanded && more.map(renderItem)}
      </div>
      {!expanded && more.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-accent/50"
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
              'flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all',
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
              'flex items-center justify-between rounded-lg border-2 px-3 py-2 text-sm transition-all',
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
// Premium gate
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
          Customization is a Premium feature. Upgrade to unlock themes,
          wallpapers, fonts, and message styles.
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
  conversationId: _conversationId,
  isGroup: _isGroup,
}: CustomizeDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const customizer = useCustomizerSafe()

  // Local state mirrors customizer preferences so the dialog can work even
  // when the provider has not been mounted yet.
  const [prefs, setPrefs] = React.useState<any>(customizer?.preferences || null)
  const [saving, setSaving] = React.useState<string | null>(null)
  const [fontImportUrl, setFontImportUrl] = React.useState<string | null>(null)

  // Sync from customizer context when it changes
  React.useEffect(() => {
    if (customizer?.preferences) setPrefs(customizer.preferences)
  }, [customizer?.preferences])

  // Fetch fresh prefs when the dialog opens (covers the case where
  // preferences changed elsewhere).
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await apiFetch('/api/preferences').catch(() => null)
        const p = res && (res.preferences || res)
        if (!cancelled && p) setPrefs(p)
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [open])

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
            <Sparkles className="h-4 w-4 text-primary" />
            Customize
          </DialogTitle>
          <DialogDescription className="sr-only">
            Personalize your chat with theme, wallpaper, message style, font
            and font size.
          </DialogDescription>
        </DialogHeader>

        {/* V7 — note about per-conversation chat themes (premium feature) */}
        <div className="border-b bg-primary/5 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Chat Themes</span>{' '}
            are available per-conversation via the{' '}
            <span className="font-medium text-foreground">3-dot menu</span> in
            each chat (premium only).
          </p>
        </div>

        <ScrollArea className="max-h-[70dvh]">
          <div className="space-y-6 p-4">
            {!isPremium ? (
              <PremiumGateOverlay />
            ) : (
              <>
                {/* Saving indicator */}
                {saving && (
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </div>
                )}

                {/* Section 1: Theme */}
                <section className="space-y-2">
                  <SectionTitle>Theme</SectionTitle>
                  <ThemeSegmented value={theme} onChange={setTheme} />
                </section>

                {/* Section 2: Wallpaper */}
                <section className="space-y-2">
                  <SectionTitle>Wallpaper</SectionTitle>
                  <WallpaperGrid selected={wallpaperId} onSelect={setWallpaper} />
                </section>

                {/* Section 3: Message Style */}
                <section className="space-y-2">
                  <SectionTitle>Message Style</SectionTitle>
                  <MessageStyleCards
                    selected={messageStyle}
                    onSelect={setMessageStyle}
                    fontSizePx={fontSize}
                    fontFamilyClass={fontFamily.className}
                  />
                </section>

                {/* Section 4: Font Size */}
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

                {/* Section 5: Font Family */}
                <section className="space-y-2">
                  <SectionTitle>Font Family</SectionTitle>
                  <FontList selected={fontFamilyId} onSelect={setFontFamily} />
                  {fontImportUrl && (
                    <p className="text-xs text-primary">
                      Custom font applied: <code>{fontImportUrl}</code>
                    </p>
                  )}
                </section>

                {/* Section 6: Font Import */}
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
