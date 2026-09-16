'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Loader2, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import type { StoryItem } from './stories-row'

// ============================================================
// HighlightItem / HighlightsRow
// ============================================================
// Horizontal scrollable row of highlight circles (Instagram-style).
// Each highlight shows the first story's content (image or text snippet)
// inside a colored ring. Clicking opens the story viewer for that highlight.

export interface Highlight {
  id: string
  title: string
  coverColor: string
  storyIds: string[]
  stories?: StoryItem[]
  createdAt?: string
  updatedAt?: string
}

interface HighlightsRowProps {
  highlights: Highlight[]
  loading?: boolean
  /** Is this the current user's own profile (allows delete / create)? */
  isOwn?: boolean
  /** Open the story viewer for a highlight (pass the highlight). */
  onOpenHighlight?: (highlight: Highlight) => void
  /** Triggered when the user taps the "New" tile. */
  onCreateHighlight?: () => void
  /** Called after a highlight is deleted (so parent can refetch). */
  onHighlightsChanged?: () => void
  /** V8 — "View All" action: optional callback to open a full list of highlights. */
  onViewAll?: () => void
}

// V8 — enlarge highlight tiles to 72px (was 60px) for a bolder presence.
const TILE_SIZE = 72
const TILE_INNER = 64

const RING_GRADIENT = 'linear-gradient(135deg, #ec4899, #8b5cf6 50%, #3b82f6)'

export function HighlightsRow({
  highlights,
  loading,
  isOwn,
  onOpenHighlight,
  onCreateHighlight,
  onHighlightsChanged,
  onViewAll,
}: HighlightsRowProps) {
  const { toast } = useToast()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  )

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await apiFetch(`/api/highlights/${id}`, { method: 'DELETE' })
      toast({ title: 'Highlight deleted' })
      onHighlightsChanged?.()
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to delete highlight',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // Hide the whole section if there are no highlights and the user can't
  // create any (not own profile).
  if (!loading && highlights.length === 0 && !isOwn) return null

  return (
    <section
      className="mt-3 animate-fade-in-up"
      aria-label="Story Highlights"
    >
      <div className="flex items-center justify-between">
        <h2 className="section-header">
          <Bookmark className="h-4 w-4 text-primary" /> Highlights
        </h2>
        {highlights.length > 0 && isOwn && (
          <div className="flex items-center gap-1">
            {/* V8 — "View All" text link (left of "+ New") */}
            {onViewAll && (
              <button
                type="button"
                onClick={onViewAll}
                className="flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                View All
              </button>
            )}
            <button
              type="button"
              onClick={onCreateHighlight}
              className="flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
        )}
      </div>

      {/* V8 — Gradient overlays on left/right edges to hint scrollability. */}
      <div className="relative mt-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="no-scrollbar flex items-start gap-3 overflow-x-auto pb-1">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex w-[72px] shrink-0 flex-col items-center gap-1"
            >
              <div className="animate-pulse rounded-full bg-muted" style={{ height: TILE_SIZE, width: TILE_SIZE }} />
              <span className="mt-0.5 h-3 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))
        ) : highlights.length === 0 && isOwn ? (
          <button
            type="button"
            onClick={onCreateHighlight}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center"
            aria-label="Create a new highlight"
          >
            <span
              className="flex items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              style={{ height: TILE_SIZE, width: TILE_SIZE }}
            >
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-0.5 block max-w-[64px] truncate text-[11px] font-medium text-muted-foreground">
              New
            </span>
          </button>
        ) : (
          <>
            {highlights.map((h) => {
              const firstStory = h.stories?.[0] || null
              return (
                <motion.button
                  key={h.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onOpenHighlight?.(h)}
                  onContextMenu={(e) => {
                    if (isOwn) {
                      e.preventDefault()
                      setConfirmDeleteId(h.id)
                    }
                  }}
                  className="relative flex w-[72px] shrink-0 flex-col items-center gap-1 text-center"
                  aria-label={`Open highlight ${h.title}`}
                >
                  <span
                    className="block rounded-full p-[3px]"
                    style={{ background: h.coverColor || RING_GRADIENT }}
                  >
                    <span
                      className="block overflow-hidden rounded-full border-2 border-background bg-background"
                      style={{ height: TILE_INNER, width: TILE_INNER }}
                    >
                      {firstStory ? (
                        firstStory.type === 'image' ? (
                          <img
                            src={firstStory.content}
                            alt={h.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-semibold leading-tight"
                            style={{
                              background: firstStory.bgColor || h.coverColor,
                              color: firstStory.textColor || '#ffffff',
                            }}
                          >
                            {(firstStory.content || '').slice(0, 24)}
                          </span>
                        )
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center"
                          style={{ background: h.coverColor }}
                        >
                          <Bookmark className="h-5 w-5 text-white" />
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="mt-0.5 block max-w-[64px] truncate text-[11px] font-medium text-foreground">
                    {h.title || 'Highlights'}
                  </span>
                  {h.stories && h.stories.length > 1 && (
                    <span className="absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[9px] font-bold text-muted-foreground shadow-sm">
                      {h.stories.length}
                    </span>
                  )}
                </motion.button>
              )
            })}
            {isOwn && (
              <button
                type="button"
                onClick={onCreateHighlight}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1 text-center"
                aria-label="Create a new highlight"
              >
                <span
                  className="flex items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                  style={{ height: TILE_SIZE, width: TILE_SIZE }}
                >
                  <Plus className="h-5 w-5" />
                </span>
                <span className="mt-0.5 block max-w-[64px] truncate text-[11px] font-medium text-muted-foreground">
                  New
                </span>
              </button>
            )}
          </>
        )}
        </div>
      </div>

      {/* Delete-confirmation popover (inline, simple) */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h3 className="text-base font-semibold">Delete highlight?</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              This highlight will be removed. The original stories stay in your
              story archive.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!deletingId}
                className="action-btn min-h-[44px] flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmDeleteId && handleDelete(confirmDeleteId)
                }
                disabled={!!deletingId}
                className="action-btn min-h-[44px] flex-1 !border-destructive/30 !bg-destructive/10 !text-destructive hover:!bg-destructive/20"
              >
                {deletingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
