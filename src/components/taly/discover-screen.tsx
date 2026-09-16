'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Compass,
  Loader2,
  Lock,
  LogOut,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/components/taly/customizer-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface GroupItem {
  id: string
  name: string
  description?: string | null
  logo?: string | null
  category?: string | null
  membersCount: number
  isPublic: boolean
  isJoined?: boolean
  conversationId?: string | null
}

// Track per-group state: 'idle' (default Join), 'requested' (private, request sent)
type JoinState = 'idle' | 'joined' | 'requested'

// Category → ring color (used for avatar ring + badge tint)
function categoryRing(cat?: string | null): string {
  switch ((cat || '').toLowerCase()) {
    case 'gaming':
      return 'ring-violet-400/70'
    case 'technology':
    case 'ai':
      return 'ring-blue-400/70'
    case 'cricket':
    case 'sports':
      return 'ring-orange-400/70'
    case 'entertainment':
    case 'movies':
    case 'music':
      return 'ring-pink-400/70'
    case 'education':
      return 'ring-emerald-400/70'
    case 'business':
    case 'finance':
    case 'jobs':
      return 'ring-yellow-400/70'
    case 'memes':
      return 'ring-fuchsia-400/70'
    case 'news':
      return 'ring-cyan-400/70'
    case 'local':
      return 'ring-teal-400/70'
    default:
      return 'ring-emerald-400/70'
  }
}

// Category → 3px top-border color on the group card (visual category tint)
function categoryTopBorder(cat?: string | null): string {
  switch ((cat || '').toLowerCase()) {
    case 'gaming':
      return 'border-t-violet-500'
    case 'technology':
    case 'ai':
      return 'border-t-blue-500'
    case 'cricket':
    case 'sports':
      return 'border-t-orange-500'
    case 'entertainment':
    case 'movies':
    case 'music':
      return 'border-t-pink-500'
    case 'education':
      return 'border-t-emerald-500'
    case 'business':
    case 'finance':
    case 'jobs':
      return 'border-t-yellow-500'
    case 'memes':
      return 'border-t-fuchsia-500'
    case 'news':
      return 'border-t-cyan-500'
    case 'local':
      return 'border-t-teal-500'
    default:
      return 'border-t-emerald-500'
  }
}

// Category → badge text/bg color
function categoryBadge(cat?: string | null): string {
  switch ((cat || '').toLowerCase()) {
    case 'gaming':
      return 'bg-violet-500/10 text-violet-600'
    case 'technology':
    case 'ai':
      return 'bg-blue-500/10 text-blue-600'
    case 'cricket':
    case 'sports':
      return 'bg-orange-500/10 text-orange-600'
    case 'entertainment':
    case 'movies':
    case 'music':
      return 'bg-pink-500/10 text-pink-600'
    case 'education':
      return 'bg-emerald-500/10 text-emerald-600'
    case 'business':
    case 'finance':
    case 'jobs':
      return 'bg-yellow-500/10 text-yellow-700'
    case 'memes':
      return 'bg-fuchsia-500/10 text-fuchsia-600'
    case 'news':
      return 'bg-cyan-500/10 text-cyan-600'
    case 'local':
      return 'bg-teal-500/10 text-teal-600'
    default:
      return 'bg-emerald-500/10 text-emerald-600'
  }
}

// V12 — Category → top-of-card gradient overlay tint. Applied as a thin
// gradient bar across the top of each group card / row to make the
// category visually scannable at a glance. Uses subtle 10% tints so it
// doesn't fight with the existing top-border accent.
function categoryGradient(cat?: string | null): string {
  switch ((cat || '').toLowerCase()) {
    case 'gaming':
      return 'from-violet-500/10'
    case 'technology':
    case 'ai':
      return 'from-blue-500/10'
    case 'cricket':
    case 'sports':
      return 'from-orange-500/10'
    case 'entertainment':
    case 'movies':
    case 'music':
      return 'from-pink-500/10'
    case 'education':
      return 'from-emerald-500/10'
    case 'business':
    case 'finance':
    case 'jobs':
      return 'from-yellow-500/10'
    case 'memes':
      return 'from-fuchsia-500/10'
    case 'news':
      return 'from-cyan-500/10'
    case 'local':
      return 'from-teal-500/10'
    default:
      return 'from-gray-500/10'
  }
}

