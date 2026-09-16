'use client'

import * as React from 'react'
import {
  Bookmark,
  Check,
  Loader2,
  Plus,
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ============================================================
// CreateHighlightDialog
// ============================================================
// Lets a user pick one or more of their stories (active or expired)
// and create a new StoryHighlight with a custom title + cover color.

const COVER_COLOR_PRESETS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#64748b', // slate
]

interface ArchiveStory {
  id: string
  type: 'text' | 'image'
  content: string
  bgColor: string
  textColor: string
  caption?: string | null
  createdAt: string
  isExpired: boolean
}

interface CreateHighlightDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function CreateHighlightDialog({
  open,
  onClose,
  onCreated,
}: CreateHighlightDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [stories, setStories] = React.useState<ArchiveStory[]>([])
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [title, setTitle] = React.useState('')
  const [coverColor, setCoverColor] = React.useState(COVER_COLOR_PRESETS[0])
  const [submitting, setSubmitting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/stories/archive')
      const list: ArchiveStory[] = Array.isArray(res?.stories) ? res.stories : []
      setStories(list)
    } catch {
      setStories([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      load()
      setSelected(new Set())
      setTitle('')
      setCoverColor(COVER_COLOR_PRESETS[0])
    }
  }, [open, load])

  const toggleStory = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    if (selected.size === 0) {
      toast({ title: 'Pick at least one story', variant: 'destructive' })
      return
    }
    const titleStr = title.trim() || 'Highlights'
    setSubmitting(true)
    try {
      await apiFetch('/api/highlights', {
        method: 'POST',
        body: JSON.stringify({
          title: titleStr,
          coverColor,
          storyIds: Array.from(selected),
        }),
      })
      toast({ title: 'Highlight created' })
      onCreated?.()
      onClose()
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to create highlight',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 sm:max-w-md">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-primary" /> New Highlight
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pick from your existing stories to create a new highlight.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Highlights"
              className="min-h-[44px]"
              maxLength={50}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Cover color
            </label>
            <div className="flex flex-wrap gap-2">
              {COVER_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCoverColor(c)}
                  aria-label={`Cover color ${c}`}
                  aria-pressed={coverColor === c}
                  className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full"
                  style={{ backgroundColor: c }}
                >
                  {coverColor === c && (
                    <Check className="h-4 w-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Pick stories ({selected.size} selected)
            </label>
            <ScrollArea className="max-h-72 rounded-lg border border-border">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : stories.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  You don&apos;t have any stories yet. Create a story first,
                  then save it to a highlight.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-1 p-2">
                  {stories.map((s) => {
                    const isSel = selected.has(s.id)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => toggleStory(s.id)}
                          aria-pressed={isSel}
                          className={cn(
                            'relative aspect-[3/4] w-full overflow-hidden rounded-md border-2 transition-all',
                            isSel
                              ? 'border-primary ring-2 ring-primary'
                              : 'border-border hover:border-primary/40'
                          )}
                          style={
                            s.type === 'text'
                              ? { backgroundColor: s.bgColor || '#10b981' }
                              : undefined
                          }
                        >
                          {s.type === 'image' ? (
                            <img
                              src={s.content}
                              alt={s.caption || 'story'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold leading-tight"
                              style={{ color: s.textColor || '#ffffff' }}
                            >
                              {(s.content || '').slice(0, 28)}
                            </span>
                          )}
                          {isSel && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                          {s.isExpired && (
                            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[8px] font-medium text-white">
                              Expired
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t p-3 gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] flex-1"
          >
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={submitting || selected.size === 0}
            className="btn-brand min-h-[44px] flex-1"
          >
            {submitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
