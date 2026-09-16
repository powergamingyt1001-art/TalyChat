'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Bot,
  ChevronRight,
  Compass,
  MessageCircle,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { ConversationSummary } from '@/components/taly-app'

interface HomeProps {
  user: any
  onOpenChat: (c: ConversationSummary) => void
  onNavigate: (tab: any) => void
  onOpenTaly: () => void
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

function convInitial(c: any): string {
  return (c.name || c.otherUser?.name || c.group?.name || '?').toString()[0]?.toUpperCase() || '?'
}

export function HomeScreen({ user, onOpenChat, onNavigate, onOpenTaly }: HomeProps) {
  const [chats, setChats] = useState<ConversationSummary[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [trending, setTrending] = useState<any[]>([])
  const [ad, setAd] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

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

  const quickActions = [
    { id: 'chats', label: 'Chats', icon: MessageCircle, color: 'from-emerald-500 to-emerald-600', onClick: () => onNavigate('chats') },
    { id: 'groups', label: 'Groups', icon: Users, color: 'from-blue-500 to-blue-600', onClick: () => onNavigate('groups') },
    { id: 'discover', label: 'Discover', icon: Compass, color: 'from-purple-500 to-purple-600', onClick: () => onNavigate('discover') },
    { id: 'taly', label: 'Ask Taly', icon: Bot, color: 'from-amber-500 to-amber-600', onClick: onOpenTaly },
  ] as const

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-2xl font-bold">Hi, {firstName} 👋</h1>
      </motion.div>

      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-lg"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide opacity-90">TalyChat</span>
        </div>
        <p className="mt-2 text-xl font-bold leading-tight">Chat. Connect. Mingle.</p>
        <p className="mt-1 text-sm opacity-90">Your AI companion is one tap away.</p>
        <Button
          onClick={onOpenTaly}
          className="mt-4 min-h-[44px] gap-2 rounded-full bg-white text-emerald-700 shadow-sm hover:bg-white/90 hover:text-emerald-800"
        >
          <Bot className="h-4 w-4" /> Ask Taly
        </Button>
      </motion.div>

      {/* Quick actions grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mt-4 grid grid-cols-4 gap-3"
      >
        {quickActions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.id}
              onClick={a.onClick}
              className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-2 text-center transition-colors hover:bg-accent"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${a.color} text-white shadow`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          )
        })}
      </motion.div>

      {/* Recent private chats */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="h-4 w-4 text-primary" /> Recent Chats
          </h2>
          <button
            onClick={() => onNavigate('chats')}
            className="flex items-center text-xs text-primary hover:underline"
          >
            See all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : chats.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No conversations yet. Find someone to chat with in Discover.
            </p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenChat(c)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={convAvatar(c)} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {convInitial(c)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(c.lastMessage?.createdAt || c.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.lastMessage?.content || 'Say hi 👋'}
                  </p>
                </div>
                {c.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" /> : null}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Notifications */}
      {notifications.length > 0 && (
        <section className="mt-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h2>
          <div className="mt-2 space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-border bg-card p-3">
                <p className="truncate text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending communities */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" /> Trending Communities
          </h2>
          <button
            onClick={() => onNavigate('discover')}
            className="flex items-center text-xs text-primary hover:underline"
          >
            See all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : trending.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              No trending communities yet.
            </p>
          ) : (
            trending.map((g) => (
              <button
                key={g.id}
                onClick={() => onNavigate('discover')}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={g.logo || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                    {(g.name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.membersCount} members · {g.category || 'Group'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </section>

      {/* Sponsored ad */}
      {ad && <SponsoredAdCard ad={ad} onDismiss={() => setAd(null)} />}
    </div>
  )
}

function SponsoredAdCard({ ad, onDismiss }: { ad: any; onDismiss: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-5"
    >
      <div className="ad-box relative p-4">
        <button
          onClick={onDismiss}
          aria-label="Dismiss ad"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="sponsored-label">Sponsored</span>
        <div className="mt-2 flex gap-3">
          {ad.imageUrl && (
            <img
              src={ad.imageUrl}
              alt={ad.brandName}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{ad.brandName}</p>
            {ad.headline && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ad.headline}</p>}
            {ad.ctaText && (
              <a
                href={ad.ctaUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-[36px] items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
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