export interface DiscoverScreenProps {
  // V12 — Called when a user taps "Open" on a joined group. Wired up in
  // TalyApp to open the group's chat conversation.
  onOpenChat?: (c: {
    conversationId: string
    name: string
    avatar?: string
    isGroup: boolean
  }) => void
  // V12 — Called when the empty-state "Create {Category} Group" button is
  // tapped. Wired up to navigate the user to the Groups tab so they can
  // start a community in the chosen category.
  onCreateGroup?: (category?: string) => void
}

export function DiscoverScreen({ onOpenChat, onCreateGroup }: DiscoverScreenProps = {}) {
  const { toast } = useToast()
  const [trending, setTrending] = useState<GroupItem[]>([])
  const [popular, setPopular] = useState<GroupItem[]>([])
  const [newGroups, setNewGroups] = useState<GroupItem[]>([])
  const [sponsored, setSponsored] = useState<any[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [categoryResults, setCategoryResults] = useState<GroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [catLoading, setCatLoading] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  // V12 — Track the group currently being "left" (used to disable the Leave
  // button + show a spinner during the leave API call).
  const [leaving, setLeaving] = useState<string | null>(null)
  // joinedIds = public joined; requestedIds = private groups with sent requests
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<GroupItem | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [t, p, n] = await Promise.all([
          apiFetch('/api/discover?sort=trending').catch(() => null),
          apiFetch('/api/discover?sort=popular').catch(() => null),
          apiFetch('/api/discover?sort=new').catch(() => null),
        ])
        if (cancelled) return
        // Defensive: API returns { groups: [...], sponsored: [...] }.
        // Fall back to bare arrays if the shape is ever flat.
        const tGroups: GroupItem[] = (Array.isArray(t)
          ? t
          : t?.groups || t?.items || []) as GroupItem[]
        const pGroups: GroupItem[] = (Array.isArray(p)
          ? p
          : p?.groups || p?.items || []) as GroupItem[]
        const nGroups: GroupItem[] = (Array.isArray(n)
          ? n
          : n?.groups || n?.items || []) as GroupItem[]
        setTrending(tGroups)
        setPopular(pGroups)
        setNewGroups(nGroups)
        // Sponsored ads: prefer the trending response's sponsored list,
        // fall back to popular's, then to an empty array.
        const sponsoredList: any[] = Array.isArray(t?.sponsored)
          ? t.sponsored
          : Array.isArray(p?.sponsored)
            ? p.sponsored
            : Array.isArray(n?.sponsored)
              ? n.sponsored
              : []
        setSponsored(sponsoredList)
        const joined = new Set<string>([
          ...tGroups.filter((g) => g.isJoined).map((g) => g.id),
          ...pGroups.filter((g) => g.isJoined).map((g) => g.id),
          ...nGroups.filter((g) => g.isJoined).map((g) => g.id),
        ])
        setJoinedIds(joined)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Load the user's sent group join requests once on mount so we can mark
  // private groups as "requested".
  useEffect(() => {
    ;(async () => {
      try {
        const res: any = await apiFetch('/api/groups/requests/sent')
        const list: any[] = Array.isArray(res) ? res : (res?.requests || res?.items || [])
        const pending = new Set<string>(
          list
            .filter((r: any) => r.status === 'pending' && r.group?.id)
            .map((r: any) => r.group.id),
        )
        setRequestedIds(pending)
      } catch {
        // ignore — feature best-effort
      }
    })()
  }, [])

  const fetchCategory = async (cat: string) => {
    setCatLoading(true)
    try {
      const res: any = await apiFetch(
        `/api/discover?category=${encodeURIComponent(cat)}&sort=trending`,
      )
      // Defensive: API returns { groups: [...] }, fall back to bare array.
      const list: GroupItem[] = (Array.isArray(res)
        ? res
        : res?.groups || res?.items || []) as GroupItem[]
      setCategoryResults(list)
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to load category', variant: 'destructive' })
    } finally {
      setCatLoading(false)
    }
  }

  const handleCategoryClick = (cat: string) => {
    if (activeCategory === cat) {
      setActiveCategory(null)
      setCategoryResults([])
    } else {
      setActiveCategory(cat)
      fetchCategory(cat)
    }
  }

  // Returns the join state for a group, factoring in joined + requested sets.
  const joinStateFor = (g: GroupItem): JoinState => {
    if (joinedIds.has(g.id)) return 'joined'
    if (!g.isPublic && requestedIds.has(g.id)) return 'requested'
    return 'idle'
  }

  const handleJoin = async (g: GroupItem) => {
    setJoining(g.id)
    try {
      const res: any = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ groupId: g.id }),
      })
      if (res?.alreadyMember) {
        toast({ title: 'You are already a member' })
        setJoinedIds((prev) => new Set(prev).add(g.id))
      } else if (res?.requested) {
        // Private group → request was sent
        toast({
          title: 'Join request sent! Wait for admin approval.',
        })
        setRequestedIds((prev) => new Set(prev).add(g.id))
      } else {
        // Public group → direct join
        toast({ title: `Joined ${g.name} 🎉` })
        setJoinedIds((prev) => new Set(prev).add(g.id))
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to join', variant: 'destructive' })
    } finally {
      setJoining(null)
    }
  }

  // V12 — Open the chat for a joined group. Calls onOpenChat (wired from
  // TalyApp) when a conversationId is linked to the group. Falls back to
  // a friendly toast if the callback is missing (defensive — should never
  // happen in production wiring, but avoids a no-op click).
  const handleOpen = (g: GroupItem) => {
    if (!g.conversationId) {
      toast({
        title: 'No chat linked to this group yet',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
      return
    }
    if (onOpenChat) {
      onOpenChat({
        conversationId: g.conversationId,
        name: g.name,
        avatar: g.logo || undefined,
        isGroup: true,
      })
    } else {
      toast({ title: 'Open coming soon' })
    }
  }

  // V12 — Leave a joined group. Calls POST /api/groups/[id]/leave, then
  // removes the group id from joinedIds so the button reverts to Join.
  const handleLeave = async (g: GroupItem) => {
    setLeaving(g.id)
    try {
      await apiFetch(`/api/groups/${g.id}/leave`, { method: 'POST' })
      toast({ title: `Left ${g.name}` })
      setJoinedIds((prev) => {
        const next = new Set(prev)
        next.delete(g.id)
        return next
      })
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to leave group', variant: 'destructive' })
    } finally {
      setLeaving(null)
    }
  }

  // V12 — Reset the active category filter (used by the "Browse Trending
  // instead" link in the empty state and by the active-filter banner's
  // clear (✕) button).
  const clearCategory = () => {
    setActiveCategory(null)
    setCategoryResults([])
  }

  // V12 — Handle the "Create {Category} Group" CTA in the no-results
  // empty state. If the parent wired onCreateGroup, delegate to it
  // (TalyApp navigates to the Groups tab). Otherwise show a friendly
  // toast so the click is never a no-op.
  const handleCreateGroup = () => {
    if (onCreateGroup) {
      onCreateGroup(activeCategory || undefined)
    } else {
      toast({
        title: 'Open the Groups tab',
        description: activeCategory
          ? `Tap the + button there to start a ${activeCategory} community.`
          : 'Tap the + button there to start a new community.',
      })
    }
  }

  const totalGroups = trending.length + popular.length + newGroups.length

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6 lg:pb-6 lg:pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="section-header">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find communities that match your interests
        </p>
      </motion.div>

      {/* Category chips — solid emerald active state + horizontal scroll snap */}
      <div
        className="no-scrollbar scroll-pan-y -mx-4 mt-3 w-full overflow-x-auto px-4"
        style={{ scrollSnapType: 'x proximity' }}
      >
        <div className="flex min-w-0 gap-2 pb-1">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`category-chip min-h-[36px] ${active ? 'active' : ''}`}
                style={{ scrollSnapAlign: 'start' }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* V12 — Active filter banner: shows below the chips row when a
          category filter is selected, with a clear (✕) button to reset. */}
      {activeCategory && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
          <span className="truncate">
            Showing results for{' '}
            <span className="font-bold">&lsquo;{activeCategory}&rsquo;</span>
          </span>
          <button
            type="button"
            onClick={clearCategory}
            aria-label="Clear category filter"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Empty state — no groups loaded */}
      {!loading && totalGroups === 0 && !activeCategory && (
        <div className="dotted-bg mt-6 flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-10 text-center">
          <Compass className="h-12 w-12 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            No communities yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check back soon — new communities are added every day.
          </p>
        </div>
      )}

      {/* Category results */}
      {activeCategory && (
        <section className="mt-4 animate-fade-in-up">
          <h2 className="section-header">
            {activeCategory} communities
          </h2>
          <div className="mt-3">
            {catLoading ? (
              <InlineLoadingRow />
            ) : categoryResults.length === 0 ? (
              // V12 — Friendly no-results empty state: magnifying glass,
              // "No groups found in {Category}", "Be the first to create
              // one!" + a Create button (emerald action-btn) and a "Browse
              // Trending instead" text link.
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Search className="h-12 w-12 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  No groups found in {activeCategory}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Be the first to create one!
                </p>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  className="action-btn mt-4 min-h-[44px]"
                >
                  <Plus className="h-4 w-4" /> Create {activeCategory} Group
                </button>
                <button
                  type="button"
                  onClick={clearCategory}
                  className="mt-3 inline-flex min-h-[40px] items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  Browse Trending instead <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {categoryResults.map((g) => (
                  <li key={g.id}>
                    <GroupRow
                      g={g}
                      state={joinStateFor(g)}
                      joining={joining === g.id}
                      leaving={leaving === g.id}
                      onJoin={handleJoin}
                      onOpen={handleOpen}
                      onLeave={handleLeave}
                      onPreview={() => setPreview(g)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Default sections */}
      {!activeCategory && (
        <>
          <Section
            title="Trending"
            icon="🔥"
            loading={loading}
            groups={trending}
            joinStateFor={joinStateFor}
            joining={joining}
            leaving={leaving}
            onJoin={handleJoin}
            onOpen={handleOpen}
            onLeave={handleLeave}
            onPreview={(g) => setPreview(g)}
            delay={0.05}
          />
          <Section
            title="Popular"
            icon="⭐"
            loading={loading}
            groups={popular}
            joinStateFor={joinStateFor}
            joining={joining}
            leaving={leaving}
            onJoin={handleJoin}
            onOpen={handleOpen}
            onLeave={handleLeave}
            onPreview={(g) => setPreview(g)}
            delay={0.1}
          />
          <Section
            title="New"
            icon="🆕"
            loading={loading}
            groups={newGroups}
            joinStateFor={joinStateFor}
            joining={joining}
            leaving={leaving}
            onJoin={handleJoin}
            onOpen={handleOpen}
            onLeave={handleLeave}
            onPreview={(g) => setPreview(g)}
            delay={0.15}
          />

          {/* Sponsored communities */}
          {sponsored.length > 0 && (
            <section className="mt-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <h2 className="section-header">Sponsored Communities</h2>
              <div className="no-scrollbar scroll-pan-y -mx-4 mt-3 w-full overflow-x-auto px-4">
                <div className="flex min-w-0 gap-3 pb-1">
                  {sponsored.map((ad) => (
                    <a
                      key={ad.id}
                      href={ad.ctaUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="taly-card taly-card-hover group relative block w-64 shrink-0 overflow-hidden p-3"
                    >
                      <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Sponsored
                      </span>
                      <div className="mt-2 flex gap-2">
                        {ad.imageUrl ? (
                          <img
                            src={ad.imageUrl}
                            alt={ad.brandName}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-600">
                            <Compass className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{ad.brandName}</p>
                          {ad.headline && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {ad.headline}
                            </p>
                          )}
                        </div>
                      </div>
                      {ad.ctaText && (
                        <span className="action-btn mt-2 inline-flex min-h-[32px] w-full !px-3 !py-1.5 !text-xs">
                          {ad.ctaText}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Group preview dialog */}
      <GroupPreviewDialog
        group={preview}
        state={preview ? joinStateFor(preview) : 'idle'}
        joining={preview ? joining === preview.id : false}
        leaving={preview ? leaving === preview.id : false}
        onJoin={handleJoin}
        onOpen={handleOpen}
        onLeave={handleLeave}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}

function Section({
  title,
  icon,
  loading,
  groups,
  joinStateFor,
  joining,
  leaving,
  onJoin,
  onOpen,
  onLeave,
  onPreview,
  delay = 0,
}: {
  title: string
  icon?: string
  loading: boolean
  groups: GroupItem[]
  joinStateFor: (g: GroupItem) => JoinState
  joining: string | null
  leaving: string | null
  onJoin: (g: GroupItem) => void
  onOpen: (g: GroupItem) => void
  onLeave: (g: GroupItem) => void
  onPreview: (g: GroupItem) => void
  delay?: number
}) {
  return (
    <section
      className="mt-6 animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Sticky header — backdrop blur + category icon */}
      <div className="sticky top-0 z-10 -mx-4 mb-2 flex items-center gap-1.5 bg-background/95 px-4 py-2 backdrop-blur">
        {icon && <span aria-hidden className="text-base">{icon}</span>}
        <h2 className="section-header">{title}</h2>
      </div>
      <div className="no-scrollbar scroll-pan-y -mx-4 w-full overflow-x-auto px-4">
        {loading ? (
          <CardLoadingRow />
        ) : groups.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <div className="flex min-w-0 gap-3 pb-1">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                g={g}
                state={joinStateFor(g)}
                joining={joining === g.id}
                leaving={leaving === g.id}
                onJoin={onJoin}
                onOpen={onOpen}
                onLeave={onLeave}
                onPreview={() => onPreview(g)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function GroupCard({
  g,
  state,
  joining,
  leaving,
  onJoin,
  onOpen,
  onLeave,
  onPreview,
}: {
  g: GroupItem
  state: JoinState
  joining: boolean
  leaving: boolean
  onJoin: (g: GroupItem) => void
  onOpen: (g: GroupItem) => void
  onLeave: (g: GroupItem) => void
  onPreview: () => void
}) {
  // Group is considered "active" (recently messaged) if membersCount > 5 —
  // a simple heuristic to drive the pulsing green dot without needing
  // a per-group lastMessageAt in the discover payload.
  const isActive = g.membersCount > 5
  return (
    <div
      className={`group-card relative w-44 shrink-0 overflow-hidden border-t-2 ${categoryTopBorder(g.category)} p-3`}
    >
      {/* V12 — Category gradient overlay tinting the top portion of the card */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${categoryGradient(g.category)} to-transparent`}
      />
      <button
        onClick={onPreview}
        className="relative flex w-full flex-col items-center text-center"
      >
        <Avatar
          className={`h-14 w-14 ring-2 ${categoryRing(g.category)}`}
        >
          <AvatarImage src={g.logo || undefined} alt={g.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold">
          {g.isPublic === false && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
          <span className="line-clamp-1">{g.name}</span>
        </p>
        {g.category && (
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryBadge(g.category)}`}
          >
            {g.category}
          </span>
        )}
        {/* Stacked mini avatars + member count + active dot */}
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <MiniStackedAvatars logo={g.logo} name={g.name} memberCount={g.membersCount} />
          <span className="inline-flex items-center gap-1">
            {isActive && (
              <span
                aria-label="Active group"
                className="relative inline-flex h-2 w-2"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
            <span>{g.membersCount}</span>
          </span>
        </div>
        {g.description && (
          <p className="mt-1.5 line-clamp-2 w-full text-[11px] leading-snug text-muted-foreground">
            {g.description}
          </p>
        )}
      </button>
      <div className="relative mt-3">
        <JoinButton
          state={state}
          joining={joining}
          leaving={leaving}
          isPublic={g.isPublic}
          onClick={() => onJoin(g)}
          onOpen={() => onOpen(g)}
          onLeave={() => onLeave(g)}
          size="sm"
          block
        />
      </div>
    </div>
  )
}

function GroupRow({
  g,
  state,
  joining,
  leaving,
  onJoin,
  onOpen,
  onLeave,
  onPreview,
}: {
  g: GroupItem
  state: JoinState
  joining: boolean
  leaving: boolean
  onJoin: (g: GroupItem) => void
  onOpen: (g: GroupItem) => void
  onLeave: (g: GroupItem) => void
  onPreview: () => void
}) {
  const isActive = g.membersCount > 5
  return (
    <div className={`group-card relative flex items-center gap-3 overflow-hidden border-t-2 ${categoryTopBorder(g.category)} p-3`}>
      {/* V12 — Category gradient overlay tinting the top portion of the row */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${categoryGradient(g.category)} to-transparent`}
      />
      <button
        onClick={onPreview}
        className="relative flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar className={`h-12 w-12 ring-2 ${categoryRing(g.category)}`}>
          <AvatarImage src={g.logo || undefined} alt={g.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {g.isPublic === false && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{g.name}</span>
            {isActive && (
              <span
                aria-label="Active group"
                className="relative ml-1 inline-flex h-2 w-2 shrink-0"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            )}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MiniStackedAvatars logo={g.logo} name={g.name} memberCount={g.membersCount} small />
            <span>{g.membersCount} members</span>
            {g.category && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${categoryBadge(g.category)}`}
                >
                  {g.category}
                </span>
              </>
            )}
          </div>
          {g.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {g.description}
            </p>
          )}
        </div>
      </button>
      <div className="relative">
        <JoinButton
          state={state}
          joining={joining}
          leaving={leaving}
          isPublic={g.isPublic}
          onClick={() => onJoin(g)}
          onOpen={() => onOpen(g)}
          onLeave={() => onLeave(g)}
          size="sm"
        />
      </div>
    </div>
  )
}

// ============================================================
// MiniStackedAvatars — 2-3 small overlapping letter-avatars with +N.
// Used inside group cards/rows to humanize the member count display.
// ============================================================
function MiniStackedAvatars({
  logo,
  name,
  memberCount,
  small = false,
}: {
  logo?: string | null
  name: string
  memberCount: number
  small?: boolean
}) {
  const baseName = name || 'G'
  const initials = (baseName.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean))
  const derived: string[] = []
  for (let i = 0; i < initials.length && derived.length < 3; i++) {
    derived.push(initials[i][0]?.toUpperCase() || 'U')
  }
  while (derived.length < 3) {
    derived.push(baseName[0]?.toUpperCase() || 'U')
  }
  const visible = derived.slice(0, 3)
  const extra = Math.max(0, memberCount - 3)
  const sizeClass = small ? 'h-4 w-4' : 'h-5 w-5'
  const textSize = small ? 'text-[7px]' : 'text-[8px]'
  const offset = small ? 8 : 10
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
    <span className="relative inline-flex items-center" aria-hidden>
      <span className="relative inline-flex" style={{ minWidth: `${offset * 2 + 8}px` }}>
        {visible.map((letter, i) => {
          const z = visible.length - i
          return (
            <span
              key={i}
              className={`absolute flex ${sizeClass} items-center justify-center rounded-full ${textSize} font-bold ring-1 ring-card ${slotClass(i)}`}
              style={{ left: `${i * offset}px`, zIndex: z }}
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
            </span>
          )
        })}
        {extra > 0 && (
          <span
            className={`absolute flex ${sizeClass} items-center justify-center rounded-full bg-muted ${textSize} font-bold text-muted-foreground ring-1 ring-card`}
            style={{ left: `${visible.length * offset}px`, zIndex: visible.length + 1 }}
          >
            +{extra > 99 ? '99' : extra}
          </span>
        )}
      </span>
    </span>
  )
}

// ============================================================
// Reusable Join / Request to Join / Joined button
// ============================================================

function JoinButton({
  state,
  joining,
  leaving,
  isPublic,
  onClick,
  onOpen,
  onLeave,
  size = 'default',
  block = false,
}: {
  state: JoinState
  joining: boolean
  leaving?: boolean
  isPublic: boolean
  onClick: () => void
  onOpen?: () => void
  onLeave?: () => void
  size?: 'sm' | 'default'
  block?: boolean
}) {
  const btnSizeClass = size === 'sm' ? '!min-h-[36px] !px-4 !py-2 !text-xs' : '!min-h-[44px] !px-5 !py-2.5 !text-sm'

  // V12 — Joined → functional Open (primary emerald action-btn) + Leave
  // (secondary red text link) instead of the old static "Joined ✓" pill.
  // Layout adapts to `block`: stacked vertically (card) or inline (row).
  if (state === 'joined' && !joining) {
    return (
      <div
        className={`flex ${block ? 'flex-col items-stretch gap-1' : 'items-center gap-2'}`}
      >
        <button
          type="button"
          onClick={onOpen}
          className={`action-btn active:scale-95 ${block ? 'w-full' : ''} ${btnSizeClass}`}
        >
          Open
        </button>
        <button
          type="button"
          onClick={onLeave}
          disabled={leaving}
          aria-label="Leave group"
          className="inline-flex min-h-[32px] items-center justify-center gap-1 text-xs font-medium text-destructive/70 transition-colors hover:text-destructive hover:underline disabled:opacity-50"
        >
          {leaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LogOut className="h-3 w-3" />
          )}
          Leave
        </button>
      </div>
    )
  }

  // Requested → outline muted
  if (state === 'requested' && !joining) {
    return (
      <span
        className={`ghost-btn inline-flex items-center justify-center gap-1.5 active:scale-95 ${block ? 'w-full' : ''} ${btnSizeClass}`}
      >
        <Loader2 className="h-3 w-3" /> Requested
      </span>
    )
  }

  // Idle / loading
  // Private → ghost-btn ("Request to Join"); Public → action-btn ("Join")
  const label = joining
    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
    : isPublic === false
      ? 'Request to Join'
      : 'Join'

  return (
    <button
      onClick={onClick}
      disabled={joining}
      className={`${isPublic === false ? 'ghost-btn' : 'action-btn'} active:scale-95 ${block ? 'w-full' : ''} ${btnSizeClass} disabled:opacity-60`}
    >
      {label}
    </button>
  )
}

function CardLoadingRow() {
  return (
    <div className="flex min-w-0 gap-3 px-4 pb-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="group-card w-44 shrink-0 p-3"
        >
          <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-muted" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-2 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function InlineLoadingRow() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="taly-card flex items-center gap-3 p-3"
        >
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-2 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function GroupPreviewDialog({
  group,
  state,
  joining,
  leaving,
  onJoin,
  onOpen,
  onLeave,
  onClose,
}: {
  group: GroupItem | null
  state: JoinState
  joining: boolean
  leaving: boolean
  onJoin: (g: GroupItem) => void
  onOpen: (g: GroupItem) => void
  onLeave: (g: GroupItem) => void
  onClose: () => void
}) {
  // V12 — When joined, the primary action becomes "Open" (instead of the
  // disabled "Joined ✓" pill). Otherwise it stays Join / Request to Join.
  const renderPrimaryAction = () => {
    if (joining) {
      return (
        <button
          disabled
          className="action-btn min-h-[44px] pointer-events-none opacity-60"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </button>
      )
    }
    if (state === 'joined') {
      return (
        <button
          onClick={() => group && onOpen(group)}
          className="action-btn min-h-[44px]"
        >
          Open chat
        </button>
      )
    }
    if (state === 'requested') {
      return (
        <button
          disabled
          className="ghost-btn min-h-[44px] pointer-events-none opacity-60"
        >
          Requested
        </button>
      )
    }
    return (
      <button
        onClick={() => group && onJoin(group)}
        className={`min-h-[44px] ${group?.isPublic === false ? 'ghost-btn' : 'action-btn'}`}
      >
        {group?.isPublic === false ? 'Request to Join' : 'Join group'}
      </button>
    )
  }
  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group preview</DialogTitle>
          <DialogDescription className="sr-only">
            Preview of a TalyChat community. Tap Join (public) or Request to Join (private) to participate.
          </DialogDescription>
        </DialogHeader>
        {group && (
          <div className="flex flex-col items-center text-center">
            <Avatar
              className={`h-16 w-16 ring-2 ${categoryRing(group.category)}`}
            >
              <AvatarImage src={group.logo || undefined} alt={group.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {(group.name || '?')[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-2 flex items-center gap-1 text-lg font-bold">
              {group.isPublic === false && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              {group.name}
            </h3>
            {group.category && (
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryBadge(group.category)}`}
              >
                {group.category}
              </span>
            )}
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {group.membersCount} members
            </div>
            {group.description && (
              <p className="mt-3 text-sm text-muted-foreground">{group.description}</p>
            )}
            {group.isPublic === false && (
              <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
                Private group — your request will need admin approval.
              </p>
            )}
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Close
          </Button>
          {group && (
            <>
              {renderPrimaryAction()}
              {/* V12 — Leave link shown only when the user is a member */}
              {state === 'joined' && (
                <button
                  type="button"
                  onClick={() => onLeave(group)}
                  disabled={leaving}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1 text-xs font-medium text-destructive/70 transition-colors hover:text-destructive hover:underline disabled:opacity-50"
                >
                  {leaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                  Leave group
                </button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
