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
  UserCheck,
  UserX,
  ShieldAlert,
  UserMinus,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  StatCard,
  type AdminStats,
  formatINR,
} from './admin-shared'
import { AdminMembers } from './admin-members'
import { AdminReports } from './admin-reports'
import { cn } from '@/lib/utils'

// ============================================================
// V2 — Period toggle: 7 Days | 1 Month | All Time
// (Old today/quarterly options removed per V2 spec.)
// ============================================================
type Period = '7days' | '1month' | 'alltime'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7days', label: '7 Days' },
  { id: '1month', label: '1 Month' },
  { id: 'alltime', label: 'All Time' },
]

// V2 chart palette — emerald brand colors + neutrals
const BRAND = 'oklch(0.72 0.18 152)'
const BRAND_SOFT = 'oklch(0.85 0.05 152)'
const BRAND_DEEP = 'oklch(0.55 0.18 152)'
const NEUTRAL = 'oklch(0.85 0.02 152)'
const AMBER = 'oklch(0.78 0.16 70)'
const SKY = 'oklch(0.72 0.13 220)'
const ROSE = 'oklch(0.65 0.18 18)'

interface MetricDef {
  key: keyof AdminStats | 'userStatus' | 'subscriptions'
  label: string
  icon: LucideIcon
  tone: 'default' | 'primary' | 'warning' | 'danger' | 'info'
  value: (s: AdminStats) => string
  // chart to render in drilldown dialog
  chart?: 'registerData' | 'userGrowth' | 'salesData' | 'piePremium' | 'pieActiveInactive' | 'pieSubs' | 'none'
  hint?: (s: AdminStats) => string
}

// The 12 metric cards (unchanged labels from V1)
const METRICS: MetricDef[] = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, tone: 'primary', value: (s) => s.totalUsers.toLocaleString('en-IN'), chart: 'userGrowth' },
  { key: 'activeUsers', label: 'Active Now', icon: Zap, tone: 'info', value: (s) => s.activeUsers.toLocaleString('en-IN'), chart: 'registerData' },
  { key: 'newToday', label: 'New Today', icon: UserPlus, tone: 'primary', value: (s) => s.newToday.toLocaleString('en-IN'), chart: 'registerData' },
  { key: 'totalGroups', label: 'Total Groups', icon: Group, tone: 'default', value: (s) => s.totalGroups.toLocaleString('en-IN'), chart: 'none' },
  { key: 'reports', label: 'Pending Reports', icon: Flag, tone: 'warning', value: (s) => s.reports.toLocaleString('en-IN'), chart: 'none' },
  { key: 'restricted', label: 'Restricted Users', icon: Ban, tone: 'danger', value: (s) => s.restricted.toLocaleString('en-IN'), chart: 'none' },
  { key: 'premium', label: 'Premium Users', icon: Crown, tone: 'warning', value: (s) => s.premium.toLocaleString('en-IN'), chart: 'piePremium' },
  { key: 'expiredPlans', label: 'Expired Plans', icon: CalendarX, tone: 'danger', value: (s) => s.expiredPlans.toLocaleString('en-IN'), chart: 'piePremium' },
  { key: 'revenue', label: 'Revenue', icon: IndianRupee, tone: 'primary', value: (s) => formatINR(s.revenue), chart: 'salesData' },
  { key: 'adImpressions', label: 'Ad Impressions', icon: Eye, tone: 'default', value: (s) => s.adImpressions.toLocaleString('en-IN'), chart: 'none' },
  { key: 'adClicks', label: 'Ad Clicks', icon: MousePointerClick, tone: 'default', value: (s) => s.adClicks.toLocaleString('en-IN'), chart: 'none' },
  { key: 'rewardClaims', label: 'Reward Claims', icon: Gift, tone: 'info', value: (s) => s.rewardClaims.toLocaleString('en-IN'), chart: 'none' },
]

// V2 — User Status cards (Active / Inactive / Banned / Deactivated)
interface UserStatusDef {
  key: 'active' | 'inactive' | 'banned' | 'deactivated'
  label: string
  icon: LucideIcon
  tone: 'primary' | 'default' | 'danger' | 'warning'
  value: (s: AdminStats) => number
}
const USER_STATUS_METRICS: UserStatusDef[] = [
  { key: 'active', label: 'Active (online)', icon: UserCheck, tone: 'primary', value: (s) => s.userStatus?.active ?? 0 },
  { key: 'inactive', label: 'Inactive', icon: UserX, tone: 'default', value: (s) => s.userStatus?.inactive ?? 0 },
  { key: 'banned', label: 'Banned', icon: ShieldAlert, tone: 'danger', value: (s) => s.userStatus?.banned ?? 0 },
  { key: 'deactivated', label: 'Deactivated', icon: UserMinus, tone: 'warning', value: (s) => s.userStatus?.deactivated ?? 0 },
]

