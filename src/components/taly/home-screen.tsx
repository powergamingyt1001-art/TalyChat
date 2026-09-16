'use client'

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Bot,
  ChevronRight,
  Compass,
  Gift,
  Info,
  MessageCircle,
  MessageSquare,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PremiumAvatar } from '@/components/premium-avatar'
import { Button } from '@/components/ui/button'
import type { ConversationSummary } from '@/components/taly-app'
import {
  StoriesRow,
  type StoriesGroup,
  type StoryAuthor,
  type StoryItem,
} from '@/components/taly/stories-row'
import { StoryViewerDialog } from '@/components/taly/story-viewer-dialog'
import { CreateStoryDialog } from '@/components/taly/create-story-dialog'
import { GlobalSearchDialog } from '@/components/taly/global-search-dialog'

interface HomeProps {
  user: any
  onOpenChat: (c: ConversationSummary) => void
  onNavigate: (tab: any) => void
  onOpenTaly: () => void
  onOpenCreateStory?: () => void
  storiesSignal?: number
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

function convAvatar(c: any): string | undefined {
  if (c.avatar) return c.avatar
  if (c.type === 'private' && c.otherUser?.avatar) return c.otherUser.avatar
  if (c.type === 'group' && c.group?.logo) return c.group.logo
  return undefined
}

// Greeting based on the user's local hour
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

// Notification type → icon + tint
function notifMeta(type?: string): { Icon: any; tint: string } {
  switch ((type || '').toLowerCase()) {
    case 'message':
    case 'chat':
      return { Icon: MessageSquare, tint: 'text-emerald-600 bg-emerald-500/10' }
    case 'group':
    case 'join':
      return { Icon: Users, tint: 'text-blue-600 bg-blue-500/10' }
    case 'reward':
    case 'daily':
      return { Icon: Gift, tint: 'text-amber-600 bg-amber-500/10' }
    case 'referral':
    case 'invite':
      return { Icon: Share2, tint: 'text-purple-600 bg-purple-500/10' }
    case 'system':
    default:
      return { Icon: Info, tint: 'text-muted-foreground bg-muted' }
  }
}

// Category → ring color for trending community avatars
function categoryColor(cat?: string | null): string {
  switch ((cat || '').toLowerCase()) {
    case 'gaming':
      return 'ring-violet-400'
    case 'technology':
    case 'ai':
      return 'ring-blue-400'
    case 'cricket':
    case 'sports':
      return 'ring-orange-400'
    case 'entertainment':
    case 'movies':
    case 'music':
      return 'ring-pink-400'
    case 'education':
      return 'ring-emerald-400'
    case 'business':
    case 'finance':
    case 'jobs':
      return 'ring-yellow-400'
    default:
      return 'ring-emerald-400'
  }
}

export function HomeScreen({ user, onOpenChat, onNavigate, onOpenTaly, onOpenCreateStory, storiesSignal }: HomeProps) {
  const [chats, setChats] = useState<ConversationSummary[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [trending, setTrending] = useState<any[]>([])
  const [ad, setAd] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Stories state
  const [myStories, setMyStories] = useState<StoryItem[]>([])
  const [friendsStories, setFriendsStories] = useState<StoriesGroup[]>([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUserId, setViewerUserId] = useState<string | null>(null)
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const refreshStories = React.useCallback(async () => {
    setStoriesLoading(true)
    try {
      const res: any = await apiFetch('/api/stories')
      setMyStories((res?.myStories as StoryItem[]) || [])
      setFriendsStories((res?.friends as StoriesGroup[]) || [])
    } catch {
      // silent — stories are non-critical
    } finally {
      setStoriesLoading(false)
    }
  }, [])

  // Fetch stories on mount + when storiesSignal changes (e.g. socket push)
  useEffect(() => {
    refreshStories()
  }, [refreshStories, storiesSignal])

  const handleOpenStory = (userId: string, storyIndex: number) => {
    setViewerUserId(userId)
    setViewerInitialIndex(storyIndex)
    setViewerOpen(true)
  }

  const handleAddStory = () => {
    // Use parent handler if provided (so the same dialog can be triggered
    // from the top bar). Otherwise open the local instance.
    if (onOpenCreateStory) {
      onOpenCreateStory()
    } else {
      setCreateOpen(true)
    }
  }

  // Compose the active "all stories" list for the viewer (myStories +
  // friends, with the author attached to my stories)
  const myAuthor: StoryAuthor = React.useMemo(
    () => ({
      id: user?.id || 'me',
      name: user?.name || 'Me',
      username: user?.username,
      avatar: user?.avatar || null,
      isPremium: !!user?.isPremium,
      premiumTier: user?.premiumTier,
    }),
    [user]
  )

  const allStoriesForViewer: StoriesGroup[] = React.useMemo(() => {
    const myGroup: StoriesGroup | null =
      myStories.length > 0
        ? { user: myAuthor, stories: myStories, hasUnviewed: false }
        : null
    return [...(myGroup ? [myGroup] : []), ...friendsStories]
  }, [myStories, myAuthor, friendsStories])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [convRes, notifRes, discRes, adsRes] = await Promise.all([
          apiFetch('/api/conversations').catch(() => null),
          apiFetch('/api/notifications').catch(() => null),
          apiFetch('/api/discover?sort=trending').catch(() => null),
          apiFetch('/api/ads?placement=home').catch(() => null),
        ])
        if (cancelled) return
        // Defensive unwrapping: works whether the API returns a wrapped object
        // (e.g. { conversations: [...] }) or a bare array.
        const convList: any[] = Array.isArray(convRes)
          ? convRes
          : convRes?.conversations || convRes?.items || []
        const notifList: any[] = Array.isArray(notifRes)
          ? notifRes
          : notifRes?.notifications || notifRes?.items || []
        const discList: any[] = Array.isArray(discRes)
          ? discRes
          : discRes?.groups || discRes?.items || []
        const adsList: any[] = Array.isArray(adsRes)
          ? adsRes
          : adsRes?.ads || adsRes?.items || (adsRes?.ad ? [adsRes.ad] : [])
        const privates: ConversationSummary[] = convList
          .filter((c) => c.type === 'private')
          .slice(0, 5)
        setChats(privates)
        setNotifications(notifList.slice(0, 3))
        setTrending(discList.slice(0, 3))
        setAd(adsList[0] || null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (user?.name || '').split(' ')[0] || 'Friend'

  const quickActions = useMemo(
    () =>
      [
        {
          id: 'chats',
          label: 'Chats',
          icon: MessageCircle,
          tint: 'from-emerald-500/15 to-emerald-500/5',
          iconColor: 'from-emerald-500 to-emerald-600',
          ring: 'group-hover:shadow-emerald-500/20',
          onClick: () => onNavigate('chats'),
        },
        {
          id: 'groups',
          label: 'Groups',
          icon: Users,
          tint: 'from-blue-500/15 to-blue-500/5',
          iconColor: 'from-blue-500 to-blue-600',
          ring: 'group-hover:shadow-blue-500/20',
          onClick: () => onNavigate('groups'),
        },
        {
          id: 'discover',
          label: 'Discover',
          icon: Compass,
          tint: 'from-purple-500/15 to-purple-500/5',
          iconColor: 'from-purple-500 to-purple-600',
          ring: 'group-hover:shadow-purple-500/20',
          onClick: () => onNavigate('discover'),
        },
        {
          id: 'taly',
          label: 'Ask Taly',
          icon: Bot,
          tint: 'from-amber-500/15 to-amber-500/5',
          iconColor: 'from-amber-500 to-amber-600',
          ring: 'group-hover:shadow-amber-500/20',
          onClick: onOpenTaly,
        },
      ] as const,
    [onNavigate, onOpenTaly],
  )

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 lg:pb-6 lg:pt-8">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-muted-foreground font-medium">{greeting()},</span>{' '}
          {firstName} <span className="inline-block animate-[wave_1.8s_ease-in-out_infinite]">👋</span>
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </motion.div>

      {/* Global search bar */}
      <motion.button
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onClick={() => setSearchOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-full border bg-muted/50 px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:bg-muted hover:shadow-md"
      >
        <Search className="h-4 w-4 text-primary" />
        <span>Search messages, people, or groups…</span>
      </motion.button>

      {/* Hero banner — contextual action card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="glass-card relative mt-4 overflow-hidden rounded-2xl p-5"
      >
        {/* Subtle emerald gradient overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'linear-gradient(135deg, oklch(0.78 0.18 152 / 0.18) 0%, oklch(0.65 0.20 160 / 0.08) 50%, transparent 100%)',
          }}
        />
        {/* Decorative blurred orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/30 blur-2xl"
        />
        <div className="relative flex items-center gap-4">
          {/* Bot avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/30">
            <Bot className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Taly AI Assistant
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              Ask me anything about TalyChat ✨
            </p>
          </div>
          <button
            onClick={onOpenTaly}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-md ring-1 ring-emerald-500/10 transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" /> Ask
          </button>
        </div>
      </motion.div>

      {/* Stories row */}
      <StoriesRow
        myStoryAuthor={myAuthor}
        myStories={myStories}
        friends={friendsStories}
        onOpenStory={handleOpenStory}
        onAddStory={handleAddStory}
        loading={storiesLoading}
      />

      {/* Recent private chats */}
      <section className="mt-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center justify-between">
          <h2 className="section-header">Recent Chats</h2>
          <button
            onClick={() => onNavigate('chats')}
            className="flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            See all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 space-y-1.5">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="taly-card flex items-center gap-3 p-3"
              >
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : chats.length === 0 ? (
            <div className="dotted-bg rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No conversations yet. Find someone to chat with in Discover.
              </p>
            </div>
          ) : (
            chats.map((c) => {
              const isOnline = !!(c.otherUser as any)?.isOnline
              const hasUnread = !!(c.unread && c.unread > 0)
              const last = c.lastMessage
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenChat(c)}
                  className={`chat-list-item taly-card taly-card-hover w-full border-none !p-2.5 text-left ${
                    hasUnread ? '!bg-emerald-50 dark:!bg-emerald-950/20' : ''
                  }`}
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
                        className={`truncate text-sm ${
                          hasUnread ? 'font-semibold' : 'font-normal'
                        }`}
                      >
                        {c.name ||
                          c.otherUser?.name ||
                          c.otherUser?.username ||
                          'Unnamed'}
                      </span>
                      <span className="shrink-0 text-[10px] font-light text-muted-foreground">
                        {relativeTime(last?.createdAt || c.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          hasUnread
                            ? 'font-medium text-foreground'
                            : 'font-normal text-muted-foreground'
                        }`}
                      >
                        {last?.content || 'Say hi 👋'}
                      </p>
                      {hasUnread ? (
                        <span className="unread-badge shrink-0">
                          {(c.unread as number) > 99 ? '99+' : c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>

      {/* Notifications */}
      {notifications.length > 0 && (
        <section
          className="mt-6 animate-fade-in-up"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="section-header">Notifications</h2>
          </div>
          <div className="mt-2 space-y-1.5">
            {notifications.map((n) => {
              const { Icon, tint } = notifMeta(n.type)
              return (
                <div key={n.id} className="taly-card flex items-start gap-3 p-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Trending communities */}
      <section
        className="mt-6 animate-fade-in-up"
        style={{ animationDelay: '0.15s' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="section-header">Trending Communities</h2>
          <button
            onClick={() => onNavigate('discover')}
            className="flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            See all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="taly-card flex items-center gap-3 p-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : trending.length === 0 ? (
            <div className="dotted-bg rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No trending communities yet.
              </p>
            </div>
          ) : (
            trending.map((g) => (
              <button
                key={g.id}
                onClick={() => onNavigate('discover')}
                className="group-card flex w-full items-center gap-3 p-3 text-left"
              >
                <Avatar
                  className={`h-10 w-10 rounded-lg ring-2 ${categoryColor(g.category)}`}
                >
                  <AvatarImage src={g.logo || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                    {(g.name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{g.membersCount} members</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate">{g.category || 'Group'}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))
          )}
        </div>
      </section>

      {/* Sponsored ad */}
      {ad && <SponsoredAdCard ad={ad} onDismiss={() => setAd(null)} />}

      {/* Story viewer dialog */}
      <StoryViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        userId={viewerUserId || ''}
        initialIndex={viewerInitialIndex}
        allStories={allStoriesForViewer}
        onStoryDeleted={refreshStories}
        onOpenChat={(c) => {
          // After a story reply is sent, navigate to the private
          // conversation so the user can continue the chat.
          onOpenChat({
            id: c.id,
            type: c.type,
            name: c.name,
            avatar: c.avatar || undefined,
          } as any)
        }}
      />

      {/* Create story dialog (local fallback when no parent handler) */}
      {!onOpenCreateStory && (
        <CreateStoryDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={refreshStories}
        />
      )}

      {/* Global search dialog */}
      <GlobalSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenChat={(c) => {
          onOpenChat({
            id: c.conversationId,
            type: c.isGroup ? 'group' : 'private',
            name: c.name,
            avatar: c.avatar,
          } as any)
        }}
      />
    </div>
  )
}

function SponsoredAdCard({ ad, onDismiss }: { ad: any; onDismiss: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-6"
    >
      <div className="taly-card relative overflow-hidden p-4">
        {/* Sponsored badge — top-left, emerald tint */}
        <span className="absolute left-0 top-0 inline-flex items-center rounded-br-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Sponsored
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss ad"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mt-4 flex gap-3">
          {ad.imageUrl ? (
            <img
              src={ad.imageUrl}
              alt={ad.brandName}
              className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600">
              <Sparkles className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{ad.brandName}</p>
            {ad.headline && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {ad.headline}
              </p>
            )}
            {ad.ctaText && (
              <a
                href={ad.ctaUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn mt-2 inline-flex min-h-[36px] !px-4 !py-1.5 !text-xs"
              >
                {ad.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
