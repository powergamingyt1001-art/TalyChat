'use client'

import * as React from 'react'
import { PremiumAvatar } from '@/components/premium-avatar'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Reply,
  Copy,
  Forward,
  Pencil,
  Trash2,
  Pin,
  Check,
  Eye,
  CornerUpLeft,
} from 'lucide-react'
import { ChatMessage } from './chat-types'
import { QUICK_REACTIONS } from './chat-types'
import { VoiceMessage } from './voice-message'
import { formatTime, messagePreview } from './chat-helpers'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: ChatMessage
  isMine: boolean
  isGroup: boolean
  currentUserId: string
  messageStyle: string // bubble | sharp | tail | none
  fontFamilyClass?: string
  fontSizePx?: number
  /** Whether this is the first message in a group from the same sender (consecutive). */
  isFirstInGroup?: boolean
  /** Whether this is the last message in a group from the same sender. */
  isLastInGroup?: boolean
  /** Whether to show the date separator above. */
  showDateSeparator?: boolean
  dateSeparatorLabel?: string
  /** Callbacks. */
  onReply: (m: ChatMessage) => void
  onReact: (m: ChatMessage, emoji: string) => void
  onEdit: (m: ChatMessage) => void
  onDelete: (m: ChatMessage) => void
  onPin: (m: ChatMessage) => void
  onForward: (m: ChatMessage) => void
  onCopy: (text: string) => void
  /** Used to find the anchor element for the action popover. */
  registerActionAnchor?: (el: HTMLElement | null, message: ChatMessage | null) => void
}

interface ActionMenuState {
  message: ChatMessage
  anchor: HTMLElement
}

// Imperative handle so the parent ChatView can render the menu in a portal.
export interface MessageBubbleHandle {
  openActionMenu: (state: ActionMenuState) => void
}

const SWIPE_THRESHOLD = 60 // px

// Bubble style class helper
function bubbleStyleClass(style: string, isMine: boolean): string {
  switch (style) {
    case 'sharp':
      return 'bubble-sharp rounded-none'
    case 'tail':
      return isMine ? 'bubble-tail-sent' : 'bubble-tail-received'
    case 'none':
      return 'bubble-none'
    default:
      return '' // default bubble shape
  }
}

