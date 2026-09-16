'use client'

import * as React from 'react'
import {
  Check,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ============================================================
// ChatThemePicker
// ============================================================
// Per-conversation accent color picker (premium-only). Shows a grid of 12
// preset theme colors. Selecting one and tapping "Apply" PATCHes the
// conversation's `themeColor`. Non-premium users see a "Premium Feature"
// overlay instead of the picker.

export interface ChatTheme {
  key: string
  label: string
  hex: string
}

// 12 preset theme colors per task spec
export const CHAT_THEMES: ChatTheme[] = [
  { key: 'emerald', label: 'Emerald', hex: '#10b981' },
  { key: 'blue', label: 'Blue', hex: '#3b82f6' },
  { key: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { key: 'pink', label: 'Pink', hex: '#ec4899' },
  { key: 'orange', label: 'Orange', hex: '#f97316' },
  { key: 'teal', label: 'Teal', hex: '#14b8a6' },
  { key: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { key: 'rose', label: 'Rose', hex: '#f43f5e' },
  { key: 'amber', label: 'Amber', hex: '#f59e0b' },
  { key: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { key: 'violet', label: 'Violet', hex: '#a855f7' },
  { key: 'slate', label: 'Slate', hex: '#64748b' },
]

interface ChatThemePickerProps {
  open: boolean
  onClose: () => void
  conversationId: string
  currentColor: string | null
  onApply?: (color: string | null) => void
}

export function ChatThemePicker({
  open,
  onClose,
  conversationId,
  currentColor,
  onApply,
}: ChatThemePickerProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isPremium = !!(user as any)?.isPremium

  // selected === null means "Reset to default" (no themeColor)
  const [selected, setSelected] = React.useState<string | null>(currentColor || null)
  const [applying, setApplying] = React.useState(false)

  React.useEffect(() => {
    if (open) setSelected(currentColor || null)
  }, [open, currentColor])

  const handleApply = async () => {
    setApplying(true)
    try {
      await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ themeColor: selected }),
      })
      onApply?.(selected)
      toast({ title: 'Chat theme updated' })
      onClose()
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to update theme',
        variant: 'destructive',
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 sm:max-w-md">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Chat Theme
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose a color theme for this conversation. This overrides the
            global wallpaper for this chat only.
          </DialogDescription>
        </DialogHeader>

        {!isPremium ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Premium Feature</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Per-conversation chat themes are a Premium feature. Upgrade to
                unlock custom accent colors for each of your chats.
              </p>
            </div>
            <Button
              type="button"
              className="btn-brand min-h-[44px]"
              onClick={() =>
                toast({ title: 'Visit Profile to upgrade to Premium' })
              }
            >
              <Sparkles className="mr-1 h-4 w-4" /> Upgrade to Premium
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60dvh]">
              <div className="p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Pick a color theme for this chat. It overrides your global
                  wallpaper.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {CHAT_THEMES.map((t) => {
                    const isActive = selected === t.hex
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setSelected(t.hex)}
                        aria-pressed={isActive}
                        aria-label={t.label}
                        className="flex flex-col items-center gap-1.5 focus:outline-none"
                      >
                        <span
                          className={cn(
                            'relative flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-full shadow-sm transition-transform hover:scale-105',
                            isActive && 'ring-2 ring-offset-2 ring-offset-background'
                          )}
                          style={{
                            backgroundColor: t.hex,
                            // @ts-expect-error CSS var for ring color
                            '--tw-ring-color': t.hex,
                          }}
                        >
                          {isActive && (
                            <Check className="h-5 w-5 text-white drop-shadow" />
                          )}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {t.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Reset option */}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-pressed={selected === null}
                  className={cn(
                    'mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all min-h-[44px]',
                    selected === null
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  )}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to default
                </button>

                {/* Preview swatch */}
                {selected && (
                  <div className="mt-4 rounded-lg border border-border p-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Preview
                    </p>
                    <div
                      className="relative h-16 overflow-hidden rounded-md"
                      style={{
                        background: `linear-gradient(135deg, ${selected}22, ${selected}08)`,
                      }}
                    >
                      <div className="absolute inset-0 flex flex-col gap-1.5 p-2">
                        <div className="max-w-[60%] rounded-full bg-card px-2 py-1 text-[10px] shadow-sm">
                          Hi 👋
                        </div>
                        <div
                          className="ml-auto max-w-[60%] rounded-full px-2 py-1 text-[10px] text-white shadow-sm"
                          style={{ backgroundColor: selected }}
                        >
                          Looking good!
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="border-t p-3 gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={applying}
                className="min-h-[44px] flex-1"
              >
                <X className="mr-1 h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={applying}
                className="btn-brand min-h-[44px] flex-1"
              >
                {applying ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Palette className="mr-1 h-4 w-4" />
                )}
                Apply
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
