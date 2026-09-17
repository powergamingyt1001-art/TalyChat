'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PremiumAvatar } from '@/components/premium-avatar'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import type { StoriesGroup, StoryAuthor, StoryItem } from './stories-row'

// ============================================================
// StoryViewerDialog
// ============================================================
// Full-screen immersive story viewer. Plays through a single author's
// batch of stories with auto-advance + tap navigation. Marks each
// story as viewed via POST /api/stories/[id]/view. For the author's
// OWN batch, shows the viewer list (eye icon + count) instead of the
// reply input.
//
// V7 — supports a `mode` prop. 'highlight' mode (for viewing Story
// Highlights saved on a profile) disables auto-advance and shows the
// highlight title at the top instead of "Xm ago · Status".
// Also adds a "Save to Highlights" button on the author's own stories.

const STORY_DURATION_MS = 5000 // 5s per story

interface StoryViewerProps {
  open: boolean
  onClose: () => void
  userId: string // author whose stories we are viewing
  initialIndex?: number
  allStories: StoriesGroup[]
  onStoryDeleted?: () => void
  /** V7 — viewer mode. */
  mode?: 'story' | 'highlight'
  /** V7 — highlight title (shown in header when mode === 'highlight'). */
  highlightTitle?: string
  /** V7 — highlight cover color (used for the empty-state / ring). */
  highlightCoverColor?: string
  /** V7 — explicit stories list (used in highlight mode). */
  highlightStories?: StoryItem[]
  /** V7 — fired when a highlight is created/saved so the parent can refetch. */
  onHighlightsChanged?: () => void
  /** V11 — fired after a story reply is sent so the parent can navigate
   *  to the conversation (and optionally close the viewer). */
  onOpenChat?: (conversation: {
    id: string
    type: 'private' | 'group'
    name: string
    avatar?: string | null
  }) => void
}