// V2 — Subscriptions cards (Paid / Free / Expired)
interface SubsDef {
  key: 'paid' | 'free' | 'expired'
  label: string
  icon: LucideIcon
  tone: 'primary' | 'default' | 'danger'
  value: (s: AdminStats) => number
}
const SUBS_METRICS: SubsDef[] = [
  { key: 'paid', label: 'Paid Subscriptions', icon: CreditCard, tone: 'primary', value: (s) => s.subscriptions?.paid ?? 0 },
  { key: 'free', label: 'Free Users', icon: Users, tone: 'default', value: (s) => s.subscriptions?.free ?? 0 },
  { key: 'expired', label: 'Expired Subscriptions', icon: CalendarX, tone: 'danger', value: (s) => s.subscriptions?.expired ?? 0 },
]

export function AdminDashboard() {
  const { toast } = useToast()
  const [stats, setStats] = React.useState<AdminStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [period, setPeriod] = React.useState<Period>('7days')
  const [drilldown, setDrilldown] = React.useState<MetricDef | UserStatusDef | SubsDef | null>(null)

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
        <div className="inline-flex rounded-lg border bg-card p-1 shadow-sm" role="group" aria-label="Period selector">
          {PERIODS.map((p) => {
            const active = period === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                aria-pressed={active}
                className={cn(
                  'min-h-[40px] rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 12 metric cards (kept from V1) */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Overview metrics</h3>
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
      </section>

      {/* V2 — User Status cards (4 cards) */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">User status</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {USER_STATUS_METRICS.map((m) => {
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
                  value={m.value(stats).toLocaleString('en-IN')}
                  icon={m.icon}
                  tone={m.tone}
                />
              </button>
            )
          })}
        </div>
      </section>

      {/* V2 — Subscriptions cards (3 cards) */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Subscriptions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUBS_METRICS.map((m) => {
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
                  value={m.value(stats).toLocaleString('en-IN')}
                  icon={m.icon}
                  tone={m.tone}
                />
              </button>
            )
          })}
        </div>
      </section>

      {/* Chart 1: Candle/Bar — new user registrations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">New user registrations</CardTitle>
          <p className="text-xs text-muted-foreground">
            {period === '7days'
              ? 'Daily new sign-ups (last 7 days)'
              : period === '1month'
                ? 'Weekly new sign-ups (this month)'
                : 'Monthly new sign-ups (all time)'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {loading || !stats ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.registerData ?? []}
                  margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={36} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: number) => [v, 'New users']}
                  />
                  {/* Candle-like tall thin bars with rounded tops */}
                  <Bar
                    dataKey="count"
                    fill={BRAND}
                    radius={[6, 6, 0, 0]}
                    barSize={period === 'alltime' ? 28 : 38}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Chart 2: Pie — Active vs Inactive members */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active vs Inactive</CardTitle>
            <p className="text-xs text-muted-foreground">Members active (last 24h) vs dormant</p>
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
                        { name: 'active', value: stats.activeVsInactive?.active ?? stats.activeInactive.active },
                        { name: 'inactive', value: stats.activeVsInactive?.inactive ?? stats.activeInactive.inactive },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={(e: any) => e.value}
                    >
                      <Cell fill={BRAND} />
                      <Cell fill={NEUTRAL} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Active ({stats?.activeVsInactive?.active ?? stats?.activeInactive.active ?? 0})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                Inactive ({stats?.activeVsInactive?.inactive ?? stats?.activeInactive.inactive ?? 0})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Column — User growth (cumulative) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">User growth (cumulative)</CardTitle>
            <p className="text-xs text-muted-foreground">Cumulative total users over period</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {loading || !stats ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.userGrowth ?? []}
                    margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={36} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [v, 'Total users']}
                    />
                    <Bar
                      dataKey="value"
                      fill={BRAND_DEEP}
                      radius={[4, 4, 0, 0]}
                      barSize={period === 'alltime' ? 24 : 32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart 4: Pie — Subscriptions: Paid / Free / Expired */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subscriptions breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Paid vs free vs expired subscriptions</p>
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
                    formatter={(v: number, n) => [v, n]}
                  />
                  <Pie
                    data={[
                      { name: 'Paid', value: stats.subscriptions?.paid ?? 0 },
                      { name: 'Free', value: stats.subscriptions?.free ?? 0 },
                      { name: 'Expired', value: stats.subscriptions?.expired ?? 0 },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    label={(e: any) => `${e.name}: ${e.value}`}
                  >
                    <Cell fill={BRAND} />
                    <Cell fill={NEUTRAL} />
                    <Cell fill={ROSE} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Paid ({stats?.subscriptions?.paid ?? 0})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              Free ({stats?.subscriptions?.free ?? 0})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Expired ({stats?.subscriptions?.expired ?? 0})
            </span>
          </div>
        </CardContent>
      </Card>

      {/* V2 — Members section (kept accessible from Dashboard; no separate tab).
          Renders the existing admin-members component which has its own
          search, table, and user-detail dialog. */}
      <AdminMembers />

      {/* V2 — Reports section (kept accessible from Dashboard; no separate tab).
          Renders the existing admin-reports component with approve/reject. */}
      <AdminReports />

      <DrilldownDialog
        metric={drilldown}
        stats={stats}
        period={period}
        onClose={() => setDrilldown(null)}
      />
    </div>
  )
}

// ============================================================
// Drilldown dialog — opens when any metric card is clicked.
// Renders a mini chart for that metric.
// ============================================================
function DrilldownDialog({
  metric,
  stats,
  period,
  onClose,
}: {
  metric: MetricDef | UserStatusDef | SubsDef | null
  stats: AdminStats | null
  period: Period
  onClose: () => void
}) {
  if (!metric) return null

  // Resolve common fields
  const Icon = metric.icon
  const label = metric.label
  const tone = metric.tone
  const rawValue = metric.value(stats as AdminStats)
  const valueStr = typeof rawValue === 'string' ? rawValue : rawValue.toLocaleString('en-IN')

  const chart = (metric as MetricDef).chart ?? 'none'
  const periodLabel =
    period === '7days' ? '7 Days' : period === '1month' ? '1 Month' : 'All Time'

  return (
    <Dialog open={!!metric} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {label}
          </DialogTitle>
          <DialogDescription>
            Period: <span className="font-medium">{periodLabel}</span> · current value:{' '}
            <span className="font-semibold text-foreground">{stats ? valueStr : '—'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="h-[280px] w-full">
          {!stats ? (
            <Skeleton className="h-full w-full" />
          ) : chart === 'none' ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Icon className="h-12 w-12 opacity-30" />
              <p className="text-sm">No time-series breakdown for this metric.</p>
              <p className="text-xs">
                Snapshot value: <span className="font-semibold text-foreground">{valueStr}</span>
              </p>
            </div>
          ) : chart === 'salesData' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.salesData ?? []} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [formatINR(v), 'Revenue']}
                />
                <Bar dataKey="value" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : chart === 'userGrowth' ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.userGrowth ?? []} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={BRAND}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : chart === 'registerData' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.registerData ?? []} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={36} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: number) => [v, 'New users']}
                />
                <Bar dataKey="count" fill={BRAND} radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : chart === 'pieActiveInactive' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Pie
                  data={[
                    { name: 'Active', value: stats.activeVsInactive?.active ?? stats.activeInactive.active },
                    { name: 'Inactive', value: stats.activeVsInactive?.inactive ?? stats.activeInactive.inactive },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label={(e: any) => `${e.name}: ${e.value}`}
                >
                  <Cell fill={BRAND} />
                  <Cell fill={NEUTRAL} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : chart === 'piePremium' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Pie
                  data={[
                    { name: 'Premium', value: stats.premium },
                    { name: 'Expired', value: stats.expiredPlans },
                    {
                      name: 'Free',
                      value: Math.max(0, stats.totalUsers - stats.premium),
                    },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label={(e: any) => `${e.name}: ${e.value}`}
                >
                  <Cell fill={AMBER} />
                  <Cell fill={ROSE} />
                  <Cell fill={NEUTRAL} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : chart === 'pieSubs' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Pie
                  data={[
                    { name: 'Paid', value: stats.subscriptions?.paid ?? 0 },
                    { name: 'Free', value: stats.subscriptions?.free ?? 0 },
                    { name: 'Expired', value: stats.subscriptions?.expired ?? 0 },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label={(e: any) => `${e.name}: ${e.value}`}
                >
                  <Cell fill={BRAND} />
                  <Cell fill={NEUTRAL} />
                  <Cell fill={ROSE} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Tone: <span className="font-medium capitalize">{tone}</span></span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
