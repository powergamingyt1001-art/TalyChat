'use client'

import * as React from 'react'
import {
  LayoutDashboard,
  Ticket,
  CreditCard,
  Repeat,
  UserCog,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminDashboard } from './admin-dashboard'
import { AdminRedeem } from './admin-redeem'
import { AdminPayments } from './admin-payments'
import { AdminSubscriptions } from './admin-subscriptions'
import { AdminProfile } from './admin-profile'
import { initials } from './admin-shared'

// V2 — new 5-tab admin navigation.
// Old tabs (Members / Reports / Settings) are merged into Dashboard drilldowns
// or into the new Profile tab.
export type AdminTab = 'dashboard' | 'redeem' | 'payments' | 'subscriptions' | 'profile'

const NAV: { id: AdminTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'redeem', label: 'Redeem', icon: Ticket },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
  { id: 'profile', label: 'Profile', icon: UserCog },
]

export function AdminApp() {
  const { user, logout } = useAuth()
  const isMobile = useIsMobile()
  const [tab, setTab] = React.useState<AdminTab>('dashboard')

  // Allow child tabs to programmatically switch tabs (e.g. Payments → Subscriptions).
  const switchTab = React.useCallback((t: AdminTab) => setTab(t), [])

  return (
    <div className="taly-shell min-h-[100dvh] overflow-hidden bg-background">
      {/* Header — sticky top */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo.png" alt="TalyChat" className="h-8 w-8 rounded-md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">
              TalyChat <span className="text-foreground">Admin</span>
            </p>
            <p className="truncate text-[10px] text-muted-foreground">Control Panel</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 sm:flex sm:items-center sm:gap-2">
            <Avatar className="size-8">
              {user?.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
              <AvatarFallback>{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="h-9 min-h-[44px]"
            aria-label="Logout"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Body — sidebar + main (desktop) OR full-width main + bottom nav (mobile) */}
      <div className="taly-main flex min-h-0 flex-1">
        {isMobile ? null : (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto scroll-pan-y border-r bg-sidebar/40 p-2 md:block">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => {
                const Icon = item.icon
                const active = tab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>
        )}

        {/* Main content — PRD-1: spacing reduced to px-3 max (was sm:p-5
            md:p-6) so cards have less left/right empty space on tablet +
            desktop, matching the profile screen's tighter layout. */}
        <main className="scroll-pan-y min-w-0 flex-1 overflow-y-auto p-3">
          <div className="mx-auto max-w-6xl">
            {tab === 'dashboard' && <AdminDashboard />}
            {tab === 'redeem' && <AdminRedeem />}
            {tab === 'payments' && <AdminPayments onGotoSubscriptions={() => switchTab('subscriptions')} />}
            {tab === 'subscriptions' && <AdminSubscriptions />}
            {tab === 'profile' && <AdminProfile onLogout={logout} />}
          </div>
          {/* Bottom spacer for mobile nav */}
          {isMobile && <div className="h-16" />}
        </main>
      </div>

      {/* Bottom nav — mobile only, sticky */}
      {isMobile && (
        <nav
          className="sticky bottom-0 z-30 flex w-full items-center justify-around border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
          aria-label="Admin navigation"
        >
          {NAV.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'relative flex min-h-[44px] flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                <span className={cn('font-medium', active && 'font-semibold')}>{item.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
