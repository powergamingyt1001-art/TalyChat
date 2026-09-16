'use client'

import { Button } from '@/components/ui/button'
import { PremiumAvatar } from '@/components/premium-avatar'
import { NAV_ITEMS } from '@/components/taly/bottom-nav'
import { SoundTogglePopover } from '@/components/taly/sound-toggle'
import { Gift, Bot, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-store'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { ConversationSummary } from '@/components/taly-app'

interface Props {
  active: any
  onChange: (id: any) => void
  user: any
  onDailyReward: () => void
  onTalySupport: () => void
  conversations: ConversationSummary[]
  onOpenChat: (c: ConversationSummary) => void
}

export function DesktopSidebar({
  active,
  onChange,
  user,
  onDailyReward,
  onTalySupport,
  onOpenChat,
}: Props) {
  const { logout } = useAuth()
  const { toast } = useToast()
  const isPremium = !!user?.isPremium

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-sidebar/50">
      <div className="flex items-center gap-2 border-b px-4 py-4">
        <img
          src="/logo.png"
          alt="TalyChat"
          className={
            isPremium
              ? 'h-9 w-9 rounded-lg ring-2 ring-amber-400/60'
              : 'h-9 w-9 rounded-lg'
          }
          style={
            isPremium
              ? { filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.5))' }
              : undefined
          }
        />
        <div>
          <h1
            className={
              isPremium
                ? 'text-lg font-bold text-amber-600 dark:text-amber-400'
                : 'text-lg font-bold text-primary'
            }
          >
            TalyChat
          </h1>
          <p className="text-[10px] text-muted-foreground">Chat. Connect. Mingle.</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}

        <div className="my-2 border-t" />

        <button
          onClick={onTalySupport}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Bot className="h-5 w-5" />
          <span className="font-medium">Ask Taly</span>
          <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            AI
          </span>
        </button>

        <button
          onClick={onDailyReward}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Gift className="h-5 w-5" />
          <span className="font-medium">Daily Reward</span>
        </button>

        <div className="mt-1 flex items-center gap-2 px-3 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sound
          </span>
          <div className="ml-auto">
            <SoundTogglePopover />
          </div>
        </div>
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-sidebar-accent/50">
          <PremiumAvatar
            user={{
              isPremium: user?.isPremium,
              premiumTier: user?.premiumTier,
              avatar: user?.avatar || undefined,
              name: user?.name || 'U',
            }}
            size={36}
            showAura
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">@{user?.username}</div>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={() => onChange('profile')}
          >
            <Settings className="mr-1 h-4 w-4" /> Settings
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              logout()
              toast({ title: 'Logged out' })
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
