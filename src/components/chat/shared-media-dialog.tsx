'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Image as ImageIcon,
  Mic,
  File as FileIcon,
  Play,
  Pause,
  Download,
  Loader2,
  X,
} from 'lucide-react'
import { format as formatDate } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { PremiumAvatar } from '@/components/premium-avatar'
import { formatDuration } from './chat-helpers'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface MediaSender {
  id: string
  username?: string
  name?: string
  avatar?: string | null
  isPremium?: boolean
  premiumTier?: string | null
  isOnline?: boolean
}

interface MediaItem {
  id: string
  conversationId?: string
  senderId?: string
  sender?: MediaSender | null
  content: string
  type: string
  mediaUrl?: string | null
  voiceDuration?: number | null
  stickerId?: string | null
  createdAt: string
}

interface MediaResponse {
  images: MediaItem[]
  voice: MediaItem[]
  documents: MediaItem[]
}

interface SharedMediaDialogProps {
  open: boolean
  onClose: () => void
  conversationId: string
}

// ============================================================
// Helpers
// ============================================================

function senderName(s?: MediaSender | null): string {
  if (!s) return 'Unknown'
  return s.name || s.username || 'Unknown'
}

function senderAvatar(s?: MediaSender | null): string | undefined {
  return s?.avatar || undefined
}

// ============================================================
// Lightbox — full-screen image viewer (mobile-first)
// ============================================================

