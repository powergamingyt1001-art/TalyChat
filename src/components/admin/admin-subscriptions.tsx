'use client'

import * as React from 'react'
import { Repeat, Loader2, Crown, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AdminSubscription,
  EmptyState,
  SourceBadge,
  SubStatusBadge,
  formatDate,
  formatINR,
  formatPlan,
  formatSource,
  initials,
} from './admin-shared'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// ============================================================
// V2 Admin Subscriptions tab
//   - Summary cards (Total / Active / Expired / Revenue)
//   - Filter tabs (All / Active / Expired)
//   - Full subscription list with user info, plan, source, amount,
//     start date, expire date, status badge
// ============================================================
type StatusFilter = 'all' | 'active' | 'expired'

export function AdminSubscriptions() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [filter, setFilter] = React.useState<StatusFilter>('all')
  const [q, setQ] = React.useState('')
  const [subs, setSubs] = React.useState<AdminSubscription[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async (f: StatusFilter) => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/api/admin/subscriptions?status=${f}`)
      setSubs(res?.subscriptions || [])
    } catch (e: any) {
      toast({ title: 'Failed to load subscriptions', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load(filter)
  }, [filter, load])

  // Derived summary stats (computed client-side from the current `all` list).
  // We fetch the all list once when filter changes to "all"; for filtered views,
  // we keep the displayed list as the filtered subset, but we always re-fetch
  // the summary numbers via a separate "all" request so the cards don't change.
  const [allSubs, setAllSubs] = React.useState<AdminSubscription[]>([])
  React.useEffect(() => {
    apiFetch('/api/admin/subscriptions?status=all')
      .then((res: any) => setAllSubs(res?.subscriptions || []))
      .catch(() => {})
  }, [subs.length])

  const now = Date.now()
  const activeCount = allSubs.filter(
    (s) => s.currentlyActive === true && new Date(s.expireAt).getTime() > now
  ).length
  const expiredCount = allSubs.length - activeCount
  const totalRevenue = allSubs
    .filter((s) => s.source === 'payment')
    .reduce((sum, s) => sum + (s.amount || 0), 0)

  // Search filter (client-side) — by user name/username/email or plan
  const filtered = React.useMemo(() => {
    if (!q.trim()) return subs
    const needle = q.trim().toLowerCase()
    return subs.filter((s) => {
      return (
        s.user?.name?.toLowerCase().includes(needle) ||
        s.user?.username?.toLowerCase().includes(needle) ||
        s.user?.email?.toLowerCase().includes(needle) ||
        s.plan?.toLowerCase().includes(needle) ||
        s.source?.toLowerCase().includes(needle)
      )
    })
  }, [subs, q])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Subscriptions</h2>
        <p className="text-sm text-muted-foreground">Track all premium subscription activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total Subscriptions" value={loading ? '—' : allSubs.length.toLocaleString('en-IN')} />
        <SummaryCard
          label="Active"
          value={loading ? '—' : activeCount.toLocaleString('en-IN')}
          tone="primary"
        />
        <SummaryCard
          label="Expired"
          value={loading ? '—' : expiredCount.toLocaleString('en-IN')}
          tone="muted"
        />
        <SummaryCard
          label="Revenue from Subs"
          value={loading ? '—' : formatINR(totalRevenue)}
          tone="primary"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all" className="min-h-[36px]">
              All ({allSubs.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="min-h-[36px]">
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="expired" className="min-h-[36px]">
              Expired ({expiredCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user, plan or source…"
            className="pl-9"
            aria-label="Search subscriptions"
          />
        </div>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="size-4 text-primary" /> {filter === 'all' ? 'All' : filter === 'active' ? 'Active' : 'Expired'} subscriptions ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No subscriptions"
              hint={`No ${filter} subscriptions${q ? ` matching "${q}"` : ''}`}
              icon={Repeat}
            />
          ) : isMobile ? (
            <div className="divide-y">
              {filtered.map((s) => (
                <SubCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-8">
                          {s.user.avatar ? <AvatarImage src={s.user.avatar} alt={s.user.name} /> : null}
                          <AvatarFallback>{initials(s.user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-sm font-medium">
                            {s.user.name}
                            {s.user.isPremium && <Crown className="size-3 shrink-0 text-amber-500" />}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">@{s.user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium capitalize">{formatPlan(s.plan)}</span>
                    </TableCell>
                    <TableCell>
                      <SourceBadge source={s.source} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatINR(s.amount)}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.startAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(s.expireAt)}</TableCell>
                    <TableCell>
                      <SubStatusBadge active={s.currentlyActive} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SubCard({ s }: { s: AdminSubscription }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-10">
          {s.user.avatar ? <AvatarImage src={s.user.avatar} alt={s.user.name} /> : null}
          <AvatarFallback>{initials(s.user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            {s.user.name}
            {s.user.isPremium && <Crown className="size-3 shrink-0 text-amber-500" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{s.user.username}</p>
          <p className="truncate text-xs text-muted-foreground">{s.user.email}</p>
        </div>
        <SubStatusBadge active={s.currentlyActive} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MiniCell label="Plan" value={formatPlan(s.plan)} />
        <MiniCell label="Source" value={formatSource(s.source)} />
        <MiniCell label="Amount" value={formatINR(s.amount)} />
        <MiniCell label="Start" value={formatDate(s.startAt)} />
        <MiniCell label="Expires" value={formatDate(s.expireAt)} />
      </div>
    </div>
  )
}

function MiniCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'primary' | 'muted'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 shadow-sm',
        tone === 'primary' && 'border-primary/30 bg-primary/5',
        tone === 'muted' && 'border-muted-foreground/30'
      )}
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate text-xl font-bold tabular-nums',
          tone === 'primary' && 'text-primary'
        )}
      >
        {value}
      </p>
    </div>
  )
}
