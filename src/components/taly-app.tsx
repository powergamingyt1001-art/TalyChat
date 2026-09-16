'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { CreateStoryDialog } from '@/components/taly/create-story-dialog'
import { useMediaQuery } from '@/hooks/use-mobile'
import { useSound } from '@/hooks/use-sound'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { showLocalNotification } from '@/lib/push-notifications'
import { cn } from '@/lib/utils'
import { CustomizerProvider } from '@/components/taly/customizer-context'
import { FloatingAIAgent } from '@/components/floating-ai-agent'

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
  const { play: soundManager } = useSound()
  // V8 — Push notifications hook (auto-subscribes after login if granted).
  // We don't read state from it here; we just want the auto-subscribe side
  // effect. `showLocalNotification` is called directly from the socket
  // handler below.
  usePushNotifications()
  const [tab, setTab] = useState<TalyTab>('home')
  const [openChat, setOpenChat] = useState<null | {
    conversationId: string
    name: string
    avatar?: string
    isGroup?: boolean
  }>(null)
  const [talyOpen, setTalyOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [createStoryOpen, setCreateStoryOpen] = useState(false)
  const [storiesSignal, setStoriesSignal] = useState(0)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [preferences, setPreferences] = useState<any>(null)

  // V8 — Keep a ref of the currently open chat so the socket `message:new`
  // handler (which is captured once per login) always sees the latest
  // active conversation. This lets us decide whether to fire a desktop
  // notification or skip it (because the user is already viewing that
  // chat in the foreground).
  const openChatRef = useRef(openChat)
  useEffect(() => {
    openChatRef.current = openChat
  }, [openChat])

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

  // V6 — Poll the scheduled-message processor every 60 seconds so any
  // due scheduled messages are actually sent (creates the real Message
  // row, emits socket events, marks the ScheduledMessage as sent). The
  // endpoint is internal-no-auth when CRON_TOKEN is unset, so we don't
  // need a special header. Only run when the user is logged in.
  useEffect(() => {
    if (!user) return
    // Fire once immediately on login so the user doesn't wait 60s for the
    // first tick.
    void apiFetch('/api/messages/schedule/process', { method: 'POST' }).catch(() => {})
    const t = setInterval(() => {
      void apiFetch('/api/messages/schedule/process', { method: 'POST' }).catch(() => {})
    }, 60_000)
    return () => clearInterval(t)
  }, [user])

  // Socket for live updates
  useSocket({
    'message:new': (payload: any) => {
      const conv = payload?.conversationId
      if (!conv) return
      // Play the incoming-message sound for any message that wasn't sent by
      // us (so we don't ding on our own echoes via the socket). SoundManager
      // already no-ops when disabled, so this is safe to call unconditionally.
      // Read fresh user from the store so the closure isn't stale after
      // re-mounts / re-logins.
      const currentUserId = useAuth.getState().user?.id
      const senderId = payload?.message?.senderId
      if (senderId && senderId !== currentUserId) {
        soundManager.playMessage()
        // V8 — Show a local desktop notification only if the document is
        // hidden (tab in background) OR the user is on a different
        // conversation. We never autoplay notifications on page load.
        const sender =
          payload?.message?.sender?.name ||
          payload?.message?.sender?.username ||
          'New message'
        const preview = buildIncomingPreview(payload?.message)
        const activeConvId = openChatRef.current?.conversationId
        const isOnThisChat = activeConvId === conv && !document.hidden
        if (!isOnThisChat) {
          showLocalNotification(sender, preview, () => {
            setOpenChat({
              conversationId: conv,
              name:
                payload?.message?.conversation?.name ||
                payload?.conversationName ||
                sender,
              avatar: undefined,
              isGroup: payload?.message?.conversationType === 'group',
            })
          })
        }
      }
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
    'story:new': () => {
      // A new story was posted (by us or someone visible). Bump the signal
      // so HomeScreen re-fetches its stories list.
      setStoriesSignal((n) => n + 1)
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
              onOpenCreateStory={() => setCreateStoryOpen(true)}
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
                onOpenCreateStory={() => setCreateStoryOpen(true)}
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
                  onOpenCreateStory={() => setCreateStoryOpen(true)}
                  storiesSignal={storiesSignal}
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

      {/* Floating AI Agent — visible on all tabs EXCEPT when a chat is open */}
      <FloatingAIAgent onClick={() => setTalyOpen(true)} hidden={!!openChat} />

      <DailyRewardDialog open={dailyOpen} onClose={() => setDailyOpen(false)} />

      <CreateStoryDialog
        open={createStoryOpen}
        onClose={() => setCreateStoryOpen(false)}
        onCreated={() => setStoriesSignal((n) => n + 1)}
      />
    </CustomizerProvider>
  )
}

// V8 — Build a short preview string for an incoming message to use in
// the desktop notification body. Mirrors the backend buildPreview but
// for client-side socket events.
function buildIncomingPreview(message: any): string {
  if (!message) return 'New message'
  switch (message.type) {
    case 'image':
      return '📷 Photo'
    case 'voice':
      return '🎤 Voice message'
    case 'sticker':
      return '🎨 Sticker'
    case 'location':
      return '📍 Location'
    case 'system':
      return message.content || 'System message'
    default:
      return message.content || 'New message'
  }
}
