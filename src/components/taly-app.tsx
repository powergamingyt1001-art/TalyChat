'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch } from '@/lib/api'
import { useSocket } from '@/lib/socket'
import { HomeScreen } from '@/components/taly/home-screen'
import { ChatsScreen } from '@/components/taly/chats-screen'
import { GroupsScreen } from '@/components/taly/groups-screen'
import { DiscoverScreen } from '@/components/taly/discover-screen'
import { ProfileScreen } from '@/components/taly/profile-screen'
import { ChatView } from '@/components/chat/chat-view'
import { TalySupportScreen } from '@/components/taly/taly-support-screen'
import { BottomNav, NAV_ITEMS } from '@/components/taly/bottom-nav'
import { MobileTopBar } from '@/components/taly/mobile-top-bar'
import { DesktopSidebar } from '@/components/taly/desktop-sidebar'
import { DailyRewardDialog } from '@/components/taly/daily-reward-dialog'
import { useMediaQuery } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { CustomizerProvider } from '@/components/taly/customizer-context'

export type TalyTab = (typeof NAV_ITEMS)[number]['id']
export type TalyView =
  | { kind: 'tab'; tab: TalyTab }
  | { kind: 'chat'; conversationId: string; name: string; avatar?: string; isGroup?: boolean; backTo?: TalyTab }
  | { kind: 'taly-support' }

export interface ConversationSummary {
  id: string
  type: 'private' | 'group'
  name: string
  avatar?: string | null
  lastMessage?: any
  unread?: number
  muted?: boolean
  pinned?: boolean
  otherUser?: any
  group?: any
  updatedAt?: string
}

export function TalyApp() {
  const { user } = useAuth()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [tab, setTab] = useState<TalyTab>('home')
  const [openChat, setOpenChat] = useState<null | {
    conversationId: string
    name: string
    avatar?: string
    isGroup?: boolean
  }>(null)
  const [talyOpen, setTalyOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [preferences, setPreferences] = useState<any>(null)

  // Load preferences
  useEffect(() => {
    apiFetch('/api/preferences')
      .then((res: any) => setPreferences(res))
      .catch(() => {})
  }, [])

  // Apply theme/wallpaper/font to document root
  useEffect(() => {
    const root = document.documentElement
    if (preferences?.theme === 'dark') root.classList.add('dark')
    else if (preferences?.theme === 'light') root.classList.remove('dark')
    else {
      // system
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      if (mql.matches) root.classList.add('dark')
      else root.classList.remove('dark')
    }
  }, [preferences?.theme])

  useEffect(() => {
    const root = document.documentElement
    if (preferences?.fontSize) {
      root.style.setProperty('--taly-font-size', `${preferences.fontSize}px`)
    }
    if (preferences?.fontFamily) {
      root.setAttribute('data-taly-font', preferences.fontFamily)
    }
  }, [preferences?.fontSize, preferences?.fontFamily])

  // Load conversations
  const refreshConversations = async () => {
    try {
      const res: any = await apiFetch('/api/conversations')
      const list = Array.isArray(res) ? res : res?.conversations || []
      setConversations(list)
    } catch {}
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConversations()
  }, [])

  // Socket for live updates
  useSocket({
    'message:new': (payload: any) => {
      const conv = payload?.conversationId
      if (!conv) return
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conv)
        if (!existing) {
          refreshConversations()
          return prev
        }
        return [
          { ...existing, lastMessage: payload.message, updatedAt: new Date().toISOString() },
          ...prev.filter((c) => c.id !== conv),
        ]
      })
    },
  })

  const shellClass = useMemo(
    () =>
      cn(
        'taly-shell min-h-[100dvh] bg-background text-foreground',
        // Apply wallpaper as a CSS background only on chat view, not whole shell
      ),
    []
  )

  // Render: chat view overrides tabs (full screen)
  if (openChat) {
    return (
      <CustomizerProvider preferences={preferences}>
        <div className={shellClass}>
          <ChatView
            conversationId={openChat.conversationId}
            name={openChat.name}
            avatar={openChat.avatar}
            isGroup={openChat.isGroup}
            onBack={() => {
              setOpenChat(null)
              refreshConversations()
            }}
            preferences={preferences}
          />
        </div>
      </CustomizerProvider>
    )
  }

  // Taly Support screen
  if (talyOpen) {
    return (
      <div className={shellClass}>
        <TalySupportScreen onBack={() => setTalyOpen(false)} />
      </div>
    )
  }

  return (
    <CustomizerProvider preferences={preferences}>
      <div className={shellClass}>
        <div className="flex min-h-0 flex-1">
          {isDesktop && (
            <DesktopSidebar
              active={tab}
              onChange={(t) => setTab(t)}
              user={user}
              onDailyReward={() => setDailyOpen(true)}
              onTalySupport={() => setTalyOpen(true)}
              conversations={conversations}
              onOpenChat={(c) => setOpenChat(c)}
            />
          )}

          <main className="taly-main flex min-w-0 flex-1 flex-col">
            {!isDesktop && (
              <MobileTopBar
                title={tab === 'home' ? undefined : NAV_ITEMS.find((n) => n.id === tab)?.label}
                user={user}
                onDailyReward={() => setDailyOpen(true)}
                onOpenTaly={() => setTalyOpen(true)}
              />
            )}

            <div className="scroll-pan-y flex-1 overflow-y-auto">
              {tab === 'home' && (
                <HomeScreen
                  user={user}
                  onOpenChat={(c) =>
                    setOpenChat({
                      conversationId: c.id,
                      name: c.name,
                      avatar: c.avatar || undefined,
                      isGroup: c.type === 'group',
                    })
                  }
                  onNavigate={setTab}
                  onOpenTaly={() => setTalyOpen(true)}
                />
              )}
              {tab === 'chats' && (
                <ChatsScreen
                  conversations={conversations.filter((c) => c.type === 'private')}
                  onOpenChat={(c) =>
                    setOpenChat({
                      conversationId: c.id,
                      name: c.name,
                      avatar: c.avatar || undefined,
                      isGroup: false,
                    })
                  }
                  onRefresh={refreshConversations}
                />
              )}
              {tab === 'groups' && (
                <GroupsScreen
                  conversations={conversations.filter((c) => c.type === 'group')}
                  onOpenChat={(c) =>
                    setOpenChat({
                      conversationId: c.id,
                      name: c.name,
                      avatar: c.avatar || undefined,
                      isGroup: true,
                    })
                  }
                  onRefresh={refreshConversations}
                />
              )}
              {tab === 'discover' && <DiscoverScreen />}
              {tab === 'profile' && <ProfileScreen />}
            </div>

            {!isDesktop && (
              <BottomNav active={tab} onChange={setTab} unread={conversations.filter((c) => c.unread).length} />
            )}
          </main>
        </div>
      </div>

      <DailyRewardDialog open={dailyOpen} onClose={() => setDailyOpen(false)} />
    </CustomizerProvider>
  )
}
