'use client'

import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Users,
  Zap,
  UserPlus,
  Group,
  Flag,
  Ban,
  Crown,
  CalendarX,
  IndianRupee,
  Eye,
  MousePointerClick,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, type AdminStats, formatINR } from './admin-shared'
import { cn } from '@/lib/utils'

type Period = 'today' | '7days' | 'monthly' | 'quarterly'

interface MetricDef {
  key: keyof AdminStats | 'activeInactive'
  label: string
  icon: LucideIcon
  tone: 'default' | 'primary' | 'warning' | 'danger' | 'info'
  value: (s: AdminStats) => string
  hint?: (s: AdminStats) => string
}

const METRICS: MetricDef[] = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, tone: 'primary', value: (s) => s.totalUsers.toLocaleString('en-IN') },
  { key: 'activeUsers', label: 'Active Now', icon: Zap, tone: 'info', value: (s) => s.activeUsers.toLocaleString('en-IN') },
  { key: 'newToday', label: 'New Today', icon: UserPlus, tone: 'primary', value: (s) => s.newToday.toLocaleString('en-IN') },
  { key: 'totalGroups', label: 'Total Groups', icon: Group, tone: 'default', value: (s) => s.totalGroups.toLocaleString('en-IN') },
  { key: 'reports', label: 'Pending Reports', icon: Flag, tone: 'warning', value: (s) => s.reports.toLocaleString('en-IN') },
  { key: 'restricted', label: 'Restricted Users', icon: Ban, tone: 'danger', value: (s) => s.restricted.toLocaleString('en-IN') },
  { key: 'premium', label: 'Premium Users', icon: Crown, tone: 'warning', value: (s) => s.premium.toLocaleString('en-IN') },
  { key: 'expiredPlans', label: 'Expired Plans', icon: CalendarX, tone: 'danger', value: (s) => s.expiredPlans.toLocaleString('en-IN') },
  { key: 'revenue', label: 'Revenue', icon: IndianRupee, tone: 'primary', value: (s) => formatINR(s.revenue) },
  { key: 'adImpressions', label: 'Ad Impressions', icon: Eye, tone: 'default', value: (s) => s.adImpressions.toLocaleString('en-IN') },
  { key: 'adClicks', label: 'Ad Clicks', icon: MousePointerClick, tone: 'default', value: (s) => s.adClicks.toLocaleString('en-IN') },
  { key: 'rewardClaims', label: 'Reward Claims', icon: Gift, tone: 'info', value: (s) => s.rewardClaims.toLocaleString('en-IN') },
]

export function AdminDashboard() {
  const { toast } = useToast()
  const [stats, setStats] = React.useState<AdminStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [period, setPeriod] = React.useState<Period>('7days')
  const [drilldown, setDrilldown] = React.useState<MetricDef | null>(null)

  const load = React.useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/api/admin/stats?period=${p}`)
      setStats(res as AdminStats)
    } catch (e: any) {
      toast({ title: 'Failed to load stats', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load(period)
  }, [period, load])

  return (
    <div className="flex flex-col gap-6">
      {/* Period toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">TalyChat admin overview & analytics</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">7 Days</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 12 metric cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {METRICS.map((m) => {
          if (loading || !stats) {
            return <Skeleton key={m.label} className="h-[88px] rounded-xl" />
          }
          return (
            <button
              key={m.label}
              onClick={() => setDrilldown(m)}
              className="text-left transition-transform active:scale-[0.98]"
              aria-label={`${m.label} — tap for details`}
            >
              <StatCard
                label={m.label}
                value={m.value(stats)}
                icon={m.icon}
                tone={m.tone}
                hint={m.hint ? m.hint(stats) : undefined}
              />
            </button>
          )
        })}
      </div>

      {/* Sales bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sales / Purchases</CardTitle>
          <p className="text-xs text-muted-foreground">Revenue per period bucket</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {loading || !stats ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.salesData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={48} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [formatINR(v), 'Revenue']}
                  />
                  <Bar dataKey="value" fill="oklch(0.72 0.18 152)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Active vs Inactive pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active vs Inactive</CardTitle>
            <p className="text-xs text-muted-foreground">Members active today vs dormant</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading || !stats ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number, n) => [v, n === 'active' ? 'Active' : 'Inactive']}
                    />
                    <Pie
                      data={[
                        { name: 'active', value: stats.activeInactive.active },
                        { name: 'inactive', value: stats.activeInactive.inactive },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      <Cell fill="oklch(0.72 0.18 152)" />
                      <Cell fill="oklch(0.85 0.02 152)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Active ({stats?.activeInactive.active ?? 0})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                Inactive ({stats?.activeInactive.inactive ?? 0})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* User growth line */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">User Growth</CardTitle>
            <p className="text-xs text-muted-foreground">Cumulative users over period</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading || !stats ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.userGrowth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={48} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="oklch(0.72 0.18 152)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DrilldownDialog
        metric={drilldown}
        stats={stats}
        period={period}
        onClose={() => setDrilldown(null)}
      />
    </div>
  )
}

function DrilldownDialog({
  metric,
  stats,
  period,
  onClose,
}: {
  metric: MetricDef | null
  stats: AdminStats | null
  period: Period
  onClose: () => void
}) {
  if (!metric) return null
  const data =
    metric.key === 'revenue'
      ? stats?.salesData ?? []
      : metric.key === 'totalUsers' || metric.key === 'newToday'
        ? stats?.userGrowth ?? []
        : metric.key === 'activeInactive'
          ? [
              { label: 'Active', value: stats?.activeInactive.active ?? 0 },
              { label: 'Inactive', value: stats?.activeInactive.inactive ?? 0 },
            ]
          : stats?.userGrowth ?? []

  const isPie = metric.key === 'activeInactive'

  return (
    <Dialog open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <metric.icon className="h-5 w-5 text-primary" />
            {metric.label}
          </DialogTitle>
          <DialogDescription>
            Period: <span className="font-medium capitalize">{period}</span> ·{' '}
            current value:{' '}
            <span className="font-semibold text-foreground">{stats ? metric.value(stats) : '—'}</span>
          </DialogDescription>
        </DialogHeader>
        <div className={cn('h-[280px] w-full')}>
          {stats ? (
            isPie ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Pie data={data} dataKey="value" nameKey="label" outerRadius={100}>
                    <Cell fill="oklch(0.72 0.18 152)" />
                    <Cell fill="oklch(0.85 0.02 152)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : metric.key === 'revenue' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={48} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [formatINR(v), 'Revenue']}
                  />
                  <Bar dataKey="value" fill="oklch(0.72 0.18 152)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={48} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="oklch(0.72 0.18 152)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
