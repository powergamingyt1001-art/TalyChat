'use client'

import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCheck, Eye, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTime } from './chat-helpers'

interface SeenByMemberUser {
  id?: string
  username?: string
  name?: string
  avatar?: string | null
}

interface SeenByMember {
  userId?: string
  joinedAt?: string | Date
  lastReadAt?: string | Date | null
  user?: SeenByMemberUser | null
}

interface SeenByPopoverProps {
  /** Comma-separated user IDs that have seen the message. */
  seenBy: string
  /** Conversation members — used to resolve user details + lastReadAt. */
  members?: SeenByMember[] | null
  /** Sender's user ID (excluded from "seen by" list). */
  currentUserId: string
  /** Whether to align the popover to the end (right) — for sent messages. */
  alignEnd?: boolean
  /** Trigger element. */
  children: React.ReactNode
  className?: string
}

/**
 * Popover that shows the list of users who have seen a message (read receipts).
 * Uses the existing comma-separated `seenBy` field — no schema change required.
 * Timestamps are approximated from each member's `lastReadAt` (the time they
 * last marked the conversation as read), since the current schema does not
 * store per-message per-user seen timestamps.
 */
export function SeenByPopover({
  seenBy,
  members,
  currentUserId,
  alignEnd = true,
  children,
  className,
}: SeenByPopoverProps) {
  const seenIds = React.useMemo(() => {
    return (seenBy || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }, [seenBy])

  const memberMap = React.useMemo(() => {
    const map = new Map<string, SeenByMember>()
    for (const m of members || []) {
      const uid = m.userId || m.user?.id
      if (uid) map.set(uid, m)
    }
    return map
  }, [members])

  // Other users who have seen (excluding the sender).
  const seenUsers = React.useMemo(() => {
    return seenIds
      .filter((id) => id !== currentUserId)
      .map((id) => memberMap.get(id))
      .filter((m): m is SeenByMember => Boolean(m))
  }, [seenIds, memberMap, currentUserId])

  // Other members (excluding sender) — used to compute pending count.
  const otherMemberCount = React.useMemo(() => {
    return (members || []).filter((m) => {
      const uid = m.userId || m.user?.id
      return uid && uid !== currentUserId
    }).length
  }, [members, currentUserId])

  const pendingCount = Math.max(0, otherMemberCount - seenUsers.length)

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={alignEnd ? 'end' : 'start'}
        sideOffset={6}
        className={cn('w-64 p-0', className)}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-semibold">
          <Eye className="h-3.5 w-3.5 text-emerald-500" />
          <span>Read receipts</span>
        </div>

        {/* List of users who have seen */}
        <div className="max-h-[260px] overflow-y-auto p-1">
          {seenUsers.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Not seen yet
            </div>
          ) : (
            seenUsers.map((m) => {
              const u = m.user || ({} as SeenByMemberUser)
              const name = u.name || u.username || 'Unknown user'
              const initials = name
                .split(/\s+/)
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()
              const seenAt = m.lastReadAt ? new Date(m.lastReadAt as string | Date) : null
              const showTime = seenAt && !isNaN(seenAt.getTime())
              return (
                <div
                  key={u.id || name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
                >
                  <Avatar className="size-7 shrink-0">
                    {u.avatar ? (
                      <AvatarImage src={u.avatar} alt={name} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {initials || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{name}</div>
                    {showTime ? (
                      <div className="text-[10px] text-muted-foreground">
                        seen at {formatTime(seenAt as Date)}
                      </div>
                    ) : null}
                  </div>
                  <CheckCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                </div>
              )
            })
          )}
        </div>

        {/* Pending footer — only for group chats with unseen members */}
        {pendingCount > 0 ? (
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Pending
            </span>
            <span className="font-medium">{pendingCount}</span>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
