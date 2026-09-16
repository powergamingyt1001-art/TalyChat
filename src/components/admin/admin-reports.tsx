'use client'

import * as React from 'react'
import { CheckCircle2, XCircle, Flag, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type AdminReport,
  EmptyState,
  ReportReasonBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
  initials,
  truncate,
} from './admin-shared'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'pending' | 'resolved' | 'dismissed'

export function AdminReports() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [filter, setFilter] = React.useState<Filter>('all')
  const [reports, setReports] = React.useState<AdminReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actingId, setActingId] = React.useState<string | null>(null)

  const load = React.useCallback(async (f: Filter) => {
    setLoading(true)
    try {
      const qs = f === 'all' ? '' : `?status=${f}`
      const res: any = await apiFetch(`/api/admin/reports${qs}`)
      setReports(res?.reports || [])
    } catch (e: any) {
      toast({ title: 'Failed to load reports', description: e?.message, variant: 'destructive' })
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
      await apiFetch('/api/admin/reports', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      toast({
        title: action === 'approve' ? 'Report approved' : 'Report rejected',
        description:
          action === 'approve'
            ? 'Reported user restricted (24h default)'
            : 'Report dismissed',
      })
      // Remove from list (or update status)
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: action === 'approve' ? 'resolved' : 'dismissed' }
            : r
        )
      )
      // If filtered to pending, drop the resolved/dismissed one
      if (filter === 'pending') {
        setReports((prev) => prev.filter((r) => r.status === 'pending'))
      } else if (filter === 'resolved' || filter === 'dismissed') {
        // refetch to include the freshly updated report
        load(filter)
      }
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Reports</h2>
        <p className="text-sm text-muted-foreground">Moderate user reports</p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all" className="min-h-[36px]">All</TabsTrigger>
          <TabsTrigger value="pending" className="min-h-[36px]">Pending</TabsTrigger>
          <TabsTrigger value="resolved" className="min-h-[36px]">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed" className="min-h-[36px]">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState title="No reports" hint="Nothing to moderate here" icon={Flag} />
          ) : isMobile ? (
            <div className="divide-y">
              {reports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  onAct={act}
                  acting={actingId === r.id}
                />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {reports.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  onAct={act}
                  acting={actingId === r.id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporterActor({ report }: { report: AdminReport }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8">
        {report.reporter?.avatar ? <AvatarImage src={report.reporter.avatar} alt={report.reporter.name} /> : null}
        <AvatarFallback>{initials(report.reporter?.name || '?')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{report.reporter?.name || '—'}</p>
        <p className="truncate text-xs text-muted-foreground">@{report.reporter?.username || '—'}</p>
      </div>
    </div>
  )
}

function ReportedTarget({ report }: { report: AdminReport }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8">
        {report.reportedUser?.avatar ? <AvatarImage src={report.reportedUser.avatar} alt={report.reportedUser.name} /> : null}
        <AvatarFallback>{initials(report.reportedUser?.name || (report.reportedGroup?.name || 'G'))}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {report.reportedUser?.name || report.reportedGroup?.name || '—'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {report.reportedUser
            ? `@${report.reportedUser.username}`
            : report.reportedGroup
              ? `Group · ${report.reportedGroup.category || '—'}`
              : '—'}
        </p>
      </div>
    </div>
  )
}

function ReportRow({
  report,
  onAct,
  acting,
}: {
  report: AdminReport
  onAct: (id: string, action: 'approve' | 'reject') => void
  acting: boolean
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-[180px] max-w-[220px] flex-1">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Reporter</p>
        <ReporterActor report={report} />
      </div>
      <div className="min-w-[180px] max-w-[220px] flex-1">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Reported</p>
        <ReportedTarget report={report} />
      </div>
      <div className="min-w-[100px] flex-1">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
        <ReportReasonBadge reason={report.reason} />
      </div>
      <div className="min-w-[200px] flex-1">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
        <p className="text-sm text-muted-foreground">{truncate(report.description, 80) || '—'}</p>
      </div>
      <div className="min-w-[100px]">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Date</p>
        <p className="text-sm">{formatDate(report.createdAt)}</p>
      </div>
      <div className="min-w-[80px]">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
        <StatusBadge status={report.status} />
      </div>
      {report.status === 'pending' && (
        <div className="flex min-w-[160px] justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="btn-brand h-9"
            disabled={acting}
            onClick={() => onAct(report.id, 'approve')}
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={acting}
            onClick={() => onAct(report.id, 'reject')}
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Reject
          </Button>
        </div>
      )}
    </li>
  )
}

function ReportCard({
  report,
  onAct,
  acting,
}: {
  report: AdminReport
  onAct: (id: string, action: 'approve' | 'reject') => void
  acting: boolean
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <ReportReasonBadge reason={report.reason} />
        <StatusBadge status={report.status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Reporter</p>
          <ReporterActor report={report} />
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Reported</p>
          <ReportedTarget report={report} />
        </div>
      </div>
      {report.description && (
        <p className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
          {truncate(report.description, 200)}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{formatDateTime(report.createdAt)}</p>
      {report.status === 'pending' && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="btn-brand h-11 flex-1"
            disabled={acting}
            onClick={() => onAct(report.id, 'approve')}
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 flex-1"
            disabled={acting}
            onClick={() => onAct(report.id, 'reject')}
          >
            {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