export const MessageBubble = React.forwardRef<MessageBubbleHandle, MessageBubbleProps>(
  function MessageBubble(props, ref) {
    const {
      message,
      isMine,
      isGroup,
      currentUserId,
      messageStyle,
      fontFamilyClass,
      fontSizePx,
      isFirstInGroup,
      isLastInGroup,
      showDateSeparator,
      dateSeparatorLabel,
      onReply,
      onReact,
      onEdit,
      onDelete,
      onPin,
      onForward,
      onCopy,
      registerActionAnchor,
    } = props

    // Refs for touch handling
    const rootRef = React.useRef<HTMLDivElement | null>(null)
    const touchStartRef = React.useRef<{ x: number; y: number; t: number } | null>(null)
    const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const swipeDxRef = React.useRef<number>(0)
    const [swipeHint, setSwipeHint] = React.useState<number>(0)
    const lastTapRef = React.useRef<{ id: string; t: number; x: number; y: number } | null>(null)

    // Lightbox state for images
    const [lightboxOpen, setLightboxOpen] = React.useState(false)

    const isDeleted = !!message.deletedAt
    const isEdited = !!message.editedAt && !isDeleted

    // Clean up long-press timer on unmount
    React.useEffect(() => {
      return () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      }
    }, [])

    // ----- Reaction aggregation -----
    const aggregatedReactions = React.useMemo(() => {
      const map = new Map<string, { emoji: string; count: number; mine: boolean }>()
      for (const r of message.reactions || []) {
        const existing = map.get(r.emoji)
        if (existing) {
          existing.count += 1
          if (r.userId === currentUserId) existing.mine = true
        } else {
          map.set(r.emoji, { emoji: r.emoji, count: 1, mine: r.userId === currentUserId })
        }
      }
      return Array.from(map.values())
    }, [message.reactions, currentUserId])

    // ----- Read status -----
    const seen = React.useMemo(() => {
      const seenBy = (message.seenBy || '').split(',').map((s) => s.trim()).filter(Boolean)
      // "Seen" if at least one non-me user has seen it.
      return seenBy.some((id) => id !== currentUserId)
    }, [message.seenBy, currentUserId])

    // ----- Touch handlers -----
    const clearLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    const openActionMenu = () => {
      if (rootRef.current) {
        registerActionAnchor?.(rootRef.current, message)
      }
    }

    const handleTouchStart = (e: React.TouchEvent) => {
      if (isDeleted) return
      const t = e.touches[0]
      if (!t) return
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
      swipeDxRef.current = 0
      setSwipeHint(0)
      // Long-press timer (600ms)
      clearLongPress()
      longPressTimerRef.current = setTimeout(() => {
        // Long press fired — show action menu
        longPressTimerRef.current = null
        // Stop swipe hint
        setSwipeHint(0)
        openActionMenu()
      }, 600)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - touchStartRef.current.x
      const dy = t.clientY - touchStartRef.current.y
      // Cancel long-press on any significant move
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearLongPress()
      }
      // Only horizontal swipe (and only if movement is mostly horizontal)
      if (Math.abs(dx) > Math.abs(dy) * 1.4) {
        // For incoming (left-aligned) — swipe right (dx>0)
        // For outgoing (right-aligned) — swipe left (dx<0)
        const effective = isMine ? Math.min(0, dx) : Math.max(0, dx)
        swipeDxRef.current = effective
        setSwipeHint(Math.min(80, Math.abs(effective)))
      } else {
        swipeDxRef.current = 0
        setSwipeHint(0)
      }
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
      clearLongPress()
      const start = touchStartRef.current
      touchStartRef.current = null
      const dx = swipeDxRef.current
      setSwipeHint(0)
      swipeDxRef.current = 0

      if (!start) return

      // Double-tap detection (2 taps within 300ms on same message)
      const now = Date.now()
      const last = lastTapRef.current
      const moved = Math.abs(start.x - (last?.x ?? start.x)) > 30 || Math.abs(start.y - (last?.y ?? start.y)) > 30
      if (
        last &&
        last.id === message.id &&
        !moved &&
        now - last.t < 300 &&
        Math.abs(dx) < 10
      ) {
        // Double tap → ❤️ reaction
        lastTapRef.current = null
        onReact(message, '❤️')
        return
      }

      // Swipe-to-reply threshold
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        onReply(message)
        lastTapRef.current = null
        return
      }

      // Single tap — record for double-tap detection
      lastTapRef.current = { id: message.id, t: now, x: start.x, y: start.y }
    }

    const handleContextMenu = (e: React.MouseEvent) => {
      if (isDeleted) return
      e.preventDefault()
      e.stopPropagation()
      openActionMenu()
    }

    // ----- Click handlers for sticker / image -----
    const handleImageClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isDeleted && message.type === 'image' && message.mediaUrl) {
        setLightboxOpen(true)
      }
    }

    // ----- Render -----
    const bubbleBase = isMine ? 'bubble-sent' : 'bubble-received'
    const styleCls = bubbleStyleClass(messageStyle, isMine)
    const isTail = messageStyle === 'tail'

    // Avatar (only for received messages in group chats, and only at the end of a group)
    const showAvatar = isGroup && !isMine

    // Translate via swipeHint
    const swipeTransform = swipeHint > 0
      ? `translateX(${isMine ? -swipeHint : swipeHint}px)`
      : undefined

    return (
      <>
        {showDateSeparator && (
          <div className="my-3 flex items-center justify-center">
            <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
              {dateSeparatorLabel}
            </span>
          </div>
        )}

        <div
          ref={rootRef}
          className={cn(
            'flex w-full items-end gap-2',
            isMine ? 'justify-end' : 'justify-start',
            isLastInGroup ? 'mb-2' : 'mb-0.5'
          )}
          style={{ transform: swipeTransform, transition: swipeTransform ? 'transform 0.1s ease-out' : undefined }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            clearLongPress()
            touchStartRef.current = null
            setSwipeHint(0)
            swipeDxRef.current = 0
          }}
          onContextMenu={handleContextMenu}
        >
          {/* Swipe-to-reply hint */}
          {swipeHint > 0 && (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-primary/20 text-primary',
                isMine ? 'mr-1 order-2' : 'ml-1 order-1'
              )}
              aria-hidden
            >
              <Reply className="h-4 w-4" />
            </div>
          )}

          {/* Avatar */}
          {showAvatar ? (
            <PremiumAvatar
              user={{
                isPremium: (message.sender as any)?.isPremium,
                premiumTier: (message.sender as any)?.premiumTier,
                avatar: message.sender?.avatar || undefined,
                name: message.sender?.name || message.sender?.username || '?',
              }}
              size={28}
              showAura={false}
              isOnline={!!message.sender?.isOnline}
              className={cn(
                'shrink-0',
                !isLastInGroup && 'opacity-0'
              )}
            />
          ) : null}

          {/* Bubble column */}
          <div
            className={cn(
              'flex max-w-[78%] min-w-0 flex-col',
              isMine ? 'items-end order-1' : 'items-start order-2'
            )}
          >
            {/* Sender name (group only) */}
            {isGroup && !isMine && isFirstInGroup && !isDeleted && (
              <div className="mb-0.5 truncate text-xs font-medium text-primary">
                {message.sender?.name || message.sender?.username || 'Unknown'}
              </div>
            )}

            {/* Reply preview above bubble */}
            {message.replyTo && !isDeleted && (
              <div
                className={cn(
                  'mb-1 flex max-w-full items-center gap-1.5 truncate rounded-md border-l-2 border-primary/70 px-2 py-1 text-[13px]',
                  isMine
                    ? 'self-end bg-black/10 text-foreground'
                    : 'self-start bg-muted/80 text-foreground'
                )}
              >
                <CornerUpLeft className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">
                  <span className="font-bold text-primary">
                    @{message.replyTo.sender?.username || message.replyTo.sender?.name || 'user'}
                    {': '}
                  </span>
                  <span className="font-medium opacity-90">
                    {message.replyTo.deletedAt
                      ? 'Message deleted'
                      : messagePreview({
                          type: message.replyTo.type,
                          content: message.replyTo.content,
                          mediaUrl: null,
                          deletedAt: message.replyTo.deletedAt,
                        })}
                  </span>
                </span>
              </div>
            )}

            {/* Bubble */}
            <div
              className={cn(
                'rounded-2xl px-3 py-2 shadow-sm',
                bubbleBase,
                styleCls,
                // For tail style, last-in-group bubbles get the tail radius.
                // We've already applied bubble-tail-sent/received via styleCls.
                isTail && isMine && 'rounded-br-md',
                isTail && !isMine && 'rounded-bl-md'
              )}
              style={{
                fontSize: fontSizePx ? `${fontSizePx}px` : undefined,
                fontFamily: fontFamilyClass ? undefined : undefined,
              }}
            >
              {/* Apply font family class on bubble content */}
              <div className={cn('bubble-content', fontFamilyClass)}>
                {isDeleted ? (
                  <span className="italic opacity-70">🚫 This message was deleted</span>
                ) : message.type === 'voice' && message.mediaUrl ? (
                  <VoiceMessage
                    mediaUrl={message.mediaUrl}
                    voiceDuration={message.voiceDuration}
                    isMine={isMine}
                  />
                ) : message.type === 'image' && message.mediaUrl ? (
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="block min-h-[44px] min-w-[44px] cursor-zoom-in overflow-hidden rounded-md"
                    aria-label="Open image"
                  >
                    <img
                      src={message.mediaUrl}
                      alt={message.content || 'Sent image'}
                      className="max-h-[260px] max-w-full rounded-md object-cover"
                    />
                  </button>
                ) : message.type === 'sticker' ? (
                  <div className="select-none py-1 text-center text-6xl leading-none">
                    {message.stickerId || message.content || '🎨'}
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap break-words">
                    {message.content || ''}
                  </span>
                )}
              </div>
            </div>

            {/* Reactions row */}
            {aggregatedReactions.length > 0 && (
              <div
                className={cn(
                  'mt-1 flex flex-wrap gap-1',
                  isMine ? 'justify-end' : 'justify-start'
                )}
              >
                {aggregatedReactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReact(message, r.emoji)
                    }}
                    className={cn(
                      'reaction-pill min-h-[28px]',
                      r.mine && 'ring-2 ring-primary/40'
                    )}
                    aria-label={`React with ${r.emoji}`}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    <span className="font-medium">{r.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Timestamp + status line */}
            <div
              className={cn(
                'mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground',
                isMine ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <span>{formatTime(new Date(message.createdAt))}</span>
              {isEdited && <span className="italic">edited</span>}
              {isMine && !isDeleted && (
                <span aria-label={seen ? 'Seen' : 'Sent'}>
                  {seen ? <Eye className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Image lightbox */}
        {message.type === 'image' && message.mediaUrl && (
          <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogContent
              showCloseButton
              className="max-w-fit border-0 bg-black/90 p-0 sm:max-w-fit"
            >
              <DialogTitle className="sr-only">Image preview</DialogTitle>
              <img
                src={message.mediaUrl}
                alt={message.content || 'Image'}
                className="max-h-[85dvh] max-w-[92vw] object-contain"
              />
            </DialogContent>
          </Dialog>
        )}
      </>
    )
  },
)
MessageBubble.displayName = 'MessageBubble'

// ---------------------------------------------------------------------------
// Action menu (popover) shown above a message after long-press / right-click.
// Rendered at the parent level so it can portal correctly.
// ---------------------------------------------------------------------------

interface MessageActionMenuProps {
  open: boolean
  message: ChatMessage | null
  isMine: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onReply: () => void
  onCopy: () => void
  onForward: () => void
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
  onReact: (emoji: string) => void
}

export function MessageActionMenu({
  open,
  message,
  isMine,
  anchorRect,
  onClose,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onPin,
  onReact,
}: MessageActionMenuProps) {
  // Backdrop + a popover positioned above the anchor.
  if (!open || !message) return null

  // Compute position (default: above anchor, centered). Fall back to top center.
  const style: React.CSSProperties = (() => {
    if (anchorRect) {
      const top = Math.max(8, anchorRect.top - 64)
      const left = Math.min(
        Math.max(8, anchorRect.left + anchorRect.width / 2 - 150),
        typeof window !== 'undefined' ? window.innerWidth - 308 : 1000
      )
      return { top, left }
    }
    return { top: 80, left: 8 }
  })()

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        className="absolute"
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Reaction emoji row */}
        <div className="mb-1 flex items-center gap-1 rounded-full border bg-popover px-2 py-1 shadow-md">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji)
                onClose()
              }}
              aria-label={`React with ${emoji}`}
              className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Action items */}
        <div className="flex w-[300px] max-w-[calc(100vw-16px)] flex-col gap-0.5 rounded-md border bg-popover p-1 shadow-md">
          <ActionMenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { onReply(); onClose() }} />
          <ActionMenuItem icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => { onCopy(); onClose() }} />
          <ActionMenuItem icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { onForward(); onClose() }} />
          {isMine && message.type === 'text' && !message.deletedAt && (
            <ActionMenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { onEdit(); onClose() }} />
          )}
          {isMine && !message.deletedAt && (
            <ActionMenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete"
              destructive
              onClick={() => { onDelete(); onClose() }}
            />
          )}
          <ActionMenuItem icon={<Pin className="h-4 w-4" />} label={message.pinnedAt ? 'Unpin' : 'Pin'} onClick={() => { onPin(); onClose() }} />
        </div>
      </div>
    </div>
  )
}

function ActionMenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[40px] w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent',
        destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export type { ActionMenuState }
