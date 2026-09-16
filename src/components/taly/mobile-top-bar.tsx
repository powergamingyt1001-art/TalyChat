'use client'

import { Bell, Gift, Bot } from 'lucide-react'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  title?: string
  user?: any
  onDailyReward: () => void
  onOpenTaly: () => void
}

export function MobileTopBar({ title, user, onDailyReward, onOpenTaly }: Props) {
  const [notifications, setNotifications] = useState<any[]>([])
  const [openNotif, setOpenNotif] = useState(false)

  const loadNotifs = async () => {
    try {
      const res: any = await apiFetch('/api/notifications?unreadOnly=true')
      const list = Array.isArray(res) ? res : res?.notifications || []
      setNotifications(list)
    } catch {}
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifs()
    const t = setInterval(loadNotifs, 30000)
    return () => clearInterval(t)
  }, [])

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read', { method: 'POST' })
      setNotifications([])
    } catch {}
  }

  const isPremium = !!user?.isPremium

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2">
        <img
          src="/logo.png"
          alt="TalyChat"
          className={
            isPremium
              ? 'h-7 w-7 rounded-lg ring-2 ring-amber-400/60'
              : 'h-7 w-7 rounded-lg'
          }
          style={
            isPremium
              ? { filter: 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.5))' }
              : undefined
          }
        />
        <span
          className={
            isPremium
              ? 'text-base font-bold text-amber-600 dark:text-amber-400'
              : 'text-base font-bold text-primary'
          }
        >
          TalyChat
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={onDailyReward} aria-label="Daily reward" className="h-9 w-9">
          <Gift className="h-5 w-5" />
        </Button>

        <Button size="icon" variant="ghost" onClick={onOpenTaly} aria-label="Ask Taly" className="h-9 w-9">
          <Bot className="h-5 w-5" />
        </Button>

        <Popover open={openNotif} onOpenChange={setOpenNotif}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Notifications" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No new notifications</div>
              ) : (
                notifications.slice(0, 30).map((n: any) => (
                  <div key={n.id} className="border-b px-3 py-2 hover:bg-accent/50">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
