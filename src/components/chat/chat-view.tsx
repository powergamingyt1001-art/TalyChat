'use client'

import * as React from 'react'
import {
  ArrowLeft,
  Search as SearchIcon,
  MoreVertical,
  Send,
  Smile,
  Paperclip,
  Mic,
  Loader2,
  Image as ImageIcon,
  Sticker as StickerIcon,
  X,
  Bell,
  BellOff,
  Pin as PinIcon,
  PinOff,
  Trash2,
  Ban,
  Flag,
  UserPlus,
  LogOut,
  Users,
  Eye,
  Clock,
  Palette,
  ShieldCheck,
  Crown,
  Calendar as CalendarIcon,
  MessageCircle,
  AtSign,
  BadgeCheck,
  Info,
  Copy,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, apiUpload } from '@/lib/api'
import { useSocket, getSocket } from '@/lib/socket'
import { useToast } from '@/hooks/use-toast'
import { useSound } from '@/hooks/use-sound'
import {
  useCustomizer,
  getWallpaperStyle,
  WALLPAPERS,
  FONT_OPTIONS,
} from '@/components/taly/customizer-context'
import { CustomizeDialog } from '@/components/taly/customize-dialog'
import { PremiumAvatar } from '@/components/premium-avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format as formatDate } from 'date-fns'

