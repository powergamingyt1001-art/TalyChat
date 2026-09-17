'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { PremiumAvatar } from '@/components/premium-avatar'
import { LocationMessage } from './location-message'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  CheckCheck,
  CornerUpLeft,
  Clock,
  SmilePlus,
} from 'lucide-react'
import { ChatMessage, ChatMember } from './chat-types'
import { QUICK_REACTIONS, EXTENDED_REACTIONS } from './chat-types'
import { VoiceMessage } from './voice-message'
import { SeenByPopover } from './seen-by-popover'
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
  /** V13 — per-conversation sent bubble color override (hex). */
  sentBubbleColor?: string | null
  /** V13 — per-conversation received bubble color override (hex). */
  receivedBubbleColor?: string | null
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
  /** Conversation members — used to populate the "Seen by" popover (sent messages only). */
  members?: ChatMember[] | null
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

// V13 — Determine readable text color (white/black) for a given hex bubble background.
// Used when applying per-conversation sent/received bubble color overrides.
function readableTextOn(hex: string | null): string {
  if (!hex) return '#ffffff'
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return '#ffffff'
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  // YIQ contrast formula — light backgrounds get dark text, dark backgrounds get white.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 140 ? '#111111' : '#ffffff'
}

// ---------------------------------------------------------------------------
// Read-receipt indicator — single check (sent, not seen) or double check (seen).
// Clicking opens a popover listing who has seen the message (sent msgs only).
// Touch target is at least 24px (with 8px+ padding) for accessibility.
// ---------------------------------------------------------------------------
interface ReadReceiptIndicatorProps {
  seen: boolean
  seenBy: string
  members?: ChatMember[] | null
  currentUserId: string
}

