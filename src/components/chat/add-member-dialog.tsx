'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  Loader2,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PickerUser {
  id: string
  name?: string
  username?: string
  avatar?: string | null
  isOnline?: boolean
  isPremium?: boolean
}

interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  groupName?: string
  onAdded?: () => void
}

/**
 * F10-11 — Full-screen member picker for group chats.
 *
 * Lists the users the current user has 1-to-1 conversations with (from
 * /api/conversations). Each user has a checkbox so the owner/admin can
 * select several at once and tap "Add selected" to bulk-POST each one to
 * /api/groups/[id]/members.
 *
 * Existing members of the group are skipped (we fetch /api/groups/[id]
 * once when the dialog opens to know which userIds are already in).
 */
export function AddMemberDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  onAdded,
}: AddMemberDialogProps) {
  const { toast } = useToast()
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [users, setUsers] = React.useState<PickerUser[]>([])
  const [existingIds, setExistingIds] = React.useState<Set<string>>(new Set())
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  // Reset on close.
  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setUsers([])
      setExistingIds(new Set())
      setSelected(new Set())
      setLoading(false)
      setAdding(false)
    }
  }, [open])

  // Load chat-partner users + existing group members when the dialog opens.
  React.useEffect(() => {
    if (!open || !groupId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        // Fetch the user's conversations (each private conversation has an
        // `otherUser` object — that's the list of chat partners we want).
        const [convRes, groupRes] = await Promise.all([
          apiFetch('/api/conversations').catch(() => null),
          apiFetch(`/api/groups/${groupId}`).catch(() => null),
        ])
        if (cancelled) return

        const list: any[] = Array.isArray(convRes)
          ? convRes
          : Array.isArray(convRes?.conversations)
            ? convRes.conversations
            : Array.isArray(convRes?.items)
              ? convRes.items
              : []

        // Filter to private 1-to-1 conversations and pull the otherUser.
        const partners: PickerUser[] = []
        const seen = new Set<string>()
        for (const c of list) {
          if (c?.type !== 'private') continue
          const u = c?.otherUser
          if (!u || !u.id || seen.has(u.id)) continue
          seen.add(u.id)
          partners.push({
            id: u.id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            isOnline: u.isOnline,
            isPremium: u.isPremium,
          })
        }
        setUsers(partners)

        // Build a set of existing group member userIds so we can mark them.
        const g: any = groupRes?.group || (groupRes?.id ? groupRes : null)
        const members: any[] = Array.isArray(g?.members) ? g.members : []
        setExistingIds(new Set(members.map((m: any) => m.userId || m.user?.id).filter(Boolean)))
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: e?.message || 'Failed to load users', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, groupId, toast])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase()
      const username = (u.username || '').toLowerCase()
      return name.includes(q) || username.includes(q)
    })
  }, [users, query])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddSelected = async () => {
    if (selected.size === 0) return
    setAdding(true)
    let ok = 0
    let failed = 0
    let firstInviteCode: string | null = null
    // Sequential POSTs — the group API is small + idempotent, and this keeps
    // the user out of rate-limit territory.
    for (const userId of Array.from(selected)) {
      try {
        await apiFetch(`/api/groups/${groupId}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        })
        ok++
      } catch {
        failed++
      }
    }
    setAdding(false)
    if (ok > 0) {
      toast({
        title: `Added ${ok} member${ok === 1 ? '' : 's'} to ${groupName || 'group'}`,
        description:
          failed > 0
            ? `${failed} could not be added (already a member or blocked).`
            : undefined,
      })
      // Move successful adds into the "existing" set so the UI updates.
      setExistingIds((prev) => {
        const next = new Set(prev)
        for (const id of Array.from(selected)) next.add(id)
        return next
      })
      setSelected(new Set())
      onAdded?.()
    } else if (failed > 0) {
      toast({
        title: 'Could not add members',
        description: 'They may already be in the group or blocked.',
        variant: 'destructive',
      })
    }
    // firstInviteCode is reserved for a future "show invite code" toast.
    void firstInviteCode
  }

  const selectableCount = filtered.filter((u) => !existingIds.has(u.id)).length
  const selectedCount = selected.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Full-screen member picker — fills the viewport on mobile, large
        // panel on desktop. Overrides the default centered small card.
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100dvw] flex-col gap-0 rounded-none border-0 p-0 sm:h-[90dvh] sm:max-w-lg sm:rounded-lg sm:border"
      >
        {/* Header (sticky) */}
        <DialogHeader className="shrink-0 border-b border-border px-4 pt-4 pb-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-primary" />
            Add member{groupName ? ` to ${groupName}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick from people you&apos;ve chatted with. They&apos;ll be added to the
            group immediately.
          </DialogDescription>
        </DialogHeader>

        {/* Search bar (sticky under header) */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="h-10 pl-8"
              autoFocus
            />
          </div>
        </div>

        {/* Scrollable user list */}
        <div className="scroll-pan-y min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading people you&apos;ve chatted with…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 opacity-40" />
              {query.trim()
                ? 'No matches. Try a different name or @username.'
                : 'No chat partners yet. Start a 1-to-1 chat first, then come back to add them to this group.'}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((u) => {
                const isMember = existingIds.has(u.id)
                const isChecked = selected.has(u.id)
                return (
                  <li key={u.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors',
                        isMember
                          ? 'cursor-not-allowed opacity-60'
                          : 'hover:bg-accent',
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => !isMember && toggle(u.id)}
                        disabled={isMember}
                        aria-label={`Select ${u.name || u.username || 'user'}`}
                        className="size-5"
                      />
                      <Avatar className="h-10 w-10 shrink-0">
                        {u.avatar ? (
                          <AvatarImage src={u.avatar} alt={u.name || u.username} />
                        ) : null}
                        <AvatarFallback>
                          {(u.name || u.username || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {u.name || u.username || 'User'}
                        </div>
                        {u.username && (
                          <div className="truncate text-xs text-muted-foreground">
                            @{u.username}
                          </div>
                        )}
                      </div>
                      {isMember ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                          <Check className="mr-1 h-3 w-3" /> Member
                        </Badge>
                      ) : (
                        u.isOnline && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            online
                          </span>
                        )
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer (sticky at bottom) with selection count + Add button */}
        <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} selected of ${selectableCount} available`
                : `${selectableCount} available to add`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px]"
                onClick={() => onOpenChange(false)}
                disabled={adding}
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button
                size="sm"
                className="btn-brand min-h-[40px]"
                onClick={handleAddSelected}
                disabled={adding || selectedCount === 0}
              >
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
