'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Users } from 'lucide-react'
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
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
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

  const handleJoin = async (g: GroupItem) => {
    setJoining(g.id)
    try {
      const res: any = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ groupId: g.id }),
      })
      if (res?.alreadyMember) {
        toast({ title: 'You are already a member' })
      } else {
        toast({ title: `Joined ${g.name} 🎉` })
      }
      setJoinedIds((prev) => new Set(prev).add(g.id))
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to join', variant: 'destructive' })
    } finally {
      setJoining(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <h1 className="text-2xl font-bold">Discover</h1>
      <p className="text-sm text-muted-foreground">Find communities that match your interests</p>

      {/* Category chips */}
      <div className="no-scrollbar scroll-pan-y -mx-4 mt-3 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              {cat}
            </button>
          ))}
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
                      joined={joinedIds.has(g.id)}
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
            joinedIds={joinedIds}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />
          <Section
            title="Popular"
            loading={loading}
            groups={popular}
            joinedIds={joinedIds}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />
          <Section
            title="New"
            loading={loading}
            groups={newGroups}
            joinedIds={joinedIds}
            joining={joining}
            onJoin={handleJoin}
            onPreview={(g) => setPreview(g)}
          />

          {/* Sponsored communities */}
          {sponsored.length > 0 && (
            <section className="mt-5">
              <h2 className="text-base font-semibold">Sponsored Communities</h2>
              <div className="no-scrollbar scroll-pan-y -mx-4 mt-2 overflow-x-auto px-4">
                <div className="flex gap-3 pb-1">
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
                            <p className="line-clamp-2 text-xs text-muted-foreground">{ad.headline}</p>
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
        joined={preview ? joinedIds.has(preview.id) : false}
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
  joinedIds,
  joining,
  onJoin,
  onPreview,
}: {
  title: string
  loading: boolean
  groups: GroupItem[]
  joinedIds: Set<string>
  joining: string | null
  onJoin: (g: GroupItem) => void
  onPreview: (g: GroupItem) => void
}) {
  return (
    <section className="mt-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="no-scrollbar scroll-pan-y -mx-4 mt-2 overflow-x-auto px-4">
        {loading ? (
          <CardLoadingRow />
        ) : groups.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <div className="flex gap-3 pb-1">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                g={g}
                joined={joinedIds.has(g.id)}
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
  joined,
  joining,
  onJoin,
  onPreview,
}: {
  g: GroupItem
  joined: boolean
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
          <AvatarImage src={g.logo || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="mt-2 line-clamp-1 w-full text-sm font-semibold">{g.name}</p>
        <p className="line-clamp-1 w-full text-xs text-muted-foreground">{g.category || 'Group'}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{g.membersCount} members</p>
        {g.description && (
          <p className="mt-1 line-clamp-1 w-full text-[11px] text-muted-foreground">{g.description}</p>
        )}
      </button>
      <div className="px-3 pb-3">
        <Button
          size="sm"
          variant={joined ? 'outline' : 'default'}
          disabled={joined || joining}
          onClick={() => onJoin(g)}
          className="w-full min-h-[36px]"
        >
          {joining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : joined ? (
            <>
              <Check className="h-3.5 w-3.5" /> Joined
            </>
          ) : (
            'Join'
          )}
        </Button>
      </div>
    </div>
  )
}

function GroupRow({
  g,
  joined,
  joining,
  onJoin,
  onPreview,
}: {
  g: GroupItem
  joined: boolean
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
          <AvatarImage src={g.logo || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {(g.name || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{g.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {g.membersCount} members · {g.category || 'Group'}
          </p>
          {g.description && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{g.description}</p>
          )}
        </div>
      </button>
      <Button
        size="sm"
        variant={joined ? 'outline' : 'default'}
        disabled={joined || joining}
        onClick={() => onJoin(g)}
        className="min-h-[36px]"
      >
        {joining ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : joined ? (
          <>
            <Check className="h-3.5 w-3.5" /> Joined
          </>
        ) : (
          'Join'
        )}
      </Button>
    </div>
  )
}

function CardLoadingRow() {
  return (
    <div className="flex gap-3 px-4 pb-1">
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
  joined,
  joining,
  onJoin,
  onClose,
}: {
  group: GroupItem | null
  joined: boolean
  joining: boolean
  onJoin: (g: GroupItem) => void
  onClose: () => void
}) {
  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group preview</DialogTitle>
        </DialogHeader>
        {group && (
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-16 w-16">
              <AvatarImage src={group.logo || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {(group.name || '?')[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="mt-2 text-lg font-bold">{group.name}</h3>
            <p className="text-sm text-muted-foreground">{group.category || 'Group'}</p>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {group.membersCount} members
            </div>
            {group.description && (
              <p className="mt-3 text-sm text-muted-foreground">{group.description}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {group && (
            <Button
              disabled={joined || joining}
              onClick={() => onJoin(group)}
              className="btn-brand min-h-[44px]"
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : joined ? (
                <>
                  <Check className="h-4 w-4" /> Joined
                </>
              ) : (
                'Join group'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
