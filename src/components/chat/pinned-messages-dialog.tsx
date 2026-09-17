'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Pin, PinOff, Eye } from 'lucide-react'
import { format as formatDate } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { PremiumAvatar } from '@/components/premium-avatar'

interface PinnedMessage {
  id: string
  conversationId: string
  senderId: string
  sender?: {
    id: string
    username?: string
    name?: string
    avatar?: string | null
    isPremium?: boolean
    premiumTier?: string
    isOnline?: boolean
  } | null
  content: string
  type: string
  mediaUrl?: string | null
  voiceDuration?: number | null
  stickerId?: string | null
  pinnedAt: string
  createdAt: string
}

interface PinnedMessagesDialogProps {
  open: boolean
  onClose: () => void
  conversationId: string
  /** Called when the user clicks "Jump to message" — chat view should scroll to the message. */
  onJumpToMessage?: (messageId: string) => void
  /** Called after a message is unpinned (so the parent can refresh the pinned bar). */
  onUnpinned?: (messageId: string) => void
}

/**
 * Pinned messages dialog — lists all pinned messages in a conversation,
 * with an "Unpin" button on each and a "Jump to message" action that closes
 * the dialog and scrolls the chat to the message.
 */
export function PinnedMessagesDialog({
  open,
  onClose,
  conversationId,
  onJumpToMessage,
  onUnpinned,
}: PinnedMessagesDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [messages, setMessages] = React.useState<PinnedMessage[]>([])
  const [unpinningId, setUnpinningId] = React.useState<string | null>(null)

  // Fetch pinned messages whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    setMessages([])
    let cancelled = false
    ;(async () => {
      try {
        const res: any = await apiFetch(`/api/conversations/${conversationId}/pinned`)
        const list: PinnedMessage[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.messages)
            ? res.messages
            : Array.isArray(res?.items)
              ? res.items
              : []
        if (!cancelled) setMessages(list)
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: e?.message || 'Failed to load pinned messages', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, conversationId, toast])

  const handleUnpin = async (m: PinnedMessage) => {
    setUnpinningId(m.id)
    try {
      await apiFetch(`/api/messages/${m.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({ pin: false }),
      })
      setMessages((prev) => prev.filter((p) => p.id !== m.id))
      onUnpinned?.(m.id)
      toast({ title: 'Message unpinned' })
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to unpin', variant: 'destructive' })
    } finally {
      setUnpinningId(null)
    }
  }

  const handleJump = (m: PinnedMessage) => {
    onJumpToMessage?.(m.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" /> Pinned messages
          </DialogTitle>
          <DialogDescription>
            {messages.length > 0
              ? `${messages.length} pinned ${messages.length === 1 ? 'message' : 'messages'} in this chat.`
              : 'Pinned messages will appear here.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60dvh]">
          <div className="space-y-2 pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No pinned messages in this conversation.
              </div>
            ) : (
              messages.map((m) => {
                const sender = m.sender
                const senderName = sender?.name || sender?.username || 'Unknown'
                const senderAvatar = sender?.avatar
                const isPremium = !!sender?.isPremium
                const premiumTier = sender?.premiumTier
                const preview =
                  m.type === 'image'
                    ? '📷 Photo'
                    : m.type === 'voice'
                      ? '🎤 Voice message'
                      : m.type === 'sticker'
                        ? '🎨 Sticker'
                        : m.content || ''
                return (
                  <div
                    key={m.id}
                    className="rounded-md border bg-muted/30 p-2.5"
                  >
                    {/* Sender row */}
                    <div className="mb-1.5 flex items-center gap-2">
                      <PremiumAvatar
                        user={{
                          isPremium,
                          premiumTier,
                          avatar: senderAvatar || undefined,
                          name: senderName,
                          id: sender?.id || m.senderId || undefined,
                          username: sender?.username || undefined,
                        }}
                        size={28}
                        showAura={false}
                        isOnline={!!sender?.isOnline}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{senderName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          Pinned {formatDate(new Date(m.pinnedAt), 'dd MMM yyyy, HH:mm')}
                        </div>
                      </div>
                    </div>
                    {/* Content preview */}
                    <div className="mb-2 truncate rounded-sm bg-background/60 px-2 py-1.5 text-sm">
                      {preview}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] flex-1"
                        onClick={() => handleJump(m)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Jump to message
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleUnpin(m)}
                        disabled={unpinningId === m.id}
                      >
                        {unpinningId === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <PinOff className="h-3.5 w-3.5" /> Unpin
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
