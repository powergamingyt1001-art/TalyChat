'use client'

import * as React from 'react'
import { Crown, Search, Shield, ShieldOff, UserCog, UserX, Ban, MessageSquare, Flag, CreditCard, Receipt } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AdminUserListItem,
  type AdminUserDetail,
  type AdminUsersResponse,
  EmptyState,
  StatCard,
  formatDate,
  formatDateTime,
  initials,
} from './admin-shared'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

export function AdminMembers() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [q, setQ] = React.useState('')
  const [debouncedQ, setDebouncedQ] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<AdminUsersResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const load = React.useCallback(async (query: string, p: number) => {
    setLoading(true)
    try {
      const res: any = await apiFetch(
        `/api/admin/users?q=${encodeURIComponent(query)}&page=${p}&limit=${PAGE_SIZE}`
      )
      setData(res as AdminUsersResponse)
    } catch (e: any) {
      toast({ title: 'Failed to load users', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // debounce search input → debouncedQ (resets page to 1)
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  // fetch when debounced query or page changes
  React.useEffect(() => {
    load(debouncedQ, page)
  }, [debouncedQ, page, load])

  const loadDetail = React.useCallback(async (id: string) => {
    setDetailLoading(true)
    setSelectedId(id)
    try {
      const res: any = await apiFetch(`/api/admin/users/${id}`)
      setDetail(res as AdminUserDetail)
    } catch (e: any) {
      toast({ title: 'Failed to load user detail', description: e?.message, variant: 'destructive' })
      setSelectedId(null)
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  const closeDetail = () => {
    setSelectedId(null)
    setDetail(null)
  }

  const onUserUpdated = () => {
    // refresh list + detail
    load(debouncedQ, page)
    if (selectedId) loadDetail(selectedId)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Members</h2>
        <p className="text-sm text-muted-foreground">Browse and manage all TalyChat users</p>
      </div>

      {/* Analytics summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {data ? (
          <>
            <StatCard label="Total" value={data.total.toLocaleString('en-IN')} icon={UserCog} tone="primary" />
            <StatCard label="Active" value={data.active.toLocaleString('en-IN')} icon={UserCog} tone="info" />
            <StatCard label="New Today" value={data.newToday.toLocaleString('en-IN')} icon={UserCog} tone="primary" />
            <StatCard label="Male" value={data.male.toLocaleString('en-IN')} icon={UserCog} />
            <StatCard label="Female" value={data.female.toLocaleString('en-IN')} icon={UserCog} />
            <StatCard label="Under 18" value={data.under18.toLocaleString('en-IN')} icon={UserCog} tone="warning" />
            <StatCard label="18+" value={data.over18.toLocaleString('en-IN')} icon={UserCog} />
          </>
        ) : (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="pl-10"
          aria-label="Search users"
        />
      </div>

      {/* Table or cards */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : data && data.users.length > 0 ? (
            isMobile ? (
              <MobileUserList users={data.users} onSelect={loadDetail} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-card hover:bg-card">
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Premium</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow
                      key={u.id}
                      onClick={() => loadDetail(u.id)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-8">
                            {u.avatar ? <AvatarImage src={u.avatar} alt={u.name} /> : null}
                            <AvatarFallback>{initials(u.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-sm">@{u.username}</TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.isPremium ? <Crown className="size-4 text-amber-500" /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-block size-2 rounded-full',
                              u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                            )}
                          />
                          <span className="text-xs">
                            {u.isOnline ? 'Online' : formatDate(u.lastSeen)}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <EmptyState title="No users found" hint="Try a different search term" icon={Search} />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.filteredTotal} result{data.filteredTotal === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* User detail */}
      <UserDetailDialog
        id={selectedId}
        detail={detail}
        loading={detailLoading}
        onClose={closeDetail}
        onChanged={onUserUpdated}
      />
    </div>
  )
}

function MobileUserList({
  users,
  onSelect,
}: {
  users: AdminUserListItem[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="divide-y">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => onSelect(u.id)}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
        >
          <Avatar className="size-10">
            {u.avatar ? <AvatarImage src={u.avatar} alt={u.name} /> : null}
            <AvatarFallback>{initials(u.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{u.name}</p>
              {u.isPremium && <Crown className="size-3.5 shrink-0 text-amber-500" />}
              {u.role === 'admin' && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 px-1.5 py-0 text-[9px]">A</Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <span
                className={cn(
                  'inline-block size-2 rounded-full',
                  u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                )}
              />
              {u.isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function UserDetailDialog({
  id,
  detail,
  loading,
  onClose,
  onChanged,
}: {
  id: string | null
  detail: AdminUserDetail | null
  loading: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [acting, setActing] = React.useState(false)

  if (!id) return null

  const patch = async (body: any, successMsg: string) => {
    setActing(true)
    try {
      await apiFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast({ title: successMsg })
      onChanged()
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActing(false)
    }
  }

  const blockUser = async () => {
    setActing(true)
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      toast({ title: 'User blocked' })
      onChanged()
      onClose()
    } catch (e: any) {
      toast({ title: 'Block failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActing(false)
    }
  }

  const content = (
    <div className="flex flex-col gap-4">
      {loading || !detail ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar className="size-14">
              {detail.avatar ? <AvatarImage src={detail.avatar} alt={detail.name} /> : null}
              <AvatarFallback>{initials(detail.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-lg font-bold">{detail.name}</h3>
                {detail.isPremium && <Crown className="size-4 text-amber-500" />}
              </div>
              <p className="truncate text-sm text-muted-foreground">@{detail.username}</p>
              <p className="truncate text-xs text-muted-foreground">{detail.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={detail.role === 'admin' ? 'default' : 'secondary'}>
                  {detail.role === 'admin' ? 'Admin' : 'User'}
                </Badge>
                {detail.isRestricted && <Badge variant="destructive">Restricted</Badge>}
                {detail.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                <span className="inline-flex items-center gap-1 text-xs">
                  <span
                    className={cn(
                      'inline-block size-2 rounded-full',
                      detail.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    )}
                  />
                  {detail.isOnline ? 'Online' : `Last seen ${formatDate(detail.lastSeen)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Info label="Gender" value={detail.gender || '—'} />
            <Info label="DOB" value={formatDate(detail.dob)} />
            <Info label="Premium Until" value={formatDate(detail.premiumUntil)} />
            <Info label="Restricted Until" value={formatDate(detail.restrictedUntil)} />
            <Info label="Joined" value={formatDateTime(detail.createdAt)} />
            <Info label="Bio" value={detail.bio || '—'} />
          </div>

          <Separator />

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={MessageSquare} value={detail.conversations.length} label="Chats" />
            <MiniStat icon={Flag} value={detail.reports.received.length} label="Reports" />
            <MiniStat icon={CreditCard} value={detail.paymentProofs.length} label="Payments" />
            <MiniStat icon={Receipt} value={detail.subscriptions.length} label="Subs" />
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={detail.isPremium ? 'outline' : 'default'}
              className="btn-brand h-11"
              disabled={acting}
              onClick={() => patch({ isPremium: !detail.isPremium, premiumUntil: !detail.isPremium ? undefined : null }, detail.isPremium ? 'Premium removed' : 'Premium granted')}
            >
              <Crown className="size-4" />
              {detail.isPremium ? 'Remove Premium' : 'Make Premium'}
            </Button>
            <Button
              size="sm"
              variant={detail.isRestricted ? 'default' : 'outline'}
              className={cn('h-11', !detail.isRestricted && 'btn-brand')}
              disabled={acting}
              onClick={() =>
                patch(
                  { isRestricted: !detail.isRestricted, restrictedUntil: !detail.isRestricted ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null },
                  detail.isRestricted ? 'Restriction lifted' : 'User restricted 24h'
                )
              }
            >
              {detail.isRestricted ? <ShieldOff className="size-4" /> : <Shield className="size-4" />}
              {detail.isRestricted ? 'Unrestrict' : 'Restrict'}
            </Button>
            <Button
              size="sm"
              variant={detail.role === 'admin' ? 'outline' : 'default'}
              className={cn('h-11', detail.role !== 'admin' && 'btn-brand')}
              disabled={acting}
              onClick={() => patch({ role: detail.role === 'admin' ? 'user' : 'admin' }, detail.role === 'admin' ? 'Admin removed' : 'Made admin')}
            >
              <UserCog className="size-4" />
              {detail.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-11"
              disabled={acting}
              onClick={blockUser}
            >
              <Ban className="size-4" />
              Block User
            </Button>
          </div>
        </>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto p-4">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <UserX className="size-4" /> User details
            </SheetTitle>
            <SheetDescription>Manage this user account</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="size-4" /> User details
          </DialogTitle>
          <DialogDescription>Manage this user account</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
