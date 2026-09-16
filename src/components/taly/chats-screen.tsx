'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  X,
  Check,
  Bell,
  MessageSquare,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { PremiumAvatar } from '@/components/premium-avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConversationSummary } from '@/components/taly-app'

interface ChatsProps {
  conversations: ConversationSummary[]
  onOpenChat: (c: ConversationSummary) => void
  onRefresh: () => void
}

type FilterTab = 'all' | 'unread' | 'requests'

interface ChatRequestItem {
  id: string
  senderId: string
  receiverId: string
  message?: string | null
  status: string
  createdAt: string
  sender: {
    id: string
    username?: string
    name?: string
    avatar?: string | null
    bio?: string | null
    isOnline?: boolean
    isPremium?: boolean
    lastSeen?: string | null
  }
}

function convAvatar(c: ConversationSummary): string | undefined {
  if (c.avatar) return c.avatar
  if (c.otherUser?.avatar) return c.otherUser.avatar
  return undefined
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

function messagePreview(last: any): string {
  if (!last) return 'Say hi 👋'
  if (last.deletedAt) return '🚫 Message deleted'
  if (last.type === 'image') return '📷 Photo'
  if (last.type === 'voice') return '🎤 Voice message'
  if (last.type === 'sticker') return '😊 Sticker'
  return last.content || 'Say hi 👋'
}

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'requests', label: 'Requests' },
]