function ReadReceiptIndicator({
  seen,
  seenBy,
  members,
  currentUserId,
}: ReadReceiptIndicatorProps) {
  const trigger = (
    <button
      type="button"
      aria-label={seen ? 'Seen by at least one person' : 'Sent — not seen yet'}
      className={cn(
        'flex min-h-[24px] min-w-[24px] items-center justify-center rounded p-1 transition-colors',
        'hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        seen ? 'text-emerald-500' : 'text-muted-foreground/70'
      )}
      // Prevent the bubble's swipe/long-press handlers from firing on the button.
      onClick={(e) => {
        e.stopPropagation()
      }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      {seen ? (
        <CheckCheck className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
    </button>
  )

  // The popover only makes sense for sent messages.
  return (
    <SeenByPopover
      seenBy={seenBy}
      members={members}
      currentUserId={currentUserId}
      alignEnd
    >
      {trigger}
    </SeenByPopover>
  )
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
      sentBubbleColor,
      receivedBubbleColor,
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
      members,
    } = props

    // R1-3 — onForward prop is kept on the MessageBubble interface so the
    // existing chat-view wiring continues to typecheck, but the long-press
    // "Forward" action menu item has been removed. Forwarding as a
    // feature is parked under "Coming Soon" in the Profile screen.
    void onForward

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
    const seenByList = React.useMemo(() => {
      return (message.seenBy || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }, [message.seenBy])

    // Other users (excluding the sender) who have seen the message.
    const seenByOthers = React.useMemo(() => {
      return seenByList.filter((id) => id !== currentUserId)
    }, [seenByList, currentUserId])

    const seen = seenByOthers.length > 0

    // Number of other members who haven't yet seen (group chats only).
    const pendingCount = React.useMemo(() => {
      if (!members || members.length === 0) return 0
      const otherMembers = members.filter((m) => m.userId !== currentUserId)
      return Math.max(0, otherMembers.length - seenByOthers.length)
    }, [members, currentUserId, seenByOthers.length])

    // For group chats, show "Seen by N" next to the checkmarks.
    const showSeenCount = isGroup && seen && seenByOthers.length > 0

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
                id: message.sender?.id || undefined,
                username: message.sender?.username || undefined,
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

            {/* Forwarded badge above bubble */}
            {message.forwardedFrom && !isDeleted && (
              <div
                className={cn(
                  'forward-badge max-w-full',
                  isMine ? 'self-end' : 'self-start'
                )}
                title={`Forwarded from @${message.forwardedFrom.sender?.username || message.forwardedFrom.sender?.name || 'user'}`}
              >
                <Forward className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  Forwarded from @{message.forwardedFrom.sender?.username || message.forwardedFrom.sender?.name || 'user'}
                </span>
              </div>
            )}

            {/* Pinned badge — small 📌 above the bubble */}
            {message.pinnedAt && !isDeleted && (
              <div
                className={cn(
                  'mb-0.5 flex items-center gap-0.5 text-[10px] font-medium text-primary',
                  isMine ? 'self-end' : 'self-start'
                )}
                aria-label="Pinned message"
              >
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
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
                isTail && !isMine && 'rounded-bl-md',
                // V13 — when a per-conversation bubble color override is set,
                // drop the default .bubble-sent / .bubble-received classes so
                // the inline style is the only background source.
                isMine && sentBubbleColor && 'bg-none !bg-transparent',
                !isMine && receivedBubbleColor && 'bg-none !bg-transparent'
              )}
              style={{
                fontSize: fontSizePx ? `${fontSizePx}px` : undefined,
                fontFamily: fontFamilyClass ? undefined : undefined,
                // V13 — apply per-conversation bubble color overrides.
                ...(sentBubbleColor && isMine
                  ? {
                      backgroundColor: sentBubbleColor,
                      color: readableTextOn(sentBubbleColor),
                      border: 'none',
                    }
                  : {}),
                ...(receivedBubbleColor && !isMine
                  ? {
                      backgroundColor: receivedBubbleColor,
                      color: readableTextOn(receivedBubbleColor),
                      border: 'none',
                    }
                  : {}),
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
                    messageId={message.id}
                  />
                ) : message.type === 'voice' ? (
                  // F5-9 — voice message with no playable URL (upload failed
                  // or stale). Show a clear "unavailable" notice instead of
                  // rendering an empty bubble.
                  <span className="italic opacity-70">🎤 Voice message unavailable</span>
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
                ) : message.type === 'location' && message.lat != null && message.lng != null ? (
                  <LocationMessage
                    lat={message.lat}
                    lng={message.lng}
                    isMine={isMine}
                    expiresAt={null}
                  />
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
                <>
                  {showSeenCount && (
                    <span className="text-muted-foreground/80">· Seen by {seenByOthers.length}</span>
                  )}
                  <ReadReceiptIndicator
                    seen={seen}
                    seenBy={message.seenBy || ''}
                    members={members}
                    currentUserId={currentUserId}
                  />
                </>
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
              <DialogDescription className="sr-only">
                Enlarged view of the shared image. Press Escape or click outside to close.
              </DialogDescription>
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
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
  onReact: (emoji: string) => void
  /** R1-3 — onForward is kept on the interface for backward-compat with
   *  chat-view's wiring, but the "Forward" action menu item is removed
   *  (feature parked under "Coming Soon" in Profile). */
  onForward?: () => void
  /** R1-3 — onSchedule is kept on the interface for backward-compat with
   *  chat-view's wiring, but the "Schedule" action menu item is removed
   *  (feature parked under "Coming Soon" in Profile). */
  onSchedule?: () => void
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
  onSchedule,
}: MessageActionMenuProps) {
  // R1-3 — onForward / onSchedule are no longer rendered in this menu,
  // but kept on the interface for backward-compat. Mark them as used so
  // eslint doesn't complain.
  void onForward
  void onSchedule
  // Backdrop + a popover positioned above the anchor.
  const [showExpandedReactions, setShowExpandedReactions] = React.useState(false)
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
          {/* Expand button for more reactions */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowExpandedReactions((v) => !v)
            }}
            aria-label="More reactions"
            aria-expanded={showExpandedReactions}
            className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
          >
            <SmilePlus className="h-5 w-5" />
          </button>
        </div>

        {/* Expanded reactions grid */}
        {showExpandedReactions && (
          <div className="mb-1 grid w-[280px] max-w-[calc(100vw-16px)] grid-cols-8 gap-1 rounded-md border bg-popover p-2 shadow-md">
            {EXTENDED_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(emoji)
                  onClose()
                }}
                aria-label={`React with ${emoji}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Action items */}
        <div className="flex w-[300px] max-w-[calc(100vw-16px)] flex-col gap-0.5 rounded-md border bg-popover p-1 shadow-md">
          <ActionMenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { onReply(); onClose() }} />
          <ActionMenuItem icon={<Copy className="h-4 w-4" />} label="Copy" onClick={() => { onCopy(); onClose() }} />
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

// ---------------------------------------------------------------------------
// TypingBubble — a received-style bubble with 3 animated typing dots.
// Rendered at the bottom of the chat (above the composer) when the other
// user is typing. Uses the `.typing-dot` CSS class for the bounce animation.
// ---------------------------------------------------------------------------

interface TypingBubbleProps {
  /** Group chat? — show "@username is typing…" label above the dots. */
  isGroup?: boolean
  /** Username to display when isGroup (the user who is typing). */
  typingUsername?: string | null
  /** Bubble style — passed through for consistency with message bubbles. */
  messageStyle?: string
}

export function TypingBubble({
  isGroup = false,
  typingUsername,
  messageStyle = 'bubble',
}: TypingBubbleProps) {
  const styleCls = (() => {
    switch (messageStyle) {
      case 'sharp':
        return 'rounded-none'
      case 'tail':
        return 'bubble-tail-received'
      case 'none':
        return 'bubble-none'
      default:
        return ''
    }
  })()
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex w-full items-end justify-start gap-2 px-3 pb-1 pt-0"
      aria-live="polite"
      aria-label={
        isGroup && typingUsername
          ? `${typingUsername} is typing`
          : 'Other user is typing'
      }
    >
      <div
        className={cn(
          'rounded-2xl bg-muted/80 px-3 py-2.5 shadow-sm',
          'flex items-center gap-1',
          styleCls
        )}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      {isGroup && typingUsername && (
        <span className="self-center text-[11px] italic text-muted-foreground">
          {typingUsername} is typing…
        </span>
      )}
    </motion.div>
  )
}
