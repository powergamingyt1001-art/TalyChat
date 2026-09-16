'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pause,
  Play,
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

const STORY_DURATION_MS = 5000 // 5s per story

interface StoryViewerProps {
  open: boolean
  onClose: () => void
  userId: string // author whose stories we are viewing
  initialIndex?: number
  allStories: StoriesGroup[]
  onStoryDeleted?: () => void
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
}: StoryViewerProps) {
  const me = useAuth((s) => s.user)
  const { toast } = useToast()

  // Find the active group from allStories
  const activeGroup: StoriesGroup | undefined = React.useMemo(
    () => allStories.find((g) => g.user.id === userId),
    [allStories, userId]
  )

  const isOwn = !!me && activeGroup?.user.id === me.id
  const stories = activeGroup?.stories || []

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

  // Progress timer
  React.useEffect(() => {
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
  }, [open, currentStory, paused, index, stories.length, onClose])

  // Mark story as viewed when it becomes active (skip own stories)
  React.useEffect(() => {
    if (!open || !currentStory || isOwn) return
    apiFetch(`/api/stories/${currentStory.id}/view`, { method: 'POST' }).catch(
      () => {}
    )
  }, [open, currentStory, isOwn])

  // Fetch viewer list when opening own story
  const loadViewers = React.useCallback(async () => {
    if (!isOwn) return
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
  }, [isOwn])

  React.useEffect(() => {
    if (open && isOwn && !viewerList) {
      loadViewers()
    }
  }, [open, isOwn, viewerList, loadViewers])

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
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goNext, goPrev, onClose])

  // Reply handler — creates a private conversation + message to the story owner
  const handleSendReply = async () => {
    if (!reply.trim() || !activeGroup) return
    setSending(true)
    try {
      // Find or create private conversation with story owner
      const convRes: any = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'private',
          participantId: activeGroup.user.id,
        }),
      })
      const conversationId = convRes?.conversation?.id
      if (!conversationId) throw new Error('Could not open conversation')
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          type: 'text',
          content: reply.trim(),
        }),
      })
      toast({ title: `Reply sent to ${activeGroup.user.name}` })
      setReply('')
      onClose()
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
        <DialogTitle className="sr-only">Story Viewer</DialogTitle>
        <DialogDescription className="sr-only">View stories from your contacts</DialogDescription>
        {!activeGroup || stories.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <StoryStage
            story={currentStory}
            author={activeGroup.user}
            stories={stories}
            index={index}
            progress={progress}
            paused={paused}
            isOwn={isOwn}
            viewersCount={
              isOwn ? currentStoryViewers.length : currentStory?.viewsCount || 0
            }
            reply={reply}
            sending={sending}
            showViewers={showViewers}
            viewersLoading={viewersLoading}
            viewerList={showViewers ? currentStoryViewers : []}
            deleting={deleting}
            onTogglePause={() => setPaused((p) => !p)}
            onPrev={goPrev}
            onNext={goNext}
            onClose={onClose}
            onReplyChange={setReply}
            onSendReply={handleSendReply}
            onToggleViewers={() => setShowViewers((v) => !v)}
            onDelete={handleDelete}
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
  viewersCount: number
  reply: string
  sending: boolean
  showViewers: boolean
  viewersLoading: boolean
  viewerList: any[]
  deleting: boolean
  onTogglePause: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onReplyChange: (s: string) => void
  onSendReply: () => void
  onToggleViewers: () => void
  onDelete: () => void
}

function StoryStage({
  story,
  author,
  stories,
  index,
  progress,
  paused,
  isOwn,
  viewersCount,
  reply,
  sending,
  showViewers,
  viewersLoading,
  viewerList,
  deleting,
  onTogglePause,
  onPrev,
  onNext,
  onClose,
  onReplyChange,
  onSendReply,
  onToggleViewers,
  onDelete,
}: StoryStageProps) {
  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      {/* Top overlay: progress bars + author + close */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-3 pb-8 pt-3">
        {/* Progress bars */}
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

        {/* Author row */}
        <div className="mt-3 flex items-center gap-3">
          <PremiumAvatar
            user={{
              isPremium: author.isPremium,
              premiumTier: author.premiumTier,
              avatar: author.avatar || undefined,
              name: author.name || 'U',
            }}
            size={36}
            showAura
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {author.name}
            </p>
            <p className="text-[11px] text-white/60">
              {timeAgo(story?.createdAt)} · {story?.type === 'image' ? 'Photo' : 'Status'}
            </p>
          </div>

          {/* Pause/play */}
          <button
            onClick={onTogglePause}
            aria-label={paused ? 'Resume' : 'Pause'}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          {/* Viewers count (own story) — taps to toggle list */}
          {isOwn && (
            <button
              onClick={onToggleViewers}
              aria-label="Viewers"
              className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-white transition-colors hover:bg-white/20"
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs font-semibold">{viewersCount}</span>
            </button>
          )}

          {/* Delete own story */}
          {isOwn && (
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

      {/* Tap zones — left=prev, right=next, center=toggle pause */}
      <button
        onClick={onPrev}
        aria-label="Previous story"
        className="absolute left-0 top-0 z-10 h-full w-1/3 cursor-default"
      />
      <button
        onClick={onTogglePause}
        aria-label={paused ? 'Resume' : 'Pause'}
        className="absolute left-1/3 top-0 z-10 h-full w-1/3 cursor-default"
      />
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

      {/* Bottom: reply input (others) OR viewer list (own) */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {isOwn ? (
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
    </div>
  )
}

function currentStoryViewersListLabel(list: any[], fallback: number): string {
  if (list.length > 0) return String(list.length)
  return String(fallback)
}
