'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Search, Forward, Users, User, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ConversationResult {
  id: string
  type: 'private' | 'group'
  name?: string | null
  avatar?: string | null
  otherUser?: {
    id: string
    name?: string
    username?: string
    avatar?: string | null
    isOnline?: boolean
  } | null
  group?: {
    id: string
    name: string
    logo?: string | null
    membersCount?: number
  } | null
}

interface ForwardDialogProps {
  open: boolean
  onClose: () => void
  /** The message to forward. */
  message: any
}

/**
 * Forward dialog — searches conversations (private + group) and forwards the
 * selected message to the chosen conversation via POST /api/messages with
 * forwardedFromId.
 */
export function ForwardDialog({ open, onClose, message }: ForwardDialogProps) {
  const { toast } = useToast()
  const [query, setQuery] = React.useState('')
  const [conversations, setConversations] = React.useState<ConversationResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [forwarding, setForwarding] = React.useState(false)

  // Reset + fetch recent conversations on open.
  React.useEffect(() => {
    if (!open) return
    setQuery('')
    setSelectedId(null)
    setLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await apiFetch('/api/conversations')
        const list: ConversationResult[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.conversations)
            ? res.conversations
            : Array.isArray(res?.items)
              ? res.items
              : []
        if (!cancelled) setConversations(list)
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: e?.message || 'Failed to load conversations', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, toast])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      if (c.type === 'group') {
        return (c.name || c.group?.name || '').toLowerCase().includes(q)
      }
      const u = c.otherUser
      return (
        (u?.name || '').toLowerCase().includes(q) ||
        (u?.username || '').toLowerCase().includes(q)
      )
    })
  }, [conversations, query])

  const displayName = (c: ConversationResult): string => {
    if (c.type === 'group') return c.name || c.group?.name || 'Group'
    return c.otherUser?.name || c.otherUser?.username || 'User'
  }

  const handleForward = async () => {
    if (!selectedId || !message) return
    const target = conversations.find((c) => c.id === selectedId)
    if (!target) return
    setForwarding(true)
    try {
      const body: any = {
        conversationId: selectedId,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        voiceDuration: message.voiceDuration,
        stickerId: message.stickerId,
        forwardedFromId: message.id,
      }
      await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const targetName = displayName(target)
      toast({ title: `Message forwarded to ${targetName}` })
      onClose()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to forward', variant: 'destructive' })
    } finally {
      setForwarding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4" /> Forward message
          </DialogTitle>
          <DialogDescription>
            Select a conversation to forward this message to. The forwarded
            message will show &ldquo;Forwarded from @{message?.sender?.username || message?.sender?.name || 'user'}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="pl-8"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Conversation list */}
        <div className="scroll-pan-y max-h-[320px] overflow-y-auto">
          {!loading && filtered.length === 0 && query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          )}
          {!loading && filtered.length === 0 && !query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No conversations available.
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {filtered.map((c) => {
              const selected = selectedId === c.id
              const name = displayName(c)
              const avatar = c.type === 'group' ? (c.avatar || c.group?.logo) : c.otherUser?.avatar
              const subtitle =
                c.type === 'group'
                  ? `${c.group?.membersCount ?? 0} members`
                  : c.otherUser?.username
                    ? `@${c.otherUser.username}`
                    : ''
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors min-h-[44px]',
                      selected ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent'
                    )}
                  >
                    <div className="relative shrink-0">
                      {c.type === 'group' ? (
                        <Avatar className="h-9 w-9">
                          {avatar && <AvatarImage src={avatar} alt={name} />}
                          <AvatarFallback className="bg-primary/15 font-semibold text-primary">
                            {(name || 'G').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Avatar className="h-9 w-9">
                          {avatar && <AvatarImage src={avatar} alt={name} />}
                          <AvatarFallback>
                            {(name || 'U').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 truncate text-sm font-medium">
                        {c.type === 'group' ? (
                          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{name}</span>
                      </div>
                      {subtitle && (
                        <div className="truncate text-xs text-muted-foreground">
                          {subtitle}
                        </div>
                      )}
                    </div>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Preview of message being forwarded */}
        {message && (
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="mb-0.5 flex items-center gap-1 text-muted-foreground">
              <Forward className="h-3 w-3" />
              <span>Forwarding:</span>
            </div>
            <div className="truncate text-sm">
              {message.type === 'image'
                ? '📷 Photo'
                : message.type === 'voice'
                  ? '🎤 Voice message'
                  : message.type === 'sticker'
                    ? '🎨 Sticker'
                    : message.content || 'Message'}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={forwarding}>
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            disabled={!selectedId || forwarding}
            className="btn-brand min-h-[44px]"
          >
            {forwarding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Forwarding…
              </>
            ) : (
              <>
                <Forward className="h-4 w-4" /> Forward
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