function ImageLightbox({
  item,
  onClose,
}: {
  item: MediaItem | null
  onClose: () => void
}) {
  // Lock body scroll when lightbox is open
  React.useEffect(() => {
    if (!item) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [item])

  if (!item) return null

  const name = senderName(item.sender)
  const dateLabel = item.createdAt
    ? formatDate(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')
    : ''

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className="max-h-[100dvh] max-w-[100vw] border-0 bg-black/95 p-0 sm:max-w-fit"
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Full-screen view of a shared image. Press Escape or tap the close
          button to return to the gallery.
        </DialogDescription>

        <div className="flex h-[100dvh] w-[100vw] flex-col items-center justify-center sm:h-auto sm:w-auto sm:p-2">
          {item.mediaUrl ? (
            <img
              src={item.mediaUrl}
              alt={item.content || 'Shared image'}
              className="max-h-[80dvh] max-w-[94vw] object-contain"
            />
          ) : (
            <div className="flex h-64 w-64 items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}

          {/* Caption row — sender + date + download */}
          <div className="mt-3 flex w-full max-w-3xl items-center gap-3 px-4 pb-2 sm:px-0">
            <PremiumAvatar
              user={{
                isPremium: item.sender?.isPremium,
                premiumTier: item.sender?.premiumTier,
                avatar: senderAvatar(item.sender),
                name,
              }}
              size={32}
              showAura={false}
              isOnline={!!item.sender?.isOnline}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                {name}
              </div>
              {dateLabel && (
                <div className="truncate text-[11px] text-white/70">
                  {dateLabel}
                </div>
              )}
            </div>
            {item.mediaUrl && (
              <a
                href={item.mediaUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="Download image"
              >
                <Download className="h-5 w-5" />
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Voice row — inline play/pause with progress
// ============================================================

function VoiceRow({ item }: { item: MediaItem }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [current, setCurrent] = React.useState(0)
  const [duration, setDuration] = React.useState<number>(item.voiceDuration || 0)

  // Stop on unmount
  React.useEffect(() => {
    const audio = audioRef.current
    return () => {
      try {
        audio?.pause()
      } catch {}
    }
  }, [])

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    try {
      if (progress >= 1) {
        audio.currentTime = 0
        setProgress(0)
        setCurrent(0)
      }
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const name = senderName(item.sender)
  const dateLabel = item.createdAt
    ? formatDate(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')
    : ''

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
      <audio
        ref={audioRef}
        src={item.mediaUrl || ''}
        preload="metadata"
        onTimeUpdate={() => {
          const a = audioRef.current
          if (!a) return
          const d = a.duration && isFinite(a.duration) ? a.duration : duration
          setCurrent(a.currentTime)
          if (d > 0) setProgress(Math.min(1, a.currentTime / d))
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a && a.duration && isFinite(a.duration)) {
            setDuration(a.duration)
          }
        }}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
          setCurrent(0)
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play voice message'}
        className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25"
      >
        {playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="shrink-0 text-[10px] font-light text-muted-foreground">
            {dateLabel}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {playing ? formatDuration(current) : formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Empty state
// ============================================================

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
        <Icon className="h-6 w-6 text-muted-foreground/70" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

// ============================================================
// Main dialog
// ============================================================

export function SharedMediaDialog({
  open,
  onClose,
  conversationId,
}: SharedMediaDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<MediaResponse>({
    images: [],
    voice: [],
    documents: [],
  })
  const [activeTab, setActiveTab] = React.useState<string>('images')
  const [lightboxItem, setLightboxItem] = React.useState<MediaItem | null>(null)

  // Fetch media whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setData({ images: [], voice: [], documents: [] })
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await apiFetch(
          `/api/conversations/${conversationId}/media?type=all`,
        )
        if (cancelled) return
        const next: MediaResponse = {
          images: Array.isArray(res?.images) ? res.images : [],
          voice: Array.isArray(res?.voice) ? res.voice : [],
          documents: Array.isArray(res?.documents) ? res.documents : [],
        }
        setData(next)
        // Auto-pick the first non-empty tab.
        if (next.images.length > 0) setActiveTab('images')
        else if (next.voice.length > 0) setActiveTab('voice')
        else if (next.documents.length > 0) setActiveTab('documents')
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: e?.message || 'Failed to load shared media',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, conversationId, toast])

  const totalImages = data.images.length
  const totalVoice = data.voice.length
  const totalDocs = data.documents.length

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-primary" />
              Shared Media
            </DialogTitle>
            <DialogDescription className="sr-only">
              Browse images, voice messages, and files shared in this
              conversation. Switch tabs to view each media type.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-[70dvh] flex-col sm:h-[60dvh]"
          >
            <div className="px-3 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="images" className="flex-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Images
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
                    {totalImages}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="voice" className="flex-1">
                  <Mic className="h-3.5 w-3.5" />
                  Voice
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
                    {totalVoice}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="files" className="flex-1">
                  <FileIcon className="h-3.5 w-3.5" />
                  Files
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums">
                    {totalDocs}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* IMAGES */}
            <TabsContent
              value="images"
              className="mt-0 flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : totalImages === 0 ? (
                    <EmptyState icon={ImageIcon} label="No images yet" />
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {data.images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setLightboxItem(img)}
                          className="group relative aspect-square overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Open image"
                        >
                          {img.mediaUrl ? (
                            <img
                              src={img.mediaUrl}
                              alt={img.content || 'Image'}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                          {/* Overlay: sender + date — show on hover (desktop)
                              and always-visible small badge (mobile). */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="truncate text-[10px] font-medium text-white">
                              {senderName(img.sender)}
                            </div>
                            {img.createdAt && (
                              <div className="truncate text-[9px] text-white/80">
                                {formatDate(
                                  new Date(img.createdAt),
                                  'dd MMM yyyy',
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* VOICE */}
            <TabsContent value="voice" className="mt-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : totalVoice === 0 ? (
                    <EmptyState icon={Mic} label="No voice messages" />
                  ) : (
                    data.voice.map((v) => <VoiceRow key={v.id} item={v} />)
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* FILES (stickers + other) */}
            <TabsContent value="files" className="mt-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : totalDocs === 0 ? (
                    <EmptyState icon={FileIcon} label="No files" />
                  ) : (
                    <ul className="space-y-2">
                      {data.documents.map((f) => {
                        const name = senderName(f.sender)
                        const dateLabel = f.createdAt
                          ? formatDate(
                              new Date(f.createdAt),
                              'dd MMM yyyy, HH:mm',
                            )
                          : ''
                        const isSticker = f.type === 'sticker'
                        return (
                          <li
                            key={f.id}
                            className={cn(
                              'flex items-center gap-3 rounded-lg border bg-card p-2.5',
                            )}
                          >
                            <div className="flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {isSticker ? (
                                <span className="text-2xl leading-none">
                                  {f.stickerId || f.content || '🎨'}
                                </span>
                              ) : (
                                <FileIcon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">
                                  {isSticker
                                    ? 'Sticker'
                                    : f.content || f.type || 'File'}
                                </span>
                                <span className="shrink-0 text-[10px] font-light text-muted-foreground">
                                  {dateLabel}
                                </span>
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                from {name}
                              </div>
                            </div>
                            {f.mediaUrl && !isSticker && (
                              <a
                                href={f.mediaUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted text-foreground hover:bg-accent"
                                aria-label="Download file"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Footer — close button (touch-friendly) */}
          <div className="border-t p-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="min-h-[44px] w-full"
            >
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox — separate top-level Dialog so it can go full-screen */}
      <ImageLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </>
  )
}