import { MessageBubble, MessageActionMenu, TypingBubble } from './message-bubble'
import { EmojiPicker } from './emoji-picker'
import { ChatAdBox } from './chat-ad'
import { ReportDialog } from './report-dialog'
import { AddMemberDialog } from './add-member-dialog'
import { ForwardDialog } from './forward-dialog'
import { PinnedMessagesDialog } from './pinned-messages-dialog'
import {
  ChatMessage,
  ChatConversation,
  ChatAd,
} from './chat-types'
import { STICKER_SET } from './chat-types'
import {
  dateSeparatorLabel,
  formatTime,
  formatLastSeen,
  groupStatusLine,
  isSameDay,
  messagePreview,
} from './chat-helpers'
import { cn } from '@/lib/utils'
import { Pin as PinBadgeIcon, X as XIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Safe customizer hook (works with or without the CustomizerProvider).
// ---------------------------------------------------------------------------

function useCustomizerSafe(preferences: any) {
  try {
    const ctx = useCustomizer()
    return ctx
  } catch {
    // CustomizerProvider not available — derive from preferences prop.
    const wallpaper = WALLPAPERS.find((w) => w.id === preferences?.wallpaper) || WALLPAPERS[0]
    const fontFamily = FONT_OPTIONS.find((f) => f.id === preferences?.fontFamily) || FONT_OPTIONS[0]
    return {
      preferences,
      wallpaper,
      fontFamily,
      messageStyle: preferences?.messageStyle || 'bubble',
      fontSize: preferences?.fontSize || 14,
      setPreference: async () => {},
    }
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50
const AD_DELAY_PRIVATE = 25_000 // 25s
const AD_DELAY_GROUP = 30_000 // 30s
const TYPING_DEBOUNCE = 300 // ms
const TYPING_STOP_DEBOUNCE = 1000 // ms
const SWIPE_REPLY_THRESHOLD = 60 // px
const MAX_RECORD_SECONDS = 120 // 2 minutes
const TEXTAREA_MAX_LINES = 4

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ChatViewProps {
  conversationId: string
  name: string
  avatar?: string
  isGroup?: boolean
  onBack: () => void
  preferences?: any
}

export function ChatView({
  conversationId,
  name,
  avatar,
  isGroup = false,
  onBack,
  preferences,
}: ChatViewProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { play: soundManager } = useSound()
  const customizer = useCustomizerSafe(preferences)

  // ----- State -----
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [loading, setLoading] = React.useState(true)
  const [hasMore, setHasMore] = React.useState(true)
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [conversation, setConversation] = React.useState<ChatConversation | null>(null)
  const [statusText, setStatusText] = React.useState<string>('')

  const [text, setText] = React.useState('')
  const [replyingTo, setReplyingTo] = React.useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = React.useState<ChatMessage | null>(null)
  const [sending, setSending] = React.useState(false)

  // Search overlay
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchMatchIndex, setSearchMatchIndex] = React.useState(0)

  // Action menu (long-press / right-click)
  const [actionMenu, setActionMenu] = React.useState<{
    message: ChatMessage
    anchorRect: DOMRect
  } | null>(null)

  // Voice recording
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordSeconds, setRecordSeconds] = React.useState(0)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const recordChunksRef = React.useRef<Blob[]>([])
  const recordTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStreamRef = React.useRef<MediaStream | null>(null)
  const recordMimeRef = React.useRef<string>('')

  // Attachment menu state — used by Popover trigger
  const [attachmentOpen, setAttachmentOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Typing indicator (other user is typing)
  const [otherTyping, setOtherTyping] = React.useState(false)

  // Three-dot menu items that open dialogs
  const [reportOpen, setReportOpen] = React.useState(false)
  const [addMemberOpen, setAddMemberOpen] = React.useState(false)
  const [customizeOpen, setCustomizeOpen] = React.useState(false)
  const [confirmClear, setConfirmClear] = React.useState(false)
  const [confirmLeave, setConfirmLeave] = React.useState(false)
  const [confirmBlock, setConfirmBlock] = React.useState(false)

  // Forward dialog state
  const [forwardState, setForwardState] = React.useState<{
    open: boolean
    message: ChatMessage | null
  }>({ open: false, message: null })

  // Pinned messages state
  const [pinnedMessages, setPinnedMessages] = React.useState<any[]>([])
  const [showPinnedBar, setShowPinnedBar] = React.useState(true)
  const [pinnedDialogOpen, setPinnedDialogOpen] = React.useState(false)

  // Typing username (group chats) — the user who is currently typing.
  const [typingUsername, setTypingUsername] = React.useState<string | null>(null)

  // Profile / Group info dialog (opened by clicking the header name/avatar)
  const [profileViewOpen, setProfileViewOpen] = React.useState(false)

  // Ad system state
  const [ad, setAd] = React.useState<ChatAd | null>(null)
  const [adVisible, setAdVisible] = React.useState(false)
  const adTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // ----- Refs -----
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const wasNearBottomRef = React.useRef(true)
  const typingStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingStartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasEmittedTypingRef = React.useRef(false)

  // ----- API: Load conversation (for header status & members) -----
  const loadConversation = React.useCallback(async () => {
    try {
      const res: any = await apiFetch(`/api/conversations/${conversationId}`)
      // Defensive: API returns { conversation: {...} }, fall back to bare object.
      const conv: ChatConversation = res?.conversation || (res?.id ? res : null)
      setConversation(conv)
      // Compute status text for header
      if (isGroup) {
        setStatusText(groupStatusLine(conv?.members))
      } else {
        const other = conv?.otherUser
        if (other?.isOnline) setStatusText('online')
        else setStatusText(formatLastSeen(other?.lastSeen ? new Date(other.lastSeen) : null))
      }
    } catch (e: any) {
      // Not fatal — header will just show empty status
      console.warn('Failed to load conversation:', e?.message)
    }
  }, [conversationId, isGroup])

  // ----- API: Load messages (cursor pagination) -----
  const loadMessages = React.useCallback(
    async (cur: string | null) => {
      try {
        const params = new URLSearchParams({
          conversationId,
          limit: String(PAGE_SIZE),
        })
        if (cur) params.set('cursor', cur)
        const res: any = await apiFetch(`/api/messages?${params.toString()}`)
        // Defensive: API returns { messages: [...], hasMore, nextCursor }.
        // Fall back to bare array if shape changes.
        const list: ChatMessage[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.messages)
            ? res.messages
            : Array.isArray(res?.items)
              ? res.items
              : []
        setHasMore(!!res?.hasMore)
        setCursor(res?.nextCursor || null)
        if (cur) {
          // Prepend older messages
          setMessages((prev) => [...list, ...prev])
        } else {
          setMessages(list)
          // After initial load, mark all received messages as seen
          markReceivedAsSeen(list)
        }
      } catch (e: any) {
        toast({ title: e.message || 'Failed to load messages', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [conversationId, toast]
  )

  // Mark all received (not-mine, not-deleted) messages as seen.
  const markReceivedAsSeen = React.useCallback(
    async (list: ChatMessage[]) => {
      if (!user?.id) return
      const toMark = list.filter(
        (m) => m.senderId !== user.id && !m.deletedAt
      )
      // Fire-and-forget; batched sequentially to be easy on the server.
      for (const m of toMark.slice(0, 25)) {
        try {
          await apiFetch(`/api/messages/${m.id}/read`, { method: 'POST' })
        } catch {}
      }
    },
    [user?.id]
  )

  // ----- API: Load pinned messages for the pinned bar -----
  const loadPinned = React.useCallback(async () => {
    try {
      const res: any = await apiFetch(`/api/conversations/${conversationId}/pinned`)
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.messages)
          ? res.messages
          : Array.isArray(res?.items)
            ? res.items
            : []
      setPinnedMessages(list)
      // When a new pinned message appears, re-show the pinned bar.
      if (list.length > 0) {
        setShowPinnedBar(true)
      }
    } catch {
      // Silent — pinned bar is optional
    }
  }, [conversationId])

  // ----- Initial mount: load conversation + messages + pinned -----
  React.useEffect(() => {
    setLoading(true)
    setMessages([])
    setCursor(null)
    setHasMore(true)
    setShowPinnedBar(true)
    loadConversation()
    loadMessages(null)
    loadPinned()
  }, [loadConversation, loadMessages, loadPinned])

  // ----- Auto-scroll on new messages if near bottom -----
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // After initial load, jump to bottom
    if (loading) return
    if (wasNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, loading])

  // Track scroll position to know whether to auto-scroll
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    wasNearBottomRef.current = distanceFromBottom < 150

    // Pagination: load more when scrolled near top
    if (el.scrollTop < 60 && hasMore && !loading) {
      const prevHeight = el.scrollHeight
      const prevTop = el.scrollTop
      loadMessages(cursor).then(() => {
        // Restore scroll position after prepend
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            const newHeight = scrollRef.current.scrollHeight
            scrollRef.current.scrollTop = prevTop + (newHeight - prevHeight)
          }
        })
      })
    }
  }, [cursor, hasMore, loading, loadMessages])

  // ----- Realtime: socket events -----
  const onNewMessage = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      const msg: ChatMessage = payload.message || payload
      if (!msg || !msg.id) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      // Auto-mark as seen if message is from other user
      if (user?.id && msg.senderId !== user.id && !msg.deletedAt) {
        apiFetch(`/api/messages/${msg.id}/read`, { method: 'POST' }).catch(() => {})
        // Also emit message:status seen over socket so the sender's UI updates
        const s = getSocket()
        s?.emit('message:status', {
          conversationId,
          messageId: msg.id,
          seen: true,
          userId: user.id,
        })
      }
    },
    [conversationId, user?.id]
  )

  const onReaction = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      const { messageId, reactions, emoji, userId } = payload
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          // If full reactions array provided, replace
          if (Array.isArray(reactions)) {
            return { ...m, reactions }
          }
          // Otherwise apply a delta: toggle emoji by userId
          const list = m.reactions ? [...m.reactions] : []
          const existingIdx = list.findIndex((r) => r.userId === userId)
          if (existingIdx >= 0) {
            if (list[existingIdx].emoji === emoji) {
              list.splice(existingIdx, 1) // toggle off
            } else {
              list[existingIdx] = { ...list[existingIdx], emoji }
            }
          } else {
            list.push({
              id: `${messageId}-${userId}`,
              messageId,
              userId,
              emoji,
              user: null,
              createdAt: new Date().toISOString(),
            })
          }
          return { ...m, reactions: list }
        })
      )
    },
    [conversationId]
  )

  const onMessageEdit = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      const msg: ChatMessage = payload.message || payload
      if (!msg?.id) return
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m))
      )
    },
    [conversationId]
  )

  const onMessageDelete = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      const { messageId, deletedAt } = payload
      if (!messageId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deletedAt: deletedAt || new Date().toISOString() } : m
        )
      )
    },
    [conversationId]
  )

  const onMessageStatus = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      const { messageId, seen, userId } = payload
      if (!messageId || !seen) return
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          if (!userId) return m
          const seenBy = (m.seenBy || '').split(',').map((s) => s.trim()).filter(Boolean)
          if (!seenBy.includes(userId)) seenBy.push(userId)
          return { ...m, seenBy: seenBy.join(',') }
        })
      )
    },
    [conversationId]
  )

  const onTyping = React.useCallback(
    (payload: any) => {
      if (!payload || payload.conversationId !== conversationId) return
      if (payload.userId === user?.id) return // ignore my own
      setOtherTyping(!!payload.isTyping)
      // For group chats, surface the username so we can show "@user is typing…".
      if (payload.isTyping) {
        // Resolve username from the conversation members (if available).
        const member = conversation?.members?.find((m) => m.userId === payload.userId)
        const uname =
          payload.username ||
          member?.user?.username ||
          member?.user?.name ||
          null
        setTypingUsername(uname)
      } else {
        setTypingUsername(null)
      }
    },
    [conversationId, user?.id, conversation?.members]
  )

  const { connected } = useSocket({
    'message:new': onNewMessage,
    'reaction': onReaction,
    'message:edit': onMessageEdit,
    'message:delete': onMessageDelete,
    'message:status': onMessageStatus,
    'typing': onTyping,
  })

  // Emit join / leave on connect
  React.useEffect(() => {
    if (!connected) return
    const s = getSocket()
    if (!s) return
    s.emit('join:conversation', { conversationId })
    return () => {
      const s2 = getSocket()
      s2?.emit('leave:conversation', { conversationId })
    }
  }, [connected, conversationId])

  // ----- Ad system -----
  const fetchAd = React.useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/ads?placement=in-chat')
      // Defensive: API returns { ad: {...} | null } for in-chat placement.
      const adObj = res?.ad ?? res?.item ?? null
      if (adObj) {
        setAd(adObj)
        setAdVisible(true)
      } else {
        setAd(null)
        setAdVisible(false)
      }
    } catch {
      // Silent fail
    }
  }, [])

  const scheduleNextAd = React.useCallback(() => {
    if (adTimerRef.current) clearTimeout(adTimerRef.current)
    const delay = isGroup ? AD_DELAY_GROUP : AD_DELAY_PRIVATE
    adTimerRef.current = setTimeout(() => {
      fetchAd()
    }, delay)
  }, [fetchAd, isGroup])

  // Start the ad loop on mount and re-schedule on close.
  React.useEffect(() => {
    scheduleNextAd()
    return () => {
      if (adTimerRef.current) clearTimeout(adTimerRef.current)
    }
  }, [scheduleNextAd])

  const handleCloseAd = () => {
    setAdVisible(false)
    setAd(null)
    scheduleNextAd()
  }

  const handleAdCtaClick = async (clickedAd: ChatAd) => {
    try {
      await apiFetch(`/api/ads/${clickedAd.id}/click`, { method: 'POST' })
    } catch {}
  }

  // ----- Send message -----
  const handleSend = async () => {
    if (sending) return
    const content = text.trim()
    if (!content && !editingMessage) return

    if (editingMessage) {
      // Edit mode
      setSending(true)
      try {
        const res: any = await apiFetch(`/api/messages/${editingMessage.id}`, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        })
        // Defensive: API returns { message: {...} }, fall back to bare object.
        const updated: ChatMessage = res?.message || (res?.id ? res : null)
        if (updated) {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          // Emit edit over socket
          getSocket()?.emit('message:edit', {
            conversationId,
            messageId: updated.id,
            message: updated,
          })
        }
        setEditingMessage(null)
        setText('')
      } catch (e: any) {
        toast({ title: e.message || 'Failed to edit', variant: 'destructive' })
      } finally {
        setSending(false)
      }
      return
    }

    setSending(true)
    try {
      const body: any = {
        conversationId,
        content,
        type: 'text',
      }
      if (replyingTo) body.replyToId = replyingTo.id
      const res: any = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      // Defensive: API returns { message: {...} } (201), fall back to bare object.
      const sent: ChatMessage = res?.message || (res?.id ? res : null)
      if (sent) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === sent.id)) return prev
          return [...prev, sent]
        })
        wasNearBottomRef.current = true
        getSocket()?.emit('message:send', { conversationId, message: sent })
        // Subtle "pop" sound for an outgoing message — fires inside the
        // user's send click/keypress gesture so the AudioContext is unlocked.
        soundManager.playSend()
      }
      setReplyingTo(null)
      setText('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (e: any) {
      toast({ title: e.message || 'Failed to send', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const handleSendSticker = async (sticker: string) => {
    try {
      const res: any = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          content: sticker,
          type: 'sticker',
          stickerId: sticker,
        }),
      })
      // Defensive: API returns { message: {...} } (201), fall back to bare object.
      const sent: ChatMessage = res?.message || (res?.id ? res : null)
      if (sent) {
        setMessages((prev) => [...prev, sent])
        wasNearBottomRef.current = true
        getSocket()?.emit('message:send', { conversationId, message: sent })
      }
    } catch (e: any) {
      toast({ title: e.message || 'Failed to send sticker', variant: 'destructive' })
    }
  }

  const handleImageUpload = async (file: File) => {
    try {
      const up: any = await apiUpload('/api/upload', file)
      const mediaUrl = up?.url
      if (!mediaUrl) throw new Error('Upload failed')
      const res: any = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          type: 'image',
          mediaUrl,
          content: '',
        }),
      })
      // Defensive: API returns { message: {...} } (201), fall back to bare object.
      const sent: ChatMessage = res?.message || (res?.id ? res : null)
      if (sent) {
        setMessages((prev) => [...prev, sent])
        wasNearBottomRef.current = true
        getSocket()?.emit('message:send', { conversationId, message: sent })
      }
    } catch (e: any) {
      toast({ title: e.message || 'Image upload failed', variant: 'destructive' })
    }
  }

  // ----- Reactions -----
  const handleReact = async (m: ChatMessage, emoji: string) => {
    try {
      const res: any = await apiFetch(`/api/messages/${m.id}/reaction`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      })
      // Defensive: API returns { reactions: [...] }, fall back to bare array.
      const reactionsList: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.reactions)
          ? res.reactions
          : Array.isArray(res?.items)
            ? res.items
            : []
      if (reactionsList.length > 0 || Array.isArray(res?.reactions)) {
        setMessages((prev) =>
          prev.map((mm) => (mm.id === m.id ? { ...mm, reactions: reactionsList } : mm))
        )
        getSocket()?.emit('reaction', {
          conversationId,
          messageId: m.id,
          reactions: reactionsList,
          emoji,
          userId: user?.id,
        })
      }
    } catch (e: any) {
      toast({ title: e.message || 'Failed to react', variant: 'destructive' })
    }
  }

  // ----- Edit / Delete / Pin -----
  const handleEdit = (m: ChatMessage) => {
    setEditingMessage(m)
    setText(m.content || '')
    setReplyingTo(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleDelete = async (m: ChatMessage) => {
    try {
      await apiFetch(`/api/messages/${m.id}`, { method: 'DELETE' })
      setMessages((prev) =>
        prev.map((mm) =>
          mm.id === m.id ? { ...mm, deletedAt: new Date().toISOString() } : mm
        )
      )
      getSocket()?.emit('message:delete', {
        conversationId,
        messageId: m.id,
        deletedAt: new Date().toISOString(),
      })
      toast({ title: 'Message deleted' })
    } catch (e: any) {
      toast({ title: e.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handlePin = async (m: ChatMessage) => {
    const wantPin = !m.pinnedAt
    try {
      // Optimistically update local state for snappy UI.
      setMessages((prev) =>
        prev.map((mm) =>
          mm.id === m.id
            ? {
                ...mm,
                pinnedAt: wantPin ? new Date().toISOString() : null,
              }
            : mm
        )
      )
      const res: any = await apiFetch(`/api/messages/${m.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin: wantPin }),
      })
      // If the server returned an updated pinnedAt, sync.
      if (res?.message?.pinnedAt) {
        setMessages((prev) =>
          prev.map((mm) =>
            mm.id === m.id ? { ...mm, pinnedAt: res.message.pinnedAt } : mm
          )
        )
      }
      // Refresh the pinned-messages bar.
      await loadPinned()
      // Re-show the pinned bar if we just pinned.
      if (wantPin) setShowPinnedBar(true)
      toast({ title: wantPin ? 'Message pinned' : 'Message unpinned' })
    } catch (e: any) {
      // Revert optimistic update on error.
      setMessages((prev) =>
        prev.map((mm) =>
          mm.id === m.id ? { ...mm, pinnedAt: m.pinnedAt } : mm
        )
      )
      toast({ title: e.message || 'Failed to pin', variant: 'destructive' })
    }
  }

  const handleForward = (m: ChatMessage) => {
    setForwardState({ open: true, message: m })
  }

  // ----- Jump to message (from pinned dialog) -----
  // Scrolls the chat to the target message and briefly highlights it.
  const handleMessageJump = React.useCallback((messageId: string) => {
    // First, ensure the message is in the current list.
    const exists = messages.some((m) => m.id === messageId)
    if (!exists) {
      toast({ title: 'Message not loaded — scroll up to find it.' })
      return
    }
    // Find the DOM node for the message and scroll to it.
    const el = scrollRef.current
    if (!el) return
    const node = el.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief flash highlight
      node.classList.add('ring-2', 'ring-primary/60', 'rounded-xl')
      setTimeout(() => {
        node.classList.remove('ring-2', 'ring-primary/60', 'rounded-xl')
      }, 1500)
    } else {
      // Fallback — just scroll to bottom
      el.scrollTop = el.scrollHeight
    }
  }, [messages, toast])

  const handleCopy = (text: string) => {
    if (!text) {
      toast({ title: 'Nothing to copy' })
      return
    }
    try {
      navigator.clipboard?.writeText(text)
      toast({ title: 'Copied' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const handleReplyTo = (m: ChatMessage) => {
    setReplyingTo(m)
    setEditingMessage(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const cancelReply = () => {
    setReplyingTo(null)
    if (editingMessage) {
      setEditingMessage(null)
      setText('')
    }
  }

  // ----- Voice recording -----
  const stopRecording = React.useCallback(
    (opts: { send: boolean }) => {
      const recorder = mediaRecorderRef.current
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current)
        recordTimerRef.current = null
      }
      if (recorder && recorder.state !== 'inactive') {
        // We attach a one-time onstop handler that creates the Blob.
        const handleStop = async () => {
          try {
            const chunks = recordChunksRef.current
            if (chunks.length === 0) return
            const mime = recordMimeRef.current || 'audio/webm'
            const blob = new Blob(chunks, { type: mime })
            if (!opts.send) return
            const ext = mime.includes('mp3')
              ? 'mp3'
              : mime.includes('wav')
              ? 'wav'
              : 'webm'
            const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime })
            const up: any = await apiUpload('/api/upload', file)
            const mediaUrl = up?.url
            const duration = recordSecondsRef.current
            if (!mediaUrl) throw new Error('Upload failed')
            const res: any = await apiFetch('/api/messages', {
              method: 'POST',
              body: JSON.stringify({
                conversationId,
                type: 'voice',
                mediaUrl,
                voiceDuration: duration,
                content: '',
              }),
            })
            // Defensive: API returns { message: {...} } (201), fall back to bare object.
            const sent: ChatMessage = res?.message || (res?.id ? res : null)
            if (sent) {
              setMessages((prev) => [...prev, sent])
              wasNearBottomRef.current = true
              getSocket()?.emit('message:send', { conversationId, message: sent })
            }
          } catch (e: any) {
            toast({ title: e.message || 'Voice upload failed', variant: 'destructive' })
          } finally {
            // Reset state
            setIsRecording(false)
            setRecordSeconds(0)
            recordChunksRef.current = []
            recordSecondsRef.current = 0
            // Stop the audio stream
            if (recordStreamRef.current) {
              for (const t of recordStreamRef.current.getTracks()) t.stop()
              recordStreamRef.current = null
            }
            recorder.removeEventListener('stop', handleStop)
          }
        }
        recorder.addEventListener('stop', handleStop)
        recorder.stop()
      } else {
        // No active recorder — just reset UI
        setIsRecording(false)
        setRecordSeconds(0)
        recordChunksRef.current = []
        recordSecondsRef.current = 0
        if (recordStreamRef.current) {
          for (const t of recordStreamRef.current.getTracks()) t.stop()
          recordStreamRef.current = null
        }
      }
    },
    [conversationId, toast]
  )

  const recordSecondsRef = React.useRef(0)

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast({ title: 'Voice recording not supported', variant: 'destructive' })
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordStreamRef.current = stream
      // Pick a supported mime type
      const candidates = ['audio/webm', 'audio/ogg', 'audio/mp3']
      let mime = ''
      for (const c of candidates) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) {
          mime = c
          break
        }
      }
      recordMimeRef.current = mime
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      mediaRecorderRef.current = recorder
      recordChunksRef.current = []
      recordSecondsRef.current = 0
      setRecordSeconds(0)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data)
      }
      recorder.start(250)
      setIsRecording(true)
      recordTimerRef.current = setInterval(() => {
        recordSecondsRef.current += 1
        setRecordSeconds(recordSecondsRef.current)
        if (recordSecondsRef.current >= MAX_RECORD_SECONDS) {
          stopRecording({ send: true })
        }
      }, 1000)
    } catch (e: any) {
      toast({ title: e.message || 'Mic permission denied', variant: 'destructive' })
      setIsRecording(false)
      if (recordStreamRef.current) {
        for (const t of recordStreamRef.current.getTracks()) t.stop()
        recordStreamRef.current = null
      }
    }
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {}
      }
      if (recordStreamRef.current) {
        for (const t of recordStreamRef.current.getTracks()) t.stop()
      }
      if (typingStartTimerRef.current) clearTimeout(typingStartTimerRef.current)
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    }
  }, [])

  // ----- Typing emit -----
  const emitTyping = (isTyping: boolean) => {
    const s = getSocket()
    if (!s || !user?.id) return
    s.emit('typing', { conversationId, isTyping, userId: user.id })
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setText(v)

    // Auto-grow
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      const lineHeight = 20
      const maxHeight = lineHeight * TEXTAREA_MAX_LINES
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`
    }

    // Typing emit (debounced)
    if (v.trim()) {
      if (!hasEmittedTypingRef.current) {
        if (typingStartTimerRef.current) clearTimeout(typingStartTimerRef.current)
        typingStartTimerRef.current = setTimeout(() => {
          emitTyping(true)
          hasEmittedTypingRef.current = true
        }, TYPING_DEBOUNCE)
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
      typingStopTimerRef.current = setTimeout(() => {
        emitTyping(false)
        hasEmittedTypingRef.current = false
      }, TYPING_STOP_DEBOUNCE)
    } else {
      if (hasEmittedTypingRef.current) {
        emitTyping(false)
        hasEmittedTypingRef.current = false
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
      if (typingStartTimerRef.current) clearTimeout(typingStartTimerRef.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && (replyingTo || editingMessage)) {
      cancelReply()
    }
  }

  // ----- Three-dot menu actions -----
  const patchConversation = async (patch: Record<string, any>) => {
    try {
      const res: any = await apiFetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      // Defensive: API returns { conversation: {...} }, fall back to bare object.
      const updated = res?.conversation || (res?.id ? res : null) || patch
      setConversation((c) => ({ ...(c as any), ...updated }))
      return updated
    } catch (e: any) {
      toast({ title: e.message || 'Failed', variant: 'destructive' })
    }
  }

  const toggleMute = async () => {
    const next = !conversation?.muted
    await patchConversation({ muted: next })
    toast({ title: next ? 'Muted' : 'Unmuted' })
  }

  const togglePin = async () => {
    const next = !conversation?.pinned
    await patchConversation({ pinned: next })
    toast({ title: next ? 'Pinned' : 'Unpinned' })
  }

  const handleClearNow = async () => {
    setConfirmClear(false)
    // Hide all messages locally (per task spec; backend bulk delete is TBD)
    setMessages([])
    // Also send DELETE for each message — best-effort
    // (Skip to avoid N requests; the server doesn't yet have a bulk endpoint.)
    toast({ title: 'Chat cleared' })
  }

  const setAutoDelete = async (seconds: number | null) => {
    await patchConversation({ autoDeleteAfter: seconds })
    if (seconds === null) {
      toast({ title: 'Auto-delete cancelled' })
    } else {
      toast({ title: `Messages will auto-delete after ${autoDeleteLabel(seconds)}` })
    }
  }

  const handleLeaveGroup = async () => {
    setConfirmLeave(false)
    try {
      await apiFetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
      toast({ title: 'You left the group' })
      onBack()
    } catch (e: any) {
      toast({ title: e.message || 'Failed to leave group', variant: 'destructive' })
    }
  }

  const handleBlock = async () => {
    setConfirmBlock(false)
    const otherId = conversation?.otherUser?.id
    if (!otherId) {
      toast({ title: 'No user to block', variant: 'destructive' })
      return
    }
    try {
      await apiFetch('/api/blocks', {
        method: 'POST',
        body: JSON.stringify({ blockedId: otherId }),
      })
      toast({ title: 'User blocked' })
      onBack()
    } catch (e: any) {
      toast({ title: e.message || 'Failed to block', variant: 'destructive' })
    }
  }

  // Helper for auto-delete label
  const autoDeleteLabel = (seconds: number | null): string => {
    if (seconds === null) return 'never'
    if (seconds <= 3600) return '1 hour'
    if (seconds <= 86400) return '1 day'
    if (seconds <= 604800) return '1 week'
    if (seconds <= 2592000) return '1 month'
    return `${Math.round(seconds / 86400)} days`
  }

  // ----- Derived render data -----
  // Messages: API returns newest-first. Render oldest-first visually.
  const sortedMessages = React.useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  )

  const filteredMessages = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedMessages
    const q = searchQuery.trim().toLowerCase()
    return sortedMessages.filter(
      (m) =>
        (m.content || '').toLowerCase().includes(q) ||
        (m.sender?.name || '').toLowerCase().includes(q) ||
        (m.sender?.username || '').toLowerCase().includes(q)
    )
  }, [sortedMessages, searchQuery])

  // Group consecutive messages from the same sender within same day.
  const messageRenderData = React.useMemo(() => {
    const items: Array<{
      type: 'date' | 'message'
      message?: ChatMessage
      label?: string
      isFirstInGroup?: boolean
      isLastInGroup?: boolean
    }> = []
    let lastDate: Date | null = null
    let lastSenderId: string | null = null

    for (let i = 0; i < filteredMessages.length; i++) {
      const m = filteredMessages[i]
      const createdAt = new Date(m.createdAt)
      if (!lastDate || !isSameDay(lastDate, createdAt)) {
        items.push({ type: 'date', label: dateSeparatorLabel(createdAt) })
        lastDate = createdAt
        lastSenderId = null
      }
      const isFirstInGroup = lastSenderId !== m.senderId
      // Determine isLastInGroup by peeking at next message.
      const next = filteredMessages[i + 1]
      const isLastInGroup =
        !next ||
        new Date(next.createdAt).getTime() - createdAt.getTime() > 5 * 60 * 1000 ||
        next.senderId !== m.senderId ||
        !isSameDay(new Date(next.createdAt), createdAt)
      items.push({ type: 'message', message: m, isFirstInGroup, isLastInGroup })
      lastSenderId = m.senderId
    }
    return items
  }, [filteredMessages])

  const wallpaperStyle = getWallpaperStyle(customizer.wallpaper)
  const fontFamilyClass = customizer.fontFamily?.className || ''
  const fontSizePx = customizer.fontSize || 14
  const messageStyle = customizer.messageStyle || 'bubble'

  const otherUserId = conversation?.otherUser?.id

  // ----- Render -----
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* =========================== HEADER =========================== */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setProfileViewOpen(true)}
          aria-label="Open profile"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-accent/50"
        >
          {isGroup ? (
            <Avatar className="h-9 w-9 shrink-0">
              {avatar && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                {(name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <PremiumAvatar
              user={{
                isPremium: (conversation?.otherUser as any)?.isPremium,
                premiumTier: (conversation?.otherUser as any)?.premiumTier,
                avatar: avatar || conversation?.otherUser?.avatar || undefined,
                name: name || conversation?.otherUser?.name || 'U',
              }}
              size={36}
              showAura
              className="shrink-0"
              isOnline={!!conversation?.otherUser?.isOnline}
            />
          )}

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="truncate text-sm font-semibold">
              {name}
              {isGroup && conversation?.group?.isPublic === false && (
                <ShieldCheck className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {otherTyping ? (
                <span className="text-primary">typing…</span>
              ) : statusText ? (
                statusText
              ) : (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search messages"
          aria-pressed={searchOpen}
          className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
        >
          <SearchIcon className="h-5 w-5" />
        </button>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More options"
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {isGroup ? (
              <>
                <DropdownMenuItem onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Add member
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                  <SearchIcon className="h-4 w-4" /> Search
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Members list coming soon' })}>
                  <Users className="h-4 w-4" /> Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Shared media coming soon' })}>
                  <ImageIcon className="h-4 w-4" /> Shared Media
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleMute}>
                  {conversation?.muted ? (
                    <>
                      <BellOff className="h-4 w-4" /> Unmute
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" /> Mute
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Privacy info coming soon' })}>
                  <ShieldCheck className="h-4 w-4" /> Privacy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCustomizeOpen(true)}>
                  <Palette className="h-4 w-4" /> Customize
                </DropdownMenuItem>
                <DropdownMenuItem onClick={togglePin}>
                  {conversation?.pinned ? (
                    <>
                      <PinOff className="h-4 w-4" /> Unpin Group
                    </>
                  ) : (
                    <>
                      <PinIcon className="h-4 w-4" /> Pin Group
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmClear(true)}>
                  <Trash2 className="h-4 w-4" /> Clear Chat
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Clock className="h-4 w-4" /> Clear after…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setAutoDelete(3600)}>1 hour</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(86400)}>1 day</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(604800)}>1 week</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(2592000)}>1 month</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAutoDelete(null)}>Cancel</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => setConfirmLeave(true)} className="text-destructive">
                  <LogOut className="h-4 w-4" /> Leave Group
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
                  <Flag className="h-4 w-4" /> Report
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                  <SearchIcon className="h-4 w-4" /> Search messages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleMute}>
                  {conversation?.muted ? (
                    <>
                      <BellOff className="h-4 w-4" /> Unmute
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" /> Mute
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Shared media coming soon' })}>
                  <ImageIcon className="h-4 w-4" /> Shared Media
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast({ title: 'Privacy info coming soon' })}>
                  <ShieldCheck className="h-4 w-4" /> Privacy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCustomizeOpen(true)}>
                  <Palette className="h-4 w-4" /> Customize chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={togglePin}>
                  {conversation?.pinned ? (
                    <>
                      <PinOff className="h-4 w-4" /> Unpin Chat
                    </>
                  ) : (
                    <>
                      <PinIcon className="h-4 w-4" /> Pin Chat
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmClear(true)}>
                  <Trash2 className="h-4 w-4" /> Clear chat now
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Clock className="h-4 w-4" /> Clear chat after…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setAutoDelete(3600)}>1 hour</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(86400)}>1 day</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(604800)}>1 week</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAutoDelete(2592000)}>1 month</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAutoDelete(null)}>Cancel</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => setConfirmBlock(true)} className="text-destructive">
                  <Ban className="h-4 w-4" /> Block user
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
                  <Flag className="h-4 w-4" /> Report
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Search bar (toggle) */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b bg-background/95 px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchMatchIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const q = searchQuery.trim().toLowerCase()
                if (!q) return
                const matches = sortedMessages.filter((m) => (m.content || '').toLowerCase().includes(q))
                if (matches.length > 0) {
                  const next = (searchMatchIndex + 1) % matches.length
                  setSearchMatchIndex(next)
                  const target = matches[next]
                  if (target) {
                    const el = document.getElementById(`msg-${target.id}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }
              }
            }}
            placeholder="Search this chat…"
            className="h-9 flex-1 rounded-full"
            autoFocus
          />
          {searchQuery.trim() && (() => {
            const q = searchQuery.trim().toLowerCase()
            const matches = sortedMessages.filter((m) => (m.content || '').toLowerCase().includes(q))
            const total = matches.length
            return total > 0 ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    const prev = searchMatchIndex <= 0 ? total - 1 : searchMatchIndex - 1
                    setSearchMatchIndex(prev)
                    const target = matches[prev]
                    if (target) {
                      const el = document.getElementById(`msg-${target.id}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  aria-label="Previous match"
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center tabular-nums">
                  {searchMatchIndex + 1}/{total}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = (searchMatchIndex + 1) % total
                    setSearchMatchIndex(next)
                    const target = matches[next]
                    if (target) {
                      const el = document.getElementById(`msg-${target.id}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  aria-label="Next match"
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No match</span>
            )
          })()}
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false)
              setSearchQuery('')
              setSearchMatchIndex(0)
            }}
            aria-label="Close search"
            className="flex h-8 w-8 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =========================== PINNED BAR =========================== */}
      {pinnedMessages.length > 0 && showPinnedBar && (() => {
        const latest = pinnedMessages[0]
        const senderName =
          latest?.sender?.name || latest?.sender?.username || 'user'
        const preview =
          latest?.type === 'image'
            ? '📷 Photo'
            : latest?.type === 'voice'
              ? '🎤 Voice message'
              : latest?.type === 'sticker'
                ? '🎨 Sticker'
                : (latest?.content || '').slice(0, 50)
        return (
          <div
            className="pinned-bar flex shrink-0 items-center gap-2 px-3 py-2"
            role="button"
            tabIndex={0}
            onClick={() => setPinnedDialogOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setPinnedDialogOpen(true)
              }
            }}
          >
            <PinBadgeIcon className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 cursor-pointer">
              <div className="truncate text-xs text-foreground">
                <span className="font-semibold text-primary">
                  @{senderName}:
                </span>{' '}
                <span className="opacity-90">{preview}</span>
              </div>
              {pinnedMessages.length > 1 && (
                <div className="text-[10px] text-muted-foreground">
                  +{pinnedMessages.length - 1} more pinned
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowPinnedBar(false)
              }}
              aria-label="Hide pinned bar"
              className="flex h-7 w-7 min-h-[36px] min-w-[36px] items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })()}

      {/* =========================== MESSAGES =========================== */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scroll-pan-y relative flex-1 overflow-y-auto"
        style={wallpaperStyle}
      >
        {/* Top loader */}
        {hasMore && (
          <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading older messages…
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              {searchQuery ? 'No matches found.' : 'No messages yet.'}
            </div>
          ) : (
            messageRenderData.map((item, idx) => {
              if (item.type === 'date') {
                return (
                  <div
                    key={`d-${idx}`}
                    className="my-3 flex items-center justify-center"
                  >
                    <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      {item.label}
                    </span>
                  </div>
                )
              }
              const m = item.message!
              const isMine = m.senderId === user?.id
              return (
                <div key={m.id} id={`msg-${m.id}`} data-message-id={m.id}>
                  <MessageBubble
                    message={m}
                    isMine={isMine}
                    isGroup={isGroup}
                    currentUserId={user?.id || ''}
                    messageStyle={messageStyle}
                    fontFamilyClass={fontFamilyClass}
                    fontSizePx={fontSizePx}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    showDateSeparator={false}
                    dateSeparatorLabel={item.label}
                    onReply={handleReplyTo}
                    onReact={handleReact}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onPin={handlePin}
                    onForward={handleForward}
                    onCopy={handleCopy}
                    registerActionAnchor={(el, msg) => {
                      if (el && msg) {
                        setActionMenu({ message: msg, anchorRect: el.getBoundingClientRect() })
                      } else {
                        setActionMenu(null)
                      }
                    }}
                  />
                </div>
              )
            })
          )}

          {/* Ad box (after last message) */}
          {adVisible && ad && (
            <ChatAdBox
              ad={ad}
              onClose={handleCloseAd}
              onCtaClick={handleAdCtaClick}
            />
          )}
        </div>

        {/* Typing indicator bubble (above composer, inside scroll area) */}
        {otherTyping && (
          <TypingBubble
            isGroup={isGroup}
            typingUsername={typingUsername}
            messageStyle={messageStyle}
          />
        )}
      </div>

      {/* =========================== COMPOSER =========================== */}
      <div className="sticky bottom-0 z-20 shrink-0 border-t bg-background/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Reply / Edit preview */}
        {(replyingTo || editingMessage) && (
          <div className="mb-2 flex items-start gap-2 rounded-md border bg-accent/30 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-primary">
                {editingMessage ? 'Editing message' : `Reply to @${replyingTo?.sender?.username || replyingTo?.sender?.name || 'user'}`}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {editingMessage
                  ? editingMessage.content
                  : replyingTo
                  ? messagePreview({
                      type: replyingTo.type,
                      content: replyingTo.content,
                      mediaUrl: replyingTo.mediaUrl,
                      deletedAt: replyingTo.deletedAt,
                    })
                  : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={cancelReply}
              aria-label="Cancel"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Recording UI */}
        {isRecording ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <button
              type="button"
              onClick={() => stopRecording({ send: false })}
              aria-label="Cancel recording"
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-destructive/15 text-destructive hover:bg-destructive/25"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              <span className="text-sm tabular-nums">
                {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}{' '}
                / 2:00
              </span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording({ send: true })}
              aria-label="Send voice"
              className="btn-brand flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-1">
            {/* Emoji button */}
            <EmojiPicker onPick={(emoji) => setText((t) => t + emoji)} align="start" side="top">
              <button
                type="button"
                aria-label="Insert emoji"
                className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
              >
                <Smile className="h-5 w-5 text-muted-foreground" />
              </button>
            </EmojiPicker>

            {/* Attachment menu */}
            <Popover open={attachmentOpen} onOpenChange={setAttachmentOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Attach"
                  className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-accent"
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" sideOffset={6} className="w-56 p-1">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentOpen(false)
                      fileInputRef.current?.click()
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <ImageIcon className="h-4 w-4" /> Image
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Stickers
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1">
                    {STICKER_SET.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setAttachmentOpen(false)
                          handleSendSticker(s)
                        }}
                        className="flex h-12 min-h-[44px] items-center justify-center rounded-md text-3xl hover:bg-accent"
                        aria-label={`Sticker ${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Hidden file input for image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  handleImageUpload(f)
                }
                e.target.value = ''
              }}
            />

            {/* Text input (auto-grow textarea) */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={editingMessage ? 'Edit message…' : 'Message…'}
              className="max-h-[88px] min-h-[40px] flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{
                fontSize: `${fontSizePx}px`,
              }}
            />

            {/* Voice / Send button */}
            {text.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                aria-label="Send"
                className="btn-brand flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                aria-label="Record voice"
                className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary/25"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================== DIALOGS / OVERLAYS =========================== */}
      {/* Message action menu (long-press / right-click) */}
      <MessageActionMenu
        open={!!actionMenu}
        message={actionMenu?.message || null}
        isMine={actionMenu?.message?.senderId === user?.id}
        anchorRect={actionMenu?.anchorRect || null}
        onClose={() => setActionMenu(null)}
        onReply={() => actionMenu?.message && handleReplyTo(actionMenu.message)}
        onCopy={() => {
          const m = actionMenu?.message
          if (m) handleCopy(m.content || messagePreview(m))
        }}
        onForward={() => actionMenu?.message && handleForward(actionMenu.message)}
        onEdit={() => actionMenu?.message && handleEdit(actionMenu.message)}
        onDelete={() => actionMenu?.message && handleDelete(actionMenu.message)}
        onPin={() => actionMenu?.message && handlePin(actionMenu.message)}
        onReact={(emoji) => actionMenu?.message && handleReact(actionMenu.message, emoji)}
      />

      {/* Report dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        reportedUserId={isGroup ? null : otherUserId}
        reportedGroupId={isGroup ? conversation?.groupId : null}
        targetName={name}
      />

      {/* Add member dialog (groups) */}
      {isGroup && conversation?.groupId && (
        <AddMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          groupId={conversation.groupId}
          groupName={name}
        />
      )}

      {/* Customize dialog */}
      <CustomizeDialog
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onOpenChange={setCustomizeOpen}
        conversationId={conversationId}
        isGroup={isGroup}
      />

      {/* Profile / Group info dialog (opened from header) */}
      <ProfileViewDialog
        open={profileViewOpen}
        onOpenChange={setProfileViewOpen}
        isGroup={isGroup}
        name={name}
        avatar={avatar}
        otherUserId={otherUserId}
        groupId={conversation?.groupId || null}
        onBlock={() => {
          setProfileViewOpen(false)
          setConfirmBlock(true)
        }}
        onAddMember={() => {
          setProfileViewOpen(false)
          setAddMemberOpen(true)
        }}
        onLeaveGroup={() => {
          setProfileViewOpen(false)
          setConfirmLeave(true)
        }}
      />

      {/* Forward dialog */}
      <ForwardDialog
        open={forwardState.open}
        onClose={() => setForwardState({ open: false, message: null })}
        message={forwardState.message}
      />

      {/* Pinned messages dialog */}
      <PinnedMessagesDialog
        open={pinnedDialogOpen}
        onClose={() => setPinnedDialogOpen(false)}
        conversationId={conversationId}
        onJumpToMessage={handleMessageJump}
        onUnpinned={async (messageId) => {
          // Update the local message's pinnedAt to null so the bubble
          // loses its pin badge immediately.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, pinnedAt: null } : m
            )
          )
          // Refresh the pinned-messages bar.
          await loadPinned()
        }}
      />

      {/* Confirm dialogs */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear chat?</DialogTitle>
            <DialogDescription>
              This will hide all messages in this conversation on this device. Other
              members will still see them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearNow}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave group?</DialogTitle>
            <DialogDescription>
              You will no longer be able to send or receive messages in this group. You
              can rejoin if you have an invite link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveGroup}>
              <LogOut className="h-4 w-4" /> Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Block {conversation?.otherUser?.name || 'user'}?</DialogTitle>
            <DialogDescription>
              They won&apos;t be able to message you, find you in search, or see your
              profile. You can unblock later from Settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmBlock(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBlock}>
              <Ban className="h-4 w-4" /> Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile / Group Info dialog — opened by clicking the header name/avatar.
// For private chats: fetches the other user's public profile.
// For group chats: fetches the group's details + members list.
// ---------------------------------------------------------------------------

interface ProfileViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isGroup: boolean
  name: string
  avatar?: string
  otherUserId?: string | null
  groupId?: string | null
  onBlock: () => void
  onAddMember: () => void
  onLeaveGroup: () => void
}

function ProfileViewDialog({
  open,
  onOpenChange,
  isGroup,
  name,
  avatar,
  otherUserId,
  groupId,
  onBlock,
  onAddMember,
  onLeaveGroup,
}: ProfileViewDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [profile, setProfile] = React.useState<any>(null)
  const [group, setGroup] = React.useState<any>(null)

  // Reset + fetch whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setProfile(null)
    setGroup(null)
    setLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        if (isGroup) {
          if (!groupId) return
          const res: any = await apiFetch(`/api/groups/${groupId}`)
          const g = res?.group || (res?.id ? res : null)
          if (!cancelled) setGroup(g)
        } else {
          if (!otherUserId) return
          const res: any = await apiFetch(`/api/users/${otherUserId}`)
          const u = res?.user || (res?.id ? res : null)
          if (!cancelled) setProfile(u)
        }
      } catch (e: any) {
        if (!cancelled) toast({ title: e?.message || 'Failed to load profile', variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, isGroup, groupId, otherUserId, toast])

  const copyInviteCode = async () => {
    const code = group?.inviteCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      toast({ title: 'Invite code copied', description: code })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const myRole = group?.myRole
  const canManageGroup = myRole === 'owner' || myRole === 'admin'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isGroup ? 'Group info' : 'Profile'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isGroup ? (
          <GroupInfoBody
            group={group}
            name={name}
            avatar={avatar}
            canManage={canManageGroup}
            currentUserId={user?.id}
            onAddMember={onAddMember}
            onLeaveGroup={onLeaveGroup}
            onCopyInviteCode={copyInviteCode}
          />
        ) : (
          <UserProfileBody
            profile={profile}
            name={name}
            avatar={avatar}
            onMessage={() => onOpenChange(false)}
            onBlock={onBlock}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function UserProfileBody({
  profile,
  name,
  avatar,
  onMessage,
  onBlock,
}: {
  profile: any
  name: string
  avatar?: string
  onMessage: () => void
  onBlock: () => void
}) {
  const display = profile || {}
  const avatarUrl = display.avatar || avatar
  const displayName = display.name || name || 'User'
  const username = display.username || ''
  const bio = display.bio || ''
  const isPremium = !!display.isPremium
  const isOnline = !!display.isOnline
  const lastSeen = display.lastSeen
  const createdAt = display.createdAt

  return (
    <div className="space-y-4">
      {/* Avatar + name block */}
      <div className="flex flex-col items-center gap-3 text-center">
        <PremiumAvatar
          user={{
            isPremium: display.isPremium,
            premiumTier: display.premiumTier,
            avatar: avatarUrl || undefined,
            name: displayName,
          }}
          size={96}
          showAura
        />
        <div>
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-bold">{displayName}</h3>
            {isPremium && (
              <span className="premium-badge">
                <Crown className="h-3 w-3" /> Premium
              </span>
            )}
          </div>
          {username && (
            <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <AtSign className="h-3 w-3" />
              {username}
            </p>
          )}
        </div>
      </div>

      {/* Online status */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-muted-foreground'
          }`}
        />
        {isOnline ? 'Online' : lastSeen ? `Last seen ${formatDate(new Date(lastSeen), 'dd MMM yyyy')}` : 'Offline'}
      </div>

      {/* Bio */}
      {bio ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          {bio}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/10 p-3 text-center text-sm italic text-muted-foreground">
          No bio
        </div>
      )}

      {/* Joined date */}
      {createdAt && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CalendarIcon className="h-3 w-3" />
          Joined {formatDate(new Date(createdAt), 'MMM yyyy')}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={onMessage} className="btn-brand min-h-[44px] flex-1">
          <MessageCircle className="h-4 w-4" /> Message
        </Button>
        <Button
          variant="outline"
          onClick={onBlock}
          className="min-h-[44px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Ban className="h-4 w-4" /> Block
        </Button>
      </div>
    </div>
  )
}

function GroupInfoBody({
  group,
  name,
  avatar,
  canManage,
  currentUserId,
  onAddMember,
  onLeaveGroup,
  onCopyInviteCode,
}: {
  group: any
  name: string
  avatar?: string
  canManage: boolean
  currentUserId?: string
  onAddMember: () => void
  onLeaveGroup: () => void
  onCopyInviteCode: () => void
}) {
  const g = group || {}
  const logo = g.logo || avatar
  const groupName = g.name || name || 'Group'
  const description = g.description || ''
  const category = g.category || ''
  const membersCount = g.membersCount ?? (Array.isArray(g.members) ? g.members.length : 0)
  const members: any[] = Array.isArray(g.members) ? g.members : []
  const inviteCode = g.inviteCode || ''
  const isPublic = g.isPublic

  return (
    <ScrollArea className="max-h-[80dvh]">
      <div className="space-y-4 pr-2">
        {/* Logo + name */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="h-20 w-20 border-2 border-primary/30">
            {logo && <AvatarImage src={logo} alt={groupName} />}
            <AvatarFallback className="bg-primary/15 text-xl font-bold text-primary">
              {groupName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-lg font-bold">{groupName}</h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isPublic
                    ? 'bg-primary/10 text-primary'
                    : 'bg-amber-500/15 text-amber-600'
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                {isPublic ? 'Public' : 'Private'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {membersCount} {membersCount === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>

        {/* Description */}
        {description ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            {description}
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/10 p-3 text-center text-sm italic text-muted-foreground">
            No description
          </div>
        )}

        {/* Category */}
        {category && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <BadgeCheck className="h-3 w-3 text-primary" />
            {category}
          </div>
        )}

        {/* Members list */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Members ({members.length})
          </p>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map((m: any) => {
                const u = m.user || {}
                const role = m.role
                const isOwner = role === 'owner'
                const isAdmin = role === 'admin'
                return (
                  <li
                    key={m.id || u.id || `${m.userId}-${role}`}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <PremiumAvatar
                      user={{
                        isPremium: u.isPremium,
                        premiumTier: (u as any).premiumTier,
                        avatar: u.avatar || undefined,
                        name: u.name || u.username || 'U',
                      }}
                      size={32}
                      showAura={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {u.name || u.username || 'User'}
                        {u.id === currentUserId && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        <Crown className="h-3 w-3" /> Owner
                      </span>
                    ) : isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <BadgeCheck className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Member
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {canManage && (
            <Button onClick={onAddMember} className="btn-brand min-h-[44px] flex-1">
              <UserPlus className="h-4 w-4" /> Add member
            </Button>
          )}
          {canManage && inviteCode && (
            <Button
              variant="outline"
              onClick={onCopyInviteCode}
              className="min-h-[44px] flex-1"
            >
              <Copy className="h-4 w-4" /> Invite code
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onLeaveGroup}
            className="min-h-[44px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Leave
          </Button>
        </div>

        {inviteCode && (
          <p className="text-center text-xs text-muted-foreground">
            Invite code: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{inviteCode}</code>
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
