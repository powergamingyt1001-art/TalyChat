'use client'

import * as React from 'react'
import {
  CheckCircle2,
  XCircle,
  CreditCard,
  Loader2,
  Eye,
  Repeat,
  ArrowRight,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  type AdminPayment,
  type AdminSubscription,
  EmptyState,
  StatusBadge,
  SourceBadge,
  formatDateTime,
  formatINR,
  initials,
  truncate,
} from './admin-shared'
import { cn } from '@/lib/utils'

// ============================================================
// V2 Admin Payments tab
//   - Section 1: Payment approval (pending → approve/reject)
//   - Section 2: Subscriptions summary (brief, links to Tab 4)
// ============================================================

export function AdminPayments({ onGotoSubscriptions }: { onGotoSubscriptions: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Payments</h2>
        <p className="text-sm text-muted-foreground">
          Approve payment proofs and view subscription overview
        </p>
      </div>

      <PaymentApprovalSection />
      <SubscriptionsSummarySection onGotoSubscriptions={onGotoSubscriptions} />
    </div>
  )
}

// ============================================================
// Section 1 — Payment approval
// ============================================================
type PayFilter = 'pending' | 'approved' | 'rejected'

function PaymentApprovalSection() {
  const { toast } = useToast()
  const [payments, setPayments] = React.useState<AdminPayment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actingId, setActingId] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<PayFilter>('pending')

  const load = React.useCallback(async (f: PayFilter) => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/api/admin/payments?status=${f}`)
      setPayments(res?.payments || [])
    } catch (e: any) {
      toast({ title: 'Failed to load payments', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load(filter)
  }, [filter, load])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id)
    try {
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      toast({
        title: action === 'approve' ? 'Payment approved — premium granted' : 'Payment rejected',
      })
      if (filter === 'pending') {
        setPayments((prev) => prev.filter((p) => p.id !== id))
      } else {
        load(filter)
      }
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActingId(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="size-4 text-primary" /> Payment approval
        </h3>
        <Select value={filter} onValueChange={(v) => setFilter(v as PayFilter)}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title={`No ${filter} payments`}
              hint="Pending payment proofs will appear here"
              icon={CreditCard}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {payments.map((p) => (
            <PaymentCard key={p.id} payment={p} acting={actingId === p.id} onAct={act} />
          ))}
        </div>
      )}
    </section>
  )
}

function PaymentCard({
  payment,
  acting,
  onAct,
}: {
  payment: AdminPayment
  acting: boolean
  onAct: (id: string, action: 'approve' | 'reject') => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-10">
            {payment.user.avatar ? <AvatarImage src={payment.user.avatar} alt={payment.user.name} /> : null}
            <AvatarFallback>{initials(payment.user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{payment.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{payment.user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{payment.user.email}</p>
          </div>
          <StatusBadge status={payment.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Cell label="Plan" value={payment.plan} />
          <Cell label="Amount" value={formatINR(payment.amount)} />
          <Cell label="Txn ID" value={payment.transactionId} />
          <Cell label="UTR" value={payment.utrNumber || '—'} />
        </div>

        {payment.screenshotUrl && (
          <a href={payment.screenshotUrl} target="_blank" rel="noreferrer" className="block">
            <img
              src={payment.screenshotUrl}
              alt="Payment proof"
              className="h-32 w-full rounded-md border object-cover"
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="size-3" /> Tap to view full screenshot
            </p>
          </a>
        )}

        {payment.notes && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            {truncate(payment.notes, 200)}
          </p>
        )}

        <p className="text-xs text-muted-foreground">Submitted {formatDateTime(payment.createdAt)}</p>

        {payment.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="btn-brand h-11 flex-1"
              disabled={acting}
              onClick={() => onAct(payment.id, 'approve')}
            >
              {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-11 flex-1"
              disabled={acting}
              onClick={() => onAct(payment.id, 'reject')}
            >
              {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}

// ============================================================
// Section 2 — Subscriptions summary (brief)
// ============================================================
function SubscriptionsSummarySection({ onGotoSubscriptions }: { onGotoSubscriptions: () => void }) {
  const { toast } = useToast()
  const [subs, setSubs] = React.useState<AdminSubscription[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/admin/subscriptions?status=all')
      setSubs(res?.subscriptions || [])
    } catch (e: any) {
      toast({ title: 'Failed to load subscriptions', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const now = Date.now()
  const activeCount = subs.filter(
    (s) => s.currentlyActive === true && new Date(s.expireAt).getTime() > now
  ).length
  const expiredCount = subs.length - activeCount
  const totalRevenue = subs
    .filter((s) => s.source === 'payment')
    .reduce((sum, s) => sum + (s.amount || 0), 0)

  const recent = subs.slice(0, 5)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Repeat className="size-4 text-primary" /> Subscriptions overview
        </h3>
        <Button variant="outline" size="sm" className="h-9" onClick={onGotoSubscriptions}>
          View all <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCell label="Total Subscriptions" value={loading ? '—' : subs.length.toLocaleString('en-IN')} />
        <SummaryCell label="Active" value={loading ? '—' : activeCount.toLocaleString('en-IN')} tone="primary" />
        <SummaryCell label="Expired" value={loading ? '—' : expiredCount.toLocaleString('en-IN')} tone="muted" />
        <SummaryCell
          label="Revenue from Subs"
          value={loading ? '—' : formatINR(totalRevenue)}
          tone="primary"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState title="No subscriptions yet" hint="Subscriptions will appear here" icon={Repeat} />
          ) : (
            <ul className="divide-y">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <Avatar className="size-9">
                    {s.user.avatar ? <AvatarImage src={s.user.avatar} alt={s.user.name} /> : null}
                    <AvatarFallback>{initials(s.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{s.user.username}</p>
                  </div>
                  <SourceBadge source={s.source} />
                  <Badge variant="secondary" className="capitalize">
                    {s.plan}
                  </Badge>
                  <StatusBadge status={s.currentlyActive ? 'approved' : 'rejected'} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function SummaryCell({
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
        tone === 'primary' && 'border-primary/30 bg-primary/5'
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
