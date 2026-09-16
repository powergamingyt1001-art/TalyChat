'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw, Search, UserPlus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

export function ChatsScreen({ conversations, onOpenChat, onRefresh }: ChatsProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)

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
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handlePicked = async (u: any) => {
    setNewChatOpen(false)
    try {
      const res: any = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: 'private', participantId: u.id }),
      })
      // Defensive: API returns { conversation: {...} }, but fall back to flat
      // object just in case the shape changes.
      const conv = res?.conversation || (res?.id ? res : null)
      if (conv) {
        onOpenChat({
          id: conv.id,
          type: 'private',
          name: conv.name || u.name,
          avatar: conv.avatar || u.avatar,
          otherUser: u,
          updatedAt: conv.updatedAt,
        } as ConversationSummary)
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to start chat', variant: 'destructive' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Chats</h1>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            aria-label="Refresh"
            className="h-9 w-9"
          >
            <RefreshCw className={refreshing ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
          </Button>
          <Button onClick={() => setNewChatOpen(true)} className="btn-brand min-h-[44px]">
            <UserPlus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as 'all' | 'unread')}
        className="mt-3"
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1">
            Unread
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {filter === 'unread'
              ? 'No unread chats 🎉'
              : query.trim()
                ? 'No conversations match your search.'
                : 'No conversations yet. Tap “New” to start chatting.'}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((c) => {
              const last = c.lastMessage
              return (
                <li key={c.id}>
                  <button
                    onClick={() => onOpenChat(c)}
                    className="flex w-full min-h-[64px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={convAvatar(c)} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(c.name || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{c.name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(last?.createdAt || c.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {messagePreview(last)}
                      </p>
                    </div>
                    {c.unread === 1 ? (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                    ) : c.unread && c.unread > 1 ? (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {c.unread > 99 ? '99+' : c.unread}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

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
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(u.name || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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
      </DialogContent>
    </Dialog>
  )
}
