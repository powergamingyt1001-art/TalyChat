'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Lock, Search, Users, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@/components/taly-app'

interface GroupsProps {
  conversations: ConversationSummary[]
  onOpenChat: (c: ConversationSummary) => void
  onRefresh: () => void
  // R8-11 — Find button: navigates to the Discover tab so the user can
  // browse / join communities instead of creating a new one from this tab.
  onOpenDiscover?: () => void
}

interface SentRequest {
  id: string
  groupId: string
  message: string
  status: string
  createdAt: string
  decidedAt: string | null
  group: {
    id: string
    name: string
    logo?: string | null
    category?: string | null
    isPublic: boolean
    membersCount: number
    inviteCode: string
    ownerId: string
  }
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
  if (!last) return 'No messages yet'
  if (last.deletedAt) return '🚫 Message deleted'
  if (last.type === 'image') return '📷 Photo'
  if (last.type === 'voice') return '🎤 Voice'
  if (last.type === 'sticker') return '😊 Sticker'
  return last.content || 'No messages yet'
}

function groupLogo(c: ConversationSummary): string | undefined {
  // Prefer group's own logo, then conversation avatar, fall back to undefined.
  if (c.group?.logo) return c.group.logo
  if (c.avatar) return c.avatar
  return undefined
}

export function GroupsScreen({ conversations, onOpenChat, onRefresh, onOpenDiscover }: GroupsProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'private' | 'requests'>('all')
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  // Only group conversations are shown on the Groups tab.
  const groupConversations = useMemo(
    () => conversations.filter((c) => c.type === 'group'),
    [conversations],
  )

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':
        return groupConversations.filter((c) => (c.unread || 0) > 0)
      case 'private':
        // Private groups the user has joined.
        return groupConversations.filter((c) => c.group?.isPublic === false)
      case 'requests':
        // Requests tab is rendered separately below.
        return []
      default:
        return groupConversations
    }
  }, [filter, groupConversations])

  const loadSentRequests = async () => {
    setRequestsLoading(true)
    try {
      const res: any = await apiFetch('/api/groups/requests/sent')
      const list: SentRequest[] = Array.isArray(res)
        ? res
        : (res?.requests || res?.items || [])
      setSentRequests(list)
    } catch {
      setSentRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (filter === 'requests') {
      loadSentRequests()
    }
  }, [filter])

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="section-header">Groups</h1>
        {/* R8-11 — Find button replaces the old Create button + FAB.
            Tapping it navigates the user to the Discover tab so they can
            browse and join existing communities. */}
        <Button
          onClick={() => (onOpenDiscover ? onOpenDiscover() : undefined)}
          disabled={!onOpenDiscover}
          className="btn-brand min-h-[44px]"
        >
          <Search className="h-4 w-4" /> Find
        </Button>
      </div>

      {/* Tabs: All / Unread / Private / Requests — segmented control */}
      <div className="mt-4">
        <div className="segmented-control w-full">
          {(['all', 'unread', 'private', 'requests'] as const).map((id) => {
            const active = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn('flex-1 capitalize', active ? 'active' : '')}
              >
                {id}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4 space-y-2">
        {filter === 'requests' ? (
          <RequestsTab
            requests={sentRequests}
            loading={requestsLoading}
            onRefresh={loadSentRequests}
            onOpenChat={onOpenChat}
            conversations={groupConversations}
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {filter === 'unread'
              ? 'No unread groups 🎉'
              : filter === 'private'
                ? 'You haven’t joined any private groups yet.'
                : 'You haven’t joined any groups yet. Tap “Find” above to discover communities.'}
          </div>
        ) : (
          filtered.map((c) => {
            const g = c.group
            const memberCount = g?.membersCount || 0
            const last = c.lastMessage
            const preview = messagePreview(last)
            const isPrivate = g?.isPublic === false
            return (
              <button
                key={c.id}
                onClick={() => onOpenChat(c)}
                className="chat-list-item taly-card taly-card-hover w-full border border-border text-left"
              >
                {/* Stacked member avatars — 2-3 small overlapping letter avatars + "+N" */}
                <StackedGroupAvatars
                  logo={groupLogo(c)}
                  name={c.name}
                  memberCount={memberCount}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1 truncate text-[15px] font-semibold">
                      {isPrivate && (
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(last?.createdAt || c.updatedAt)}
                    </span>
                  </div>
                  {/* Member count sub-text with Users icon */}
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span className="font-medium text-foreground/80">{memberCount} members</span>
                    {last && <span className="truncate"> · {preview}</span>}
                  </p>
                </div>
                {(c.unread || 0) > 0 && (
                  <span className="unread-badge shrink-0">
                    {(c.unread || 0) > 99 ? '99+' : c.unread}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ============================================================
// StackedGroupAvatars — shows 2-3 overlapping small letter avatars
// representing the group's members. Falls back to the group's logo
// avatar as the topmost avatar when available. Shows "+N" when
// memberCount > 3.
// ============================================================
function StackedGroupAvatars({
  logo,
  name,
  memberCount,
}: {
  logo?: string
  name: string
  memberCount: number
}) {
  // Generate up to 3 distinct "member" initials from the group name.
  const baseName = name || 'G'
  const initials = (baseName.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean))
  const derived: string[] = []
  for (let i = 0; i < initials.length && derived.length < 3; i++) {
    derived.push(initials[i][0]?.toUpperCase() || 'U')
  }
  // Pad with the group's own initial + generic dots until we have 3 entries.
  while (derived.length < 3) {
    derived.push(baseName[0]?.toUpperCase() || 'U')
  }
  const visible = derived.slice(0, 3)
  // "+N" overflow chip — show extra member count beyond the 3 visible.
  const extra = Math.max(0, memberCount - 3)

  // Color palette per slot — emerald, amber, sky for variety.
  const slotClass = (i: number) => {
    switch (i % 3) {
      case 0:
        return 'bg-emerald-500/15 text-emerald-600'
      case 1:
        return 'bg-amber-500/15 text-amber-600'
      default:
        return 'bg-sky-500/15 text-sky-600'
    }
  }

  return (
    <div className="relative flex shrink-0 items-center" aria-hidden>
      <div className="relative flex h-10 w-14 items-center">
        {visible.map((letter, i) => {
          const z = visible.length - i // back→front
          const offset = i * 14 // 14px stagger, overlap 6px on 20px avatars
          return (
            <div
              key={i}
              className={cn(
                'absolute flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card',
                slotClass(i),
              )}
              style={{ left: `${offset}px`, zIndex: z }}
            >
              {i === 0 && logo ? (
                <img
                  src={logo}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                letter
              )}
            </div>
          )
        })}
        {extra > 0 && (
          <span
            className="absolute -right-1 top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground ring-2 ring-card"
            style={{ zIndex: visible.length + 1 }}
          >
            +{extra > 99 ? '99' : extra}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Requests tab — shows pending join requests the user has SENT
// ============================================================

function RequestsTab({
  requests,
  loading,
  onRefresh,
  conversations,
}: {
  requests: SentRequest[]
  loading: boolean
  onRefresh: () => void
  onOpenChat: (c: ConversationSummary) => void
  conversations: ConversationSummary[]
}) {
  // Defensive: only show pending requests by default.
  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading requests…
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No pending requests. When you ask to join a private group, it will appear here.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending ({pending.length})
          </p>
          {pending.map((r) => (
            <SentRequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
      {decided.length > 0 && (
        <div className="space-y-2">
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent decisions
          </p>
          {decided.map((r) => (
            <SentRequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="mt-2 min-h-[36px] w-full"
      >
        Refresh
      </Button>
      {/* conversations unused intentionally — kept for future "open chat" action */}
      <span className="hidden">{conversations.length}</span>
    </div>
  )
}

function SentRequestCard({ request }: { request: SentRequest }) {
  const g = request.group
  const statusLabel =
    request.status === 'pending'
      ? 'Pending'
      : request.status === 'accepted'
        ? 'Accepted'
        : 'Rejected'
  const badgeClass =
    request.status === 'pending'
      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
      : request.status === 'accepted'
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
        : 'bg-destructive/10 text-destructive border-destructive/30'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar className="h-10 w-10 rounded-lg">
        <AvatarImage src={g?.logo || undefined} alt={g?.name} />
        <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
          {(g?.name || '?')[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-semibold">{g?.name}</p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {g?.membersCount || 0} members · {g?.category || 'Group'}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Sent {relativeTime(request.createdAt)}
        </p>
      </div>
      <Badge variant="outline" className={badgeClass}>
        {statusLabel}
      </Badge>
    </div>
  )
}

