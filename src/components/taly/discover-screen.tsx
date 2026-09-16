'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Lock, Users } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/components/taly/customizer-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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

export function DiscoverScreen() {
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

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <h1 className="text-2xl font-bold">Discover</h1>
      <p className="text-sm text-muted-foreground">
        Find communities that match your interests
      </p>

      {/* Category chips — polished, smooth horizontal scroll */}
      <div className="no-scrollbar scroll-pan-y -mx-4 mt-3 w-full overflow-x-auto px-4">
        <div className="flex min-w-0 gap-2 pb-1">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category results */}
      {activeCategory && (
        <section className="mt-4">
          <h2 className="text-base font-semibold">{activeCategory} communities</h2>
          <div className="mt-2">
            {catLoading ? (
              <InlineLoadingRow />
            ) : categoryResults.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No communities in this category yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {categoryResults.map((g) => (
                  <li key={g.id}>
                    <GroupRow
                      g={g}
                      state={joinStateFor(g)}
                      joining={joining === g.id}
                      onJoin={handleJoin}
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
            loading={loading}
            groups={trending}
            joinStateFor={joinStateFor}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />
          <Section
            title="Popular"
            loading={loading}
            groups={popular}
            joinStateFor={joinStateFor}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />
          <Section
            title="New"
            loading={loading}
            groups={newGroups}
            joinStateFor={joinStateFor}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />

          {/* Sponsored communities */}
          {sponsored.length > 0 && (
            <section className="mt-5">
              <h2 className="text-base font-semibold">Sponsored Communities</h2>
              <div className="no-scrollbar scroll-pan-y -mx-4 mt-2 w-full overflow-x-auto px-4">
                <div className="flex min-w-0 gap-3 pb-1">
                  {sponsored.map((ad) => (
                    <a
                      key={ad.id}
                      href={ad.ctaUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ad-box w-64 shrink-0 p-3"
                    >
                      <span className="sponsored-label">Sponsored</span>
                      <div className="mt-1 flex gap-2">
                        {ad.imageUrl && (
                          <img
                            src={ad.imageUrl}
                            alt={ad.brandName}
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
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
                        <span className="mt-2 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
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
        onJoin={handleJoin}
        onClose={() => setPreview(null)}
      />
    </div>
  )
}

function Section({
  title,
  loading,
  groups,
  joinStateFor,
  joining,
  onJoin,
  onPreview,
}: {
  title: string
  loading: boolean
  groups: GroupItem[]
  joinStateFor: (g: GroupItem) => JoinState
  joining: string | null
  onJoin: (g: GroupItem) => void
  onPreview: (g: GroupItem) => void
}) {
  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="no-scrollbar scroll-pan-y -mx-4 mt-2 w-full overflow-x-auto px-4">
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
                onJoin={onJoin}
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
  onJoin,
  onPreview,
}: {
  g: GroupItem
  state: JoinState
  joining: boolean
  onJoin: (g: GroupItem) => void
  onPreview: () => void
}) {
  return (
    <div className="w-44 shrink-0 overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={onPreview}
        className="flex w-full flex-col items-center p-3 text-center"
      >
        <Avatar className="h-12 w-12">
          <AvatarImage src={g.logo || undefined} alt={g.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold">
          {g.isPublic === false && <Lock className="h-3 w-3 text-muted-foreground" />}
          <span className="line-clamp-1">{g.name}</span>
        </p>
        <p className="line-clamp-1 w-full text-xs text-muted-foreground">
          {g.category || 'Group'}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">{g.membersCount} members</p>
        {g.description && (
          <p className="mt-1 line-clamp-1 w-full text-[11px] text-muted-foreground">
            {g.description}
          </p>
        )}
      </button>
      <div className="px-3 pb-3">
        <JoinButton
          state={state}
          joining={joining}
          isPublic={g.isPublic}
          onClick={() => onJoin(g)}
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
  onJoin,
  onPreview,
}: {
  g: GroupItem
  state: JoinState
  joining: boolean
  onJoin: (g: GroupItem) => void
  onPreview: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button
        onClick={onPreview}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={g.logo || undefined} alt={g.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {g.isPublic === false && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
            <span className="truncate">{g.name}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {g.membersCount} members · {g.category || 'Group'}
          </p>
          {g.description && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{g.description}</p>
          )}
        </div>
      </button>
      <JoinButton
        state={state}
        joining={joining}
        isPublic={g.isPublic}
        onClick={() => onJoin(g)}
        size="sm"
      />
    </div>
  )
}

// ============================================================
// Reusable Join / Request to Join / Joined button
// ============================================================

function JoinButton({
  state,
  joining,
  isPublic,
  onClick,
  size = 'default',
  block = false,
}: {
  state: JoinState
  joining: boolean
  isPublic: boolean
  onClick: () => void
  size?: 'sm' | 'default'
  block?: boolean
}) {
  const label = () => {
    if (joining) return null
    if (state === 'joined') return (
      <>
        <Check className="h-3.5 w-3.5" /> Joined
      </>
    )
    if (state === 'requested') return 'Requested'
    return isPublic === false ? 'Request to Join' : 'Join'
  }

  const variant = state === 'joined' || state === 'requested' ? 'outline' : 'default'
  const disabled = joining || state === 'joined' || state === 'requested'

  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className={`${block ? 'w-full' : ''} min-h-[36px]`}
    >
      {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : label()}
    </Button>
  )
}

function CardLoadingRow() {
  return (
    <div className="flex min-w-0 gap-3 px-4 pb-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-44 shrink-0 rounded-xl border border-border bg-card p-3"
        >
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-muted" />
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
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
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
  onJoin,
  onClose,
}: {
  group: GroupItem | null
  state: JoinState
  joining: boolean
  onJoin: (g: GroupItem) => void
  onClose: () => void
}) {
  const label = () => {
    if (joining) return <Loader2 className="h-4 w-4 animate-spin" />
    if (state === 'joined') return (
      <>
        <Check className="h-4 w-4" /> Joined
      </>
    )
    if (state === 'requested') return 'Requested'
    return group?.isPublic === false ? 'Request to Join' : 'Join group'
  }
  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group preview</DialogTitle>
        </DialogHeader>
        {group && (
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-16 w-16">
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
            <p className="text-sm text-muted-foreground">{group.category || 'Group'}</p>
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
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {group && (
            <Button
              disabled={joining || state === 'joined' || state === 'requested'}
              onClick={() => onJoin(group)}
              className="btn-brand min-h-[44px]"
            >
              {label()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
