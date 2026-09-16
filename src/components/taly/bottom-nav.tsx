'use client'

import { Home, MessageCircle, Users, Compass, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'profile', label: 'Profile', icon: User },
] as const

interface BottomNavProps {
  active: (typeof NAV_ITEMS)[number]['id']
  onChange: (id: any) => void
  unread?: number
}

export function BottomNav({ active, onChange, unread }: BottomNavProps) {
  return (
    <nav
      className="sticky bottom-0 z-30 flex w-full items-center justify-around border-t bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Bottom navigation"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = active === item.id
        const showBadge = item.id === 'chats' && unread && unread > 0
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors min-h-[44px]',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              {showBadge && (
                <span className="absolute -right-1.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <span className={cn('font-medium', isActive && 'font-semibold')}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
