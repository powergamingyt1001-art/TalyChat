'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Shared types (mirrors of API response shapes used by admin)
// ============================================================

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  newToday: number
  totalGroups: number
  reports: number
  restricted: number
  premium: number
  expiredPlans: number
  revenue: number
  adImpressions: number
  adClicks: number
  rewardClaims: number
  salesData: { label: string; value: number }[]
  userGrowth: { label: string; value: number }[]
  activeInactive: { active: number; inactive: number }
  period: string
}

export interface AdminUserListItem {
  id: string
  name: string
  username: string
  email: string
  role: 'user' | 'admin'
  isPremium: boolean
  isOnline: boolean
  isRestricted: boolean
  avatar?: string | null
  gender?: string | null
  dob?: string | null
  lastSeen?: string | null
  createdAt: string
  joinedAt: string
  updatedAt?: string
}

export interface AdminUsersResponse {
  users: AdminUserListItem[]
  total: number
  active: number
  newToday: number
  male: number
  female: number
  under18: number
  over18: number
  filteredTotal: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminUserDetail {
  id: string
  name: string
  username: string
  email: string
  role: 'user' | 'admin'
  isPremium: boolean
  isOnline: boolean
  isRestricted: boolean
  isBlocked?: boolean
  avatar?: string | null
  bio?: string | null
  gender?: string | null
  dob?: string | null
  phone?: string | null
  premiumUntil?: string | null
  restrictedUntil?: string | null
  lastSeen?: string | null
  createdAt: string
  conversations: any[]
  reports: { made: any[]; received: any[] }
  paymentProofs: any[]
  subscriptions: any[]
  referrals: { given: any[]; received: any[] }
}

export interface AdminReport {
  id: string
  reason: string
  description?: string | null
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  reporterId: string
  reportedUserId: string | null
  reportedGroupId: string | null
  adminNote?: string | null
  createdAt: string
  updatedAt?: string
  reporter?: {
    id: string
    name: string
    username: string
    email: string
    avatar?: string | null
  } | null
  reportedUser?: {
    id: string
    name: string
    username: string
    email: string
    avatar?: string | null
    isRestricted: boolean
    isBlocked: boolean
  } | null
  reportedGroup?: {
    id: string
    name: string
    category?: string | null
    logo?: string | null
  } | null
}

export interface AdminRedeemCode {
  id: string
  code: string
  premiumMonths: number
  note?: string | null
  count: number
  expiry?: string | null
  isActive: boolean
  createdAt: string
  creator?: { id: string; name: string; username: string } | null
  redemptionCount: number
  redemptions?: { userId: string; redeemedAt: string; user?: { id: string; username: string; name: string } }[]
}

export interface AdminAd {
  id: string
  brandName: string
  headline: string
  description?: string | null
  imageUrl?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  placement: 'in-chat' | 'home' | 'discover'
  category?: string | null
  startDate: string
  endDate?: string | null
  isActive: boolean
  impressions: number
  clicks: number
  createdAt: string
  creator?: { id: string; name: string; username: string } | null
}

export interface AdminPayment {
  id: string
  plan: string
  amount: number
  transactionId: string
  utrNumber?: string | null
  screenshotUrl?: string | null
  notes?: string | null
  status: 'pending' | 'approved' | 'rejected'
  adminNote?: string | null
  createdAt: string
  reviewedAt?: string | null
  user: {
    id: string
    name: string
    username: string
    email: string
    avatar?: string | null
    isPremium: boolean
    premiumUntil?: string | null
  }
}

export interface AdminTalyRequest {
  id: string
  message: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote?: string | null
  createdAt: string
  reviewedAt?: string | null
  user: {
    id: string
    name: string
    username: string
    email: string
    avatar?: string | null
    isPremium: boolean
  }
}

// ============================================================
// Helpers
// ============================================================

export function formatDate(d?: string | Date | null): string {
  if (!d) return '—'
  try {
    const date = new Date(d)
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—'
  try {
    const date = new Date(d)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function formatINR(amount: number): string {
  try {
    return '₹' + (amount || 0).toLocaleString('en-IN')
  } catch {
    return '₹0'
  }
}

export function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '…' : s
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

// ============================================================
// Reusable bits
// ============================================================

export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}

export function FullLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon: Icon,
}: {
  title: string
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/60" />}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'primary' | 'warning' | 'danger' | 'info'
  hint?: string
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'warning'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : tone === 'danger'
          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : tone === 'info'
            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
            : 'bg-muted text-muted-foreground'

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    reviewed: {
      label: 'Reviewed',
      className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    },
    resolved: {
      label: 'Resolved',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    dismissed: {
      label: 'Dismissed',
      className: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
    },
    approved: {
      label: 'Approved',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    },
  }
  const cfg = map[status] || { label: status, className: 'bg-muted text-muted-foreground border-border' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  )
}

export function ReportReasonBadge({ reason }: { reason: string }) {
  const palette: Record<string, string> = {
    Spam: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    Harassment: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    Scam: 'bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30',
    Illegal: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    Fake: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    Other: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
  }
  const cls = palette[reason] || palette.Other
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        cls
      )}
    >
      {reason}
    </span>
  )
}
