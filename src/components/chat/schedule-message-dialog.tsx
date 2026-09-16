'use client'

import * as React from 'react'
import {
  Clock,
  Calendar as CalendarIcon,
  Send,
  X,
  Loader2,
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface ScheduleMessageDialogProps {
  open: boolean
  onClose: () => void
  conversationId: string
  /** The message being replied to, if any. */
  replyTo?: any
  /** Optional initial content (e.g. text the user had typed in the composer). */
  initialContent?: string
  /** Optional: when the user had typed an image-only scheduled message. */
  initialMediaUrl?: string
  /** Optional: the initial message type ('text' | 'image'). */
  initialType?: 'text' | 'image'
  /** Called after a message is successfully scheduled. */
  onScheduled?: (scheduledFor: string) => void
}

interface Preset {
  label: string
  /** Returns the target Date, or null if the preset is disabled. */
  when: () => Date | null
}

const PRESETS: Preset[] = [
  {
    label: 'In 1 hour',
    when: () => {
      const d = new Date()
      d.setHours(d.getHours() + 1)
      return d
    },
  },
  {
    label: 'In 3 hours',
    when: () => {
      const d = new Date()
      d.setHours(d.getHours() + 3)
      return d
    },
  },
  {
    label: 'Tomorrow 9am',
    when: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    },
  },
  {
    label: 'Next week',
    when: () => {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      return d
    },
  },
]

/**
 * Convert a Date into a value suitable for an `<input type="datetime-local">`:
 * "YYYY-MM-DDTHH:mm" in the user's local time. (The browser handles the
 * timezone conversion when the user submits, and we re-parse with `new Date()`
 * to get an absolute timestamp for storage.)
 */
function toLocalInputValue(d: Date): string {
  // Build the YYYY-MM-DDTHH:mm string in local time manually so we don't rely
  // on the deprecated `toISOString` (which is UTC and would shift the value).
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function ScheduleMessageDialog({
  open,
  onClose,
  conversationId,
  replyTo,
  initialContent,
  initialMediaUrl,
  initialType,
  onScheduled,
}: ScheduleMessageDialogProps) {
  const { toast } = useToast()
  const [content, setContent] = React.useState('')
  const [mediaUrl, setMediaUrl] = React.useState<string | undefined>(undefined)
  const [type, setType] = React.useState<'text' | 'image'>('text')
  const [whenInput, setWhenInput] = React.useState<string>('')
  const [submitting, setSubmitting] = React.useState(false)

  // Reset / pre-fill the form whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setContent(initialContent || '')
    setMediaUrl(initialMediaUrl)
    setType(initialType || 'text')
    // Default the time picker to 1 hour from now if no preset is chosen.
    const defaultWhen = new Date()
    defaultWhen.setHours(defaultWhen.getHours() + 1)
    defaultWhen.setMinutes(0, 0, 0)
    setWhenInput(toLocalInputValue(defaultWhen))
  }, [open, initialContent, initialMediaUrl, initialType])

  const handlePreset = (preset: Preset) => {
    const d = preset.when()
    if (!d) return
    setWhenInput(toLocalInputValue(d))
  }

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async () => {
    if (submitting) return

    const trimmed = content.trim()
    if (type === 'text' && !trimmed) {
      toast({ title: 'Please enter a message to schedule', variant: 'destructive' })
      return
    }
    if (type === 'image' && !mediaUrl) {
      toast({ title: 'No image to schedule', variant: 'destructive' })
      return
    }
    if (!whenInput) {
      toast({ title: 'Pick a date and time', variant: 'destructive' })
      return
    }

    // `<input type="datetime-local">` returns a local-time string without
    // timezone. `new Date('YYYY-MM-DDTHH:mm')` parses it as local time, which
    // is what we want — the user picked a local time, so we store the
    // resulting absolute timestamp.
    const when = new Date(whenInput)
    if (isNaN(when.getTime())) {
      toast({ title: 'Invalid date/time', variant: 'destructive' })
      return
    }
    const now = Date.now()
    if (when.getTime() <= now) {
      toast({ title: 'Pick a time in the future', variant: 'destructive' })
      return
    }
    if (when.getTime() - now > MAX_SCHEDULE_AHEAD_MS) {
      toast({
        title: 'Too far in the future',
        description: 'Scheduled messages can be at most 30 days ahead.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/api/messages/schedule', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          content: trimmed,
          type,
          mediaUrl: mediaUrl || undefined,
          replyToId: replyTo?.id || undefined,
          scheduledFor: when.toISOString(),
        }),
      })
      toast({
        title: 'Message scheduled',
        description: `Will send ${format(when, "dd MMM 'at' h:mm a")}`,
      })
      onScheduled?.(when.toISOString())
      onClose()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to schedule message', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Schedule message
          </DialogTitle>
          <DialogDescription>
            Pick when to send. You can cancel or edit it later from Profile →
            Scheduled Messages.
          </DialogDescription>
        </DialogHeader>

        {/* Reply context */}
        {replyTo && (
          <div className="rounded-lg border-l-4 border-primary/60 bg-muted/60 p-3">
            <div className="text-[11px] font-medium text-muted-foreground">
              Replying to {replyTo?.sender?.name || replyTo?.sender?.username || 'message'}
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-foreground/80">
              {replyTo?.content || (replyTo?.type === 'image' ? '📷 Photo' : '(empty)')}
            </div>
          </div>
        )}

        {/* Message content */}
        {type === 'image' && mediaUrl ? (
          <div className="relative overflow-hidden rounded-lg border">
            <img src={mediaUrl} alt="Scheduled image" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setType('text')
                setMediaUrl(undefined)
              }}
              className="absolute right-2 top-2 flex h-8 w-8 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/80 backdrop-blur"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type the message to schedule…"
            className="min-h-[88px] resize-none"
            autoFocus
            rows={3}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter schedules the message
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
        )}

        {/* Quick presets */}
        <div>
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Quick presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p)}
                className="ghost-btn min-h-[36px] rounded-full px-3 py-1.5 text-xs"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date/time picker */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarIcon className="h-3 w-3" /> Send at
          </div>
          <input
            type="datetime-local"
            value={whenInput}
            onChange={(e) => setWhenInput(e.target.value)}
            min={toLocalInputValue(new Date())}
            className={cn(
              'flex min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            Tip: Ctrl/Cmd + Enter to schedule quickly.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-brand min-h-[44px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
