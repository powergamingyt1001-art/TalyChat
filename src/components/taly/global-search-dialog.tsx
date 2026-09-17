'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, MessageCircle, User, Users, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { PremiumAvatar } from '@/components/premium-avatar'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'message' | 'user' | 'group'
  name?: string
  username?: string
  avatar?: string
  content?: string
  conversationId?: string
  conversationType?: string
  otherUserId?: string
  createdAt?: string
  membersCount?: number
  category?: string
  isPremium?: boolean
  premiumTier?: string
  isOnline?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onOpenChat: (conv: { conversationId: string; name: string; avatar?: string; isGroup?: boolean }) => void
}

export function GlobalSearchDialog({ open, onClose, onOpenChat }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ messages: SearchResult[]; users: SearchResult[]; groups: SearchResult[] }>({
    messages: [],
    users: [],
    groups: [],
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'people' | 'groups'>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults({ messages: [], users: [], groups: [] })
      setActiveTab('all')
    }
  }, [open])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults({ messages: [], users: [], groups: [] })
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const [msgRes, userRes, groupRes] = await Promise.all([
          apiFetch(`/api/messages/search?q=${encodeURIComponent(query)}`).catch(() => ({ results: [] })),
          apiFetch(`/api/users/search?q=${encodeURIComponent(query)}`).catch(() => ({ users: [] })),
          apiFetch(`/api/discover?sort=trending`).catch(() => ({ groups: [] })),
        ])
        const messages = (msgRes?.results || []).slice(0, 10)
        const users = ((userRes?.users || []) as any[]).slice(0, 10).map((u) => ({ ...u, type: 'user' as const }))
        const allGroups = (groupRes?.groups || []) as any[]
        const groups = allGroups
          .filter((g) => g.name?.toLowerCase().includes(query.toLowerCase()) || g.category?.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10)
          .map((g) => ({ ...g, type: 'group' as const }))
        setResults({ messages, users, groups })
      } catch {
        setResults({ messages: [], users: [], groups: [] })
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleOpenMessage = (r: SearchResult) => {
    if (r.conversationId) {
      onOpenChat({
        conversationId: r.conversationId,
        name: r.conversationName || r.name || 'Chat',
        avatar: r.conversationAvatar,
        isGroup: r.conversationType === 'group',
      })
      onClose()
    }
  }

  const handleOpenUser = async (r: SearchResult) => {
    // Start a chat request with this user
    try {
      const res: any = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: 'private', participantId: r.id }),
      })
      const conv = res?.conversation || res
      if (conv?.id) {
        onOpenChat({
          conversationId: conv.id,
          name: r.name || r.username || 'Chat',
          avatar: r.avatar,
          isGroup: false,
        })
        onClose()
      }
    } catch {
      // Fallback: just close
      onClose()
    }
  }

  const handleOpenGroup = (r: SearchResult) => {
    if (r.id) {
      onOpenChat({
        conversationId: r.id,
        name: r.name || 'Group',
        avatar: r.logo || r.avatar,
        isGroup: true,
      })
      onClose()
    }
  }

  const totalCount = results.messages.length + results.users.length + results.groups.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <DialogDescription className="sr-only">Search messages, people, and groups across TalyChat</DialogDescription>
        
        {/* Search header */}
        <div className="border-b p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, people, or groups…"
              className="h-12 rounded-full pl-10 pr-10 text-base"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-accent"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Filter tabs */}
          {totalCount > 0 && (
            <div className="mt-3 flex gap-1">
              {([
                { id: 'all', label: `All (${totalCount})` },
                { id: 'messages', label: `Messages (${results.messages.length})` },
                { id: 'people', label: `People (${results.users.length})` },
                { id: 'groups', label: `Groups (${results.groups.length})` },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[60dvh]">
          <div className="p-2">
            {!query.trim() && (
              <div className="dotted-bg flex flex-col items-center justify-center rounded-xl py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">Search across TalyChat</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Find messages, people, and groups</p>
              </div>
            )}

            {query.trim() && !loading && totalCount === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No results for "{query}"</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Try a different search term</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {/* Messages section */}
            {!loading && (activeTab === 'all' || activeTab === 'messages') && results.messages.length > 0 && (
              <div className="mb-2">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Messages</h3>
                {results.messages.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleOpenMessage(r)}
                    className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.sender?.name || 'Unknown'}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.content}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        in {r.conversationName || 'chat'} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* People section */}
            {!loading && (activeTab === 'all' || activeTab === 'people') && results.users.length > 0 && (
              <div className="mb-2">
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</h3>
                {results.users.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleOpenUser(r)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-accent"
                  >
                    <PremiumAvatar
                      user={{ isPremium: r.isPremium, premiumTier: r.premiumTier, avatar: r.avatar, name: r.name || r.username || '?', id: r.id || undefined, username: r.username || undefined }}
                      size={40}
                      isOnline={r.isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">@{r.username}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Groups section */}
            {!loading && (activeTab === 'all' || activeTab === 'groups') && results.groups.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Groups</h3>
                {results.groups.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleOpenGroup(r)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(r.name || '?')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.membersCount || 0} members · {r.category}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