export function ChatsScreen({ conversations, onOpenChat, onRefresh }: ChatsProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)

  // Chat requests state (for the Requests tab)
  const [requests, setRequests] = useState<ChatRequestItem[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res: any = await apiFetch('/api/chat-requests')
      // Defensive: API returns { requests: [...] }, fall back to bare array.
      const list: ChatRequestItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.requests)
          ? res.requests
          : Array.isArray(res?.items)
            ? res.items
            : []
      setRequests(list)
    } catch {
      // Silent fail — list just stays empty
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  // Load requests on mount + whenever this screen is opened
  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const filtered = useMemo(() => {
    let list = conversations
    if (filter === 'unread') list = list.filter((c) => c.unread && c.unread > 0)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((c) => (c.name || '').toLowerCase().includes(q))
    }
    return list
  }, [conversations, filter, query])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([onRefresh(), loadRequests()])
    } finally {
      setRefreshing(false)
    }
  }

  const handlePicked = async (u: any) => {
    setNewChatOpen(false)
    // Step 1: check if a conversation already exists with this user
    const existing = conversations.find(
      (c) => c.type === 'private' && c.otherUser?.id === u.id,
    )
    if (existing) {
      // Open the existing conversation directly
      onOpenChat(existing)
      return
    }

    // Step 2: no conversation exists — send a chat request. The other user
    // will see it in their Requests tab and can accept/reject.
    try {
      await apiFetch('/api/chat-requests', {
        method: 'POST',
        body: JSON.stringify({ receiverId: u.id, message: '' }),
      })
      toast({
        title: 'Request sent! Wait for acceptance.',
        description: `${u.name} will be able to start chatting once they accept.`,
      })
      // Refresh the requests list in case the other user previously sent us
      // a pending request that should now be considered.
      loadRequests()
    } catch (e: any) {
      const msg = e?.message || ''
      // 409 means a pending request or existing conversation already exists
      if (msg.includes('pending') || msg.includes('already exists') || e?.status === 409) {
        toast({
          title: 'Chat request already pending',
          description: msg || 'You already have a pending request or conversation with this user.',
        })
      } else {
        toast({
          title: msg || 'Failed to send chat request',
          variant: 'destructive',
        })
      }
    }
  }

  const handleAccept = async (req: ChatRequestItem) => {
    try {
      const res: any = await apiFetch(`/api/chat-requests/${req.id}/accept`, {
        method: 'POST',
      })
      const conv = res?.conversation || (res?.id ? res : null)
      // Remove the accepted request from the local list
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      toast({ title: 'Request accepted', description: 'You can now chat.' })
      if (conv) {
        onOpenChat({
          id: conv.id,
          type: 'private',
          name: conv.name || req.sender.name || req.sender.username || 'User',
          avatar: conv.avatar || req.sender.avatar,
          otherUser: req.sender,
          updatedAt: conv.updatedAt,
        } as ConversationSummary)
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to accept', variant: 'destructive' })
    }
  }

  const handleReject = async (req: ChatRequestItem) => {
    try {
      await apiFetch(`/api/chat-requests/${req.id}/reject`, { method: 'POST' })
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      toast({ title: 'Request rejected' })
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to reject', variant: 'destructive' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 lg:pb-6 lg:pt-8">
      {/* Header — section header style + actions */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between gap-2"
      >
        <h1 className="section-header">Chats</h1>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            aria-label="Refresh"
            className="h-10 w-10 rounded-full hover:bg-accent"
          >
            <RefreshCw className={refreshing ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
          </Button>
          <button
            onClick={() => setNewChatOpen(true)}
            className="action-btn !px-4 !py-2 !text-sm lg:hidden"
            aria-label="New chat"
          >
            <UserPlus className="h-4 w-4" /> New
          </button>
        </div>
      </motion.div>

      {/* Filter tabs — segmented control */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mt-3"
      >
        <div className="segmented-control w-full">
          {FILTERS.map((f) => {
            const active = filter === f.id
            const showBadge = f.id === 'requests' && requests.length > 0
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 ${active ? 'active' : ''}`}
              >
                {f.id === 'requests' && <Bell className="h-3.5 w-3.5" />}
                {f.label}
                {showBadge && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {requests.length > 9 ? '9+' : requests.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Search bar — rounded-full with bg-muted + icon */}
      {filter !== 'requests' && (
        <div className="relative mt-3 animate-fade-in-up">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-full border-border bg-muted/60 pl-10 pr-10 text-sm focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Requests tab content */}
      {filter === 'requests' ? (
        <div className="mt-3 space-y-2">
          {requestsLoading && requests.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="dotted-bg flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No pending chat requests
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                When someone wants to chat with you, they&apos;ll show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="taly-card animate-fade-in-up p-3"
                >
                  <div className="flex items-center gap-3">
                    <PremiumAvatar
                      user={{
                        isPremium: req.sender?.isPremium,
                        premiumTier: (req.sender as any)?.premiumTier,
                        avatar: req.sender?.avatar || undefined,
                        name: req.sender?.name || req.sender?.username || 'U',
                      }}
                      size={44}
                      showAura
                      isOnline={!!req.sender?.isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {req.sender?.name || req.sender?.username || 'User'}
                        </span>
                        <span className="shrink-0 text-[10px] font-light text-muted-foreground">
                          {relativeTime(req.createdAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        @{req.sender?.username || 'user'}
                      </p>
                      {req.message && (
                        <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                          &ldquo;{req.message}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(req)}
                      className="action-btn !min-h-[38px] !px-4 !py-2 flex-1 !text-xs shadow-none"
                    >
                      <Check className="h-3.5 w-3.5" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req)}
                      className="ghost-btn !min-h-[38px] !px-4 !py-2 flex-1 !text-xs"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="dotted-bg flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {filter === 'unread'
                  ? 'No unread chats 🎉'
                  : query.trim()
                    ? 'No conversations match your search.'
                    : 'No conversations yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filter === 'unread'
                  ? 'You&apos;re all caught up. Time to relax.'
                  : query.trim()
                    ? 'Try a different name.'
                    : 'Tap “New” to start chatting with someone.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((c) => {
                const last = c.lastMessage
                const isOnline = !!(c.otherUser as any)?.isOnline
                return (
                  <li key={c.id} className="animate-fade-in-up">
                    <button
                      onClick={() => onOpenChat(c)}
                      className="chat-list-item taly-card taly-card-hover w-full border-none !p-2.5 text-left"
                    >
                      <PremiumAvatar
                        user={{
                          isPremium: (c.otherUser as any)?.isPremium,
                          premiumTier: (c.otherUser as any)?.premiumTier,
                          avatar: convAvatar(c),
                          name: c.name || c.otherUser?.name || '?',
                        }}
                        size={44}
                        showAura
                        isOnline={isOnline}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-sm ${c.unread ? 'font-bold' : 'font-semibold'}`}
                          >
                            {c.name || c.otherUser?.name || c.otherUser?.username || 'Unnamed'}
                          </span>
                          <span className="shrink-0 text-[10px] font-light text-muted-foreground">
                            {relativeTime(last?.createdAt || c.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {messagePreview(last)}
                          </p>
                          {c.unread ? (
                            <span className="unread-badge shrink-0">
                              {c.unread > 99 ? '99+' : c.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {/* Floating new-chat button — mobile only */}
      <button
        onClick={() => setNewChatOpen(true)}
        aria-label="New chat"
        className="action-btn fixed bottom-24 right-5 z-30 h-14 w-14 !rounded-full !p-0 shadow-xl lg:hidden"
      >
        <UserPlus className="h-6 w-6" />
      </button>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onPicked={handlePicked}
      />
    </div>
  )
}

function NewChatDialog({
  open,
  onClose,
  onPicked,
}: {
  open: boolean
  onClose: () => void
  onPicked: (u: any) => void
}) {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQ('')
      setUsers([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setUsers([])
        return
      }
      setLoading(true)
      try {
        const res: any = await apiFetch(
          `/api/users/search?q=${encodeURIComponent(q.trim())}`,
        )
        // Defensive: API returns { users: [...] }, but fall back to bare array.
        const list: any[] = Array.isArray(res)
          ? res
          : res?.users || res?.items || []
        if (!cancelled) setUsers(list)
      } catch (e: any) {
        if (!cancelled) toast({ title: e?.message || 'Search failed', variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, q])

  const handlePick = (u: any) => {
    setStarting(u.id)
    try {
      onPicked(u)
    } finally {
      setStarting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search by username or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="scroll-pan-y max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {q.trim() ? 'No users found.' : 'Type to search for someone to chat with.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => handlePick(u)}
                    disabled={starting === u.id}
                    className="chat-list-item w-full border-none !p-2 text-left hover:bg-accent disabled:opacity-50"
                  >
                    <PremiumAvatar
                      user={{
                        isPremium: u.isPremium,
                        premiumTier: (u as any).premiumTier,
                        avatar: u.avatar || undefined,
                        name: u.name || 'U',
                      }}
                      size={40}
                      showAura={false}
                      isOnline={!!u.isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    {starting === u.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Starting a chat with someone new sends them a request. They&apos;ll
          appear in your chats once accepted.
        </p>
      </DialogContent>
    </Dialog>
  )
}