function timeAgo(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function StoryViewerDialog({
  open,
  onClose,
  userId,
  initialIndex = 0,
  allStories,
  onStoryDeleted,
  mode = 'story',
  highlightTitle,
  highlightCoverColor,
  highlightStories,
  onHighlightsChanged,
  onOpenChat,
}: StoryViewerProps) {
  const me = useAuth((s) => s.user)
  const { toast } = useToast()

  // Find the active group from allStories (used in story mode)
  const activeGroup: StoriesGroup | undefined = React.useMemo(
    () => allStories.find((g) => g.user.id === userId),
    [allStories, userId]
  )

  const isOwn = !!me && activeGroup?.user.id === me.id
  const stories = mode === 'highlight'
    ? (highlightStories || [])
    : (activeGroup?.stories || [])

  const [index, setIndex] = React.useState(initialIndex)
  const [paused, setPaused] = React.useState(false)
  const [progress, setProgress] = React.useState(0) // 0..1
  const [reply, setReply] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [showViewers, setShowViewers] = React.useState(false)
  const [viewerList, setViewerList] = React.useState<any[] | null>(null)
  const [viewersLoading, setViewersLoading] = React.useState(false)
  const [totalViewers, setTotalViewers] = React.useState(0)
  const [deleting, setDeleting] = React.useState(false)

  // V7 — save-to-highlights dialog state
  const [saveToHighlightsOpen, setSaveToHighlightsOpen] = React.useState(false)

  // Reset when target userId changes or dialog reopens
  React.useEffect(() => {
    if (open) {
      setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, stories.length - 1))))
      setPaused(false)
      setProgress(0)
      setReply('')
      setShowViewers(false)
      setViewerList(null)
    }
  }, [open, userId, initialIndex, stories.length])

  // Clamp index when stories change (e.g. after delete)
  React.useEffect(() => {
    if (index >= stories.length) {
      if (stories.length === 0) {
        // No stories left in this batch — close
        onClose()
      } else {
        setIndex(stories.length - 1)
      }
    }
  }, [stories.length, index, onClose])

  const currentStory = stories[index]

  // Progress timer (disabled in highlight mode — manual navigation only)
  React.useEffect(() => {
    if (mode === 'highlight') return
    if (!open || !currentStory || paused) return
    setProgress(0)
    const startedAt = Date.now()
    let raf: number
    const tick = () => {
      const elapsed = Date.now() - startedAt
      const p = Math.min(1, elapsed / STORY_DURATION_MS)
      setProgress(p)
      if (p >= 1) {
        // advance
        if (index < stories.length - 1) {
          setIndex((i) => i + 1)
        } else {
          // last story in this batch — close after a brief beat
          onClose()
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, currentStory, paused, index, stories.length, onClose, mode])

  // Mark story as viewed when it becomes active (skip own stories + highlight mode)
  React.useEffect(() => {
    if (!open || !currentStory || isOwn) return
    if (mode === 'highlight') return
    apiFetch(`/api/stories/${currentStory.id}/view`, { method: 'POST' }).catch(
      () => {}
    )
  }, [open, currentStory, isOwn, mode])

  // Fetch viewer list when opening own story (story mode only)
  const loadViewers = React.useCallback(async () => {
    if (!isOwn || mode === 'highlight') return
    setViewersLoading(true)
    try {
      const res: any = await apiFetch('/api/stories/me')
      setTotalViewers(Number(res?.totalViewers) || 0)
      const allViewers = (res?.stories || []).flatMap((s: any) =>
        (s.viewers || []).map((v: any) => ({ ...v, storyId: s.id }))
      )
      // De-duplicate by userId, keep latest viewedAt
      const byUid = new Map<string, any>()
      for (const v of allViewers) {
        const existing = byUid.get(v.userId)
        if (!existing || new Date(v.viewedAt) > new Date(existing.viewedAt)) {
          byUid.set(v.userId, v)
        }
      }
      setViewerList(Array.from(byUid.values()))
    } catch {
      setViewerList([])
    } finally {
      setViewersLoading(false)
    }
  }, [isOwn, mode])

  React.useEffect(() => {
    if (open && isOwn && mode === 'story' && !viewerList) {
      loadViewers()
    }
  }, [open, isOwn, viewerList, loadViewers, mode])

  // Per-story viewers count (current story)
  const currentStoryViewers = React.useMemo(() => {
    if (!viewerList || !currentStory) return []
    return viewerList.filter((v) => v.storyId === currentStory.id)
  }, [viewerList, currentStory])

  const goNext = React.useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }, [index, stories.length, onClose])

  const goPrev = React.useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1)
      setProgress(0)
    }
  }, [index])

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === ' ' && mode !== 'highlight') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goNext, goPrev, onClose, mode])

  // Reply handler — V11 — uses the dedicated /api/stories/[id]/reply
  // endpoint which creates/finds a private conversation with the story
  // author, sends a prefixed message ("📷 Reply to your story …"), and
  // returns { conversationId, messageId } so we can navigate to the chat.
  const handleSendReply = async () => {
    if (!reply.trim() || !activeGroup || !currentStory) return
    setSending(true)
    try {
      const res: any = await apiFetch(
        `/api/stories/${currentStory.id}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ message: reply.trim() }),
        }
      )
      const conversationId = res?.conversationId
      toast({ title: 'Reply sent!' })
      setReply('')
      // Close the viewer first so the chat navigation is visible.
      onClose()
      // If the parent passed an onOpenChat callback, navigate to the chat
      // where the reply was sent so the user can continue the conversation.
      if (onOpenChat && conversationId) {
        onOpenChat({
          id: conversationId,
          type: 'private',
          name: activeGroup.user.name || 'Chat',
          avatar: activeGroup.user.avatar || null,
        })
      }
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to send reply',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!currentStory || !isOwn) return
    setDeleting(true)
    try {
      await apiFetch(`/api/stories/${currentStory.id}`, { method: 'DELETE' })
      toast({ title: 'Story deleted' })
      onStoryDeleted?.()
      if (stories.length <= 1) {
        onClose()
      } else {
        setIndex(Math.max(0, index - 1))
        setViewerList(null) // refresh viewer list
      }
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to delete story',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="fixed inset-0 top-0 left-0 z-50 grid h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-none bg-black p-0 shadow-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
      >
        <DialogTitle className="sr-only">
          {mode === 'highlight' ? 'Highlight Viewer' : 'Story Viewer'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'highlight'
            ? `Viewing highlight: ${highlightTitle || 'Highlights'}`
            : 'View stories from your contacts'}
        </DialogDescription>
        {!activeGroup && mode === 'story' ? (
          <div className="flex h-full w-full items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : stories.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">No stories in this highlight.</p>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-2 min-h-[44px] border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Close
            </Button>
          </div>
        ) : (
          <StoryStage
            story={currentStory}
            author={
              activeGroup?.user || {
                id: userId,
                name: highlightTitle || 'Highlights',
                username: undefined,
                avatar: null,
                isPremium: false,
                premiumTier: null,
              }
            }
            stories={stories}
            index={index}
            progress={progress}
            paused={paused}
            isOwn={isOwn}
            mode={mode}
            highlightTitle={highlightTitle}
            highlightCoverColor={highlightCoverColor}
            viewersCount={
              isOwn ? currentStoryViewers.length : currentStory?.viewsCount || 0
            }
            reply={reply}
            sending={sending}
            showViewers={showViewers}
            viewersLoading={viewersLoading}
            viewerList={showViewers ? currentStoryViewers : []}
            deleting={deleting}
            saveToHighlightsOpen={saveToHighlightsOpen}
            onToggleSaveToHighlights={() =>
              setSaveToHighlightsOpen((v) => !v)
            }
            onTogglePause={() => setPaused((p) => !p)}
            onPrev={goPrev}
            onNext={goNext}
            onClose={onClose}
            onReplyChange={setReply}
            onSendReply={handleSendReply}
            onToggleViewers={() => setShowViewers((v) => !v)}
            onDelete={handleDelete}
            onHighlightsChanged={() => {
              onHighlightsChanged?.()
              setSaveToHighlightsOpen(false)
            }}
            currentStoryId={currentStory?.id}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// StoryStage — the inner layout
// ============================================================

interface StoryStageProps {
  story?: StoryItem
  author: StoryAuthor
  stories: StoryItem[]
  index: number
  progress: number
  paused: boolean
  isOwn: boolean
  mode: 'story' | 'highlight'
  highlightTitle?: string
  highlightCoverColor?: string
  viewersCount: number
  reply: string
  sending: boolean
  showViewers: boolean
  viewersLoading: boolean
  viewerList: any[]
  deleting: boolean
  saveToHighlightsOpen: boolean
  onToggleSaveToHighlights: () => void
  onTogglePause: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onReplyChange: (s: string) => void
  onSendReply: () => void
  onToggleViewers: () => void
  onDelete: () => void
  onHighlightsChanged: () => void
  currentStoryId?: string
}

function StoryStage({
  story,
  author,
  stories,
  index,
  progress,
  paused,
  isOwn,
  mode,
  highlightTitle,
  viewersCount,
  reply,
  sending,
  showViewers,
  viewersLoading,
  viewerList,
  deleting,
  saveToHighlightsOpen,
  onToggleSaveToHighlights,
  onTogglePause,
  onPrev,
  onNext,
  onClose,
  onReplyChange,
  onSendReply,
  onToggleViewers,
  onDelete,
  onHighlightsChanged,
  currentStoryId,
}: StoryStageProps) {
  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      {/* Top overlay: progress bars + author + close */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-3 pb-8 pt-3">
        {/* Progress bars — hidden in highlight mode (manual navigation) */}
        {mode !== 'highlight' && (
          <div className="flex w-full gap-1">
            {stories.map((s, i) => (
              <div
                key={s.id}
                className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white"
                  style={{
                    width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                    transition: i === index ? 'none' : 'width 0.2s ease',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Author row */}
        <div className="mt-3 flex items-center gap-3">
          {mode === 'story' ? (
            <PremiumAvatar
              user={{
                isPremium: author.isPremium,
                premiumTier: author.premiumTier,
                avatar: author.avatar || undefined,
                name: author.name || 'U',
                id: author.id || undefined,
                username: author.username || undefined,
              }}
              size={36}
              showAura
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Bookmark className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {mode === 'highlight'
                ? (highlightTitle || 'Highlights')
                : author.name}
            </p>
            <p className="text-[11px] text-white/60">
              {mode === 'highlight'
                ? `Highlight · ${index + 1} of ${stories.length}`
                : `${timeAgo(story?.createdAt)} · ${story?.type === 'image' ? 'Photo' : 'Status'}`}
            </p>
          </div>

          {/* Pause/play — hidden in highlight mode (no auto-advance) */}
          {mode !== 'highlight' && (
            <button
              onClick={onTogglePause}
              aria-label={paused ? 'Resume' : 'Pause'}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}

          {/* V7 — Save to Highlights button (own stories, story mode only) */}
          {isOwn && mode === 'story' && currentStoryId && (
            <button
              onClick={onToggleSaveToHighlights}
              aria-label="Save to Highlights"
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-white transition-colors hover:bg-white/20"
            >
              <Bookmark className="h-4 w-4" />
              <span className="text-xs font-semibold hidden sm:inline">
                Save
              </span>
            </button>
          )}

          {/* Viewers count (own story) — taps to toggle list */}
          {isOwn && mode === 'story' && (
            <button
              onClick={onToggleViewers}
              aria-label="Viewers"
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-white transition-colors hover:bg-white/20"
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs font-semibold">{viewersCount}</span>
            </button>
          )}

          {/* Delete own story — only in story mode */}
          {isOwn && mode === 'story' && (
            <button
              onClick={onDelete}
              disabled={deleting}
              aria-label="Delete story"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20 text-red-300 transition-colors hover:bg-red-500/40 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tap zones — left=prev, right=next, center=toggle pause (story mode) / no-op (highlight mode) */}
      <button
        onClick={onPrev}
        aria-label="Previous story"
        className="absolute left-0 top-0 z-10 h-full w-1/3 cursor-default"
      />
      {mode === 'highlight' ? (
        <button
          aria-label="Center"
          className="absolute left-1/3 top-0 z-10 h-full w-1/3 cursor-default"
        />
      ) : (
        <button
          onClick={onTogglePause}
          aria-label={paused ? 'Resume' : 'Pause'}
          className="absolute left-1/3 top-0 z-10 h-full w-1/3 cursor-default"
        />
      )}
      <button
        onClick={onNext}
        aria-label="Next story"
        className="absolute right-0 top-0 z-10 h-full w-1/3 cursor-default"
      />

      {/* Side chevron buttons (visible on hover / always for touch friendliness) */}
      {index > 0 && (
        <button
          onClick={onPrev}
          aria-label="Previous"
          className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {index < stories.length - 1 && (
        <button
          onClick={onNext}
          aria-label="Next"
          className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Story content */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {story?.type === 'image' ? (
            <motion.img
              key={story.id}
              src={story.content}
              alt={story.caption || 'Story image'}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          ) : story ? (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex h-full w-full items-center justify-center p-8"
              style={{ background: story.bgColor || '#10b981' }}
            >
              <p
                className="whitespace-pre-wrap text-center text-2xl font-semibold leading-snug sm:text-3xl"
                style={{ color: story.textColor || '#ffffff' }}
              >
                {story.content}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Caption (image story) */}
      {story?.type === 'image' && story.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 px-6 pb-2">
          <div className="mx-auto max-w-md rounded-xl bg-black/40 px-4 py-2 backdrop-blur">
            <p className="text-center text-sm text-white">{story.caption}</p>
          </div>
        </div>
      )}

      {/* Bottom: reply input (others, story mode) OR viewer list (own, story mode) OR empty (highlight mode) */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {mode === 'highlight' ? (
          <div className="mx-auto max-w-md">
            <p className="text-center text-xs text-white/50">
              {highlightTitle || 'Highlights'} · {stories.length}{' '}
              {stories.length === 1 ? 'story' : 'stories'}
            </p>
          </div>
        ) : isOwn ? (
          <AnimatePresence mode="wait">
            {showViewers ? (
              <motion.div
                key="viewers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mx-auto max-w-md rounded-2xl bg-black/80 p-2 backdrop-blur"
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <span className="text-sm font-semibold text-white">
                    Viewers ({currentStoryViewersListLabel(viewerList, viewersCount)})
                  </span>
                  <button
                    onClick={onToggleViewers}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <ScrollArea className="max-h-64">
                  {viewersLoading ? (
                    <div className="flex items-center justify-center py-6 text-white/60">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : viewerList.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-white/60">
                      No viewers yet.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {viewerList.map((v) => (
                        <li
                          key={v.userId}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                        >
                          <Avatar className="h-7 w-7">
                            {v.avatar && <AvatarImage src={v.avatar} />}
                            <AvatarFallback className="bg-white/10 text-white">
                              {(v.name || '?')[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate text-sm text-white">
                            {v.name}
                          </span>
                          <span className="text-[10px] text-white/40">
                            {timeAgo(v.viewedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </motion.div>
            ) : (
              <motion.div
                key="caption"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto max-w-md"
              >
                <p className="text-center text-xs text-white/50">
                  Your story · {viewersCount} viewer{viewersCount === 1 ? '' : 's'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="mx-auto flex max-w-md items-center gap-2">
            <Input
              value={reply}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder={`Reply to ${author.name?.split(' ')[0] || 'story'}…`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSendReply()
                }
              }}
              className="h-11 flex-1 rounded-full border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-0"
            />
            <Button
              size="icon"
              onClick={onSendReply}
              disabled={!reply.trim() || sending}
              className="h-11 w-11 rounded-full bg-primary"
              aria-label="Send reply"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* V7 — Save-to-Highlights overlay (own stories) */}
      {isOwn && saveToHighlightsOpen && currentStoryId && (
        <SaveToHighlightsDialog
          storyId={currentStoryId}
          onClose={onToggleSaveToHighlights}
          onSaved={() => {
            onHighlightsChanged()
          }}
        />
      )}
    </div>
  )
}

function currentStoryViewersListLabel(list: any[], fallback: number): string {
  if (list.length > 0) return String(list.length)
  return String(fallback)
}

// ============================================================
// SaveToHighlightsDialog — inline overlay (own stories only)
// ============================================================

interface SaveToHighlightsProps {
  storyId: string
  onClose: () => void
  onSaved?: () => void
}

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

function SaveToHighlightsDialog({
  storyId,
  onClose,
  onSaved,
}: SaveToHighlightsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [existing, setExisting] = React.useState<any[]>([])
  const [showCreate, setShowCreate] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')
  const [newColor, setNewColor] = React.useState(COVER_COLOR_PRESETS[0])
  const [submitting, setSubmitting] = React.useState(false)
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set())

  // Fetch existing highlights
  const loadHighlights = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/highlights/me')
      const list: any[] = Array.isArray(res?.highlights) ? res.highlights : []
      setExisting(list)
    } catch {
      setExisting([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadHighlights()
  }, [loadHighlights])

  const handleAddToExisting = async (highlightId: string) => {
    setAddingId(highlightId)
    try {
      await apiFetch(`/api/highlights/${highlightId}/add`, {
        method: 'POST',
        body: JSON.stringify({ storyId }),
      })
      setAddedIds((s) => new Set(s).add(highlightId))
      toast({ title: 'Added to highlight' })
      onSaved?.()
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to add to highlight',
        variant: 'destructive',
      })
    } finally {
      setAddingId(null)
    }
  }

  const handleCreateNew = async () => {
    if (!newTitle.trim()) {
      toast({ title: 'Please enter a title', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/highlights', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle.trim(),
          coverColor: newColor,
          storyIds: [storyId],
        }),
      })
      toast({ title: 'Highlight created' })
      onSaved?.()
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
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 text-foreground shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Save to Highlights</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : showCreate ? (
          // Create-new form
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Highlight title
              </label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Travel, Memories…"
                className="min-h-[44px]"
                maxLength={50}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !submitting) handleCreateNew()
                }}
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
                    onClick={() => setNewColor(c)}
                    aria-label={`Cover color ${c}`}
                    aria-pressed={newColor === c}
                    className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-full"
                    style={{ backgroundColor: c }}
                  >
                    {newColor === c && (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
                disabled={submitting}
                className="min-h-[44px] flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreateNew}
                disabled={submitting || !newTitle.trim()}
                className="btn-brand min-h-[44px] flex-1"
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Bookmark className="mr-1 h-4 w-4" />
                )}
                Create
              </Button>
            </div>
          </div>
        ) : (
          // Pick existing or create new
          <div className="space-y-2">
            {existing.length === 0 ? (
              <p className="rounded-lg bg-accent/30 px-3 py-3 text-sm text-muted-foreground">
                You don&apos;t have any highlights yet. Create a new one to save
                this story.
              </p>
            ) : (
              <ScrollArea className="max-h-64">
                <ul className="space-y-1">
                  {existing.map((h) => {
                    const added = addedIds.has(h.id)
                    return (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => handleAddToExisting(h.id)}
                          disabled={addingId === h.id || added}
                          className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent disabled:opacity-60"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                            style={{ backgroundColor: h.coverColor }}
                          >
                            <Bookmark className="h-4 w-4 text-white" />
                          </span>
                          <span className="flex-1 truncate text-sm font-medium">
                            {h.title}
                          </span>
                          {added ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : addingId === h.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-2 flex min-h-[52px] w-full items-center gap-3 rounded-lg border-2 border-dashed border-border px-2 py-2 text-left hover:border-primary hover:bg-accent/30"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                <Plus className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium">
                Create new highlight
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

