import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/stats?period=today|7days|monthly|quarterly
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '7days'

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    // ---------- Top-level metrics ----------
    const [
      totalUsers,
      activeUsers,
      newToday,
      totalGroups,
      reports,
      restricted,
      premium,
      expiredPlansAgg,
      revenuePaymentAgg,
      revenueSubAgg,
      adImpressionsAgg,
      adClicksAgg,
      rewardClaims,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { isOnline: true } }),
      db.user.count({ where: { createdAt: { gte: startOfToday } } }),
      db.group.count(),
      db.report.count({ where: { status: 'pending' } }),
      db.user.count({ where: { isRestricted: true } }),
      db.user.count({ where: { isPremium: true } }),
      db.user.count({
        where: { premiumUntil: { not: null, lt: now } },
      }),
      db.paymentProof.aggregate({ _sum: { amount: true }, where: { status: 'approved' } }),
      db.subscription.aggregate({ _sum: { amount: true }, where: { source: 'payment' } }),
      db.advertisement.aggregate({ _sum: { impressions: true } }),
      db.advertisement.aggregate({ _sum: { clicks: true } }),
      db.dailyReward.count(),
    ])

    const revenue =
      (revenuePaymentAgg._sum.amount || 0) + (revenueSubAgg._sum.amount || 0)

    // ---------- Period range setup ----------
    const { startDate, buckets } = computeRange(period, now)

    // ---------- salesData (revenue per bucket) ----------
    const payments = await db.paymentProof.findMany({
      where: { status: 'approved', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
    })
    const subs = await db.subscription.findMany({
      where: { source: 'payment', createdAt: { gte: startDate } },
      select: { amount: true, createdAt: true },
    })
    const allSales: { amount: number; date: Date }[] = [
      ...payments.map((p) => ({ amount: p.amount, date: p.createdAt })),
      ...subs.map((s) => ({ amount: s.amount, date: s.createdAt })),
    ]
    const salesData = fillBuckets(buckets, allSales, (acc, item) => {
      acc.value += item.amount
    })

    // ---------- userGrowth (cumulative user count) ----------
    const usersInPeriod = await db.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    })
    const beforeCount = await db.user.count({
      where: { createdAt: { lt: startDate } },
    })
    let running = beforeCount
    const userGrowth = buckets.map((b) => {
      const added = usersInPeriod.filter((u) => bucketContains(b, u.createdAt)).length
      running += added
      return { label: b.label, value: running }
    })

    // ---------- activeInactive ----------
    const activeToday = await db.user.count({
      where: { lastSeen: { gte: startOfToday } },
    })
    const inactive = Math.max(0, totalUsers - activeToday)

    return ok({
      totalUsers,
      activeUsers,
      newToday,
      totalGroups,
      reports,
      restricted,
      premium,
      expiredPlans: expiredPlansAgg,
      revenue,
      adImpressions: adImpressionsAgg._sum.impressions || 0,
      adClicks: adClicksAgg._sum.clicks || 0,
      rewardClaims,
      salesData,
      userGrowth,
      activeInactive: { active: activeToday, inactive },
      period,
    })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// ============================================================
// Helpers — bucket generation & filling
// ============================================================

interface Bucket {
  label: string
  start: Date
  end: Date
}

function computeRange(period: string, now: Date): { startDate: Date; buckets: Bucket[] } {
  if (period === 'today') {
    // 24 hourly buckets from 00:00 to 23:00
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const buckets: Bucket[] = []
    for (let h = 0; h < 24; h++) {
      const s = new Date(start)
      s.setHours(h, 0, 0, 0)
      const e = new Date(start)
      e.setHours(h, 59, 59, 999)
      buckets.push({ label: `${h.toString().padStart(2, '0')}:00`, start: s, end: e })
    }
    return { startDate: start, buckets }
  }

  if (period === '7days') {
    // 7 daily buckets
    const buckets: Bucket[] = []
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - 6)
    for (let d = 0; d < 7; d++) {
      const s = new Date(start)
      s.setDate(start.getDate() + d)
      const e = new Date(s)
      e.setDate(s.getDate() + 1)
      e.setMilliseconds(-1)
      buckets.push({
        label: s.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        start: s,
        end: e,
      })
    }
    return { startDate: buckets[0].start, buckets }
  }

  if (period === 'monthly') {
    // ~4 weekly buckets for the current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const buckets: Bucket[] = []
    const cursor = new Date(monthStart)
    while (cursor <= now) {
      const s = new Date(cursor)
      const e = new Date(cursor)
      e.setDate(e.getDate() + 6)
      e.setHours(23, 59, 59, 999)
      if (e > now) e.setTime(now.getTime())
      buckets.push({
        label: `Wk ${buckets.length + 1}`,
        start: s,
        end: e,
      })
      cursor.setDate(cursor.getDate() + 7)
    }
    return { startDate: monthStart, buckets }
  }

  // quarterly — 3 monthly buckets
  const quarterStart = new Date(now)
  quarterStart.setMonth(quarterStart.getMonth() - 2)
  quarterStart.setDate(1)
  quarterStart.setHours(0, 0, 0, 0)
  const buckets: Bucket[] = []
  for (let m = 0; m < 3; m++) {
    const s = new Date(quarterStart)
    s.setMonth(s.getMonth() + m)
    const e = new Date(s)
    e.setMonth(e.getMonth() + 1)
    e.setMilliseconds(-1)
    if (e > now) e.setTime(now.getTime())
    buckets.push({
      label: s.toLocaleDateString('en-US', { month: 'short' }),
      start: s,
      end: e,
    })
  }
  return { startDate: quarterStart, buckets }
}

function bucketContains(b: Bucket, d: Date): boolean {
  return d >= b.start && d <= b.end
}

function fillBuckets<T>(
  buckets: Bucket[],
  items: (T & { date: Date })[],
  reducer: (acc: { label: string; value: number }, item: T & { date: Date }) => void,
): { label: string; value: number }[] {
  return buckets.map((b) => {
    const acc = { label: b.label, value: 0 }
    for (const it of items) {
      if (bucketContains(b, it.date)) reducer(acc, it)
    }
    return acc
  })
}
