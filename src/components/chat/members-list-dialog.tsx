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
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Crown,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PremiumAvatar } from '@/components/premium-avatar'

interface GroupMember {
  id?: string
  userId: string
  role: string
  joinedAt?: string
  user?: {
    id: string
    name?: string
    username?: string
    avatar?: string | null
    isPremium?: boolean
    premiumTier?: string
  }
}

interface MembersListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  groupName?: string
  currentUserId?: string
  /** Open the Add-member picker from the bottom of the list. */
  onAddMember: () => void
  /** Notify parent after a role/kick change so it can refresh. */
  onChanged?: () => void
}

/**
 * F10-11 — Members list dialog (3-dot menu → Members).
 *
 * Shows every member with avatar, name, and a role badge
 * (owner / admin / moderator / member). Owner/admin also see a
 * "Remove" button on every non-owner row. The bottom of the list has an
 * "Add member" button that opens the full-screen member picker.
 */
export function MembersListDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  currentUserId,
  onAddMember,
  onChanged,
}: MembersListDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [members, setMembers] = React.useState<GroupMember[]>([])
  const [myRole, setMyRole] = React.useState<string | null>(null)
  const [removingId, setRemovingId] = React.useState<string | null>(null)

  // Load members whenever the dialog opens.
  React.useEffect(() => {
    if (!open || !groupId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res: any = await apiFetch(`/api/groups/${groupId}`)
        const g: any = res?.group || (res?.id ? res : null)
        if (cancelled) return
        const list: GroupMember[] = Array.isArray(g?.members) ? g.members : []
        setMembers(list)
        setMyRole(
          (g?.myRole as string) ||
            list.find((m) => m.userId === currentUserId)?.role ||
            null,
        )
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: e?.message || 'Failed to load members', variant: 'destructive' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, groupId, currentUserId, toast])

  const canManage = myRole === 'owner' || myRole === 'admin'

  const handleRemove = async (member: GroupMember) => {
    if (!canManage || removingId) return
    setRemovingId(member.userId)
    try {
      await apiFetch(`/api/groups/${groupId}/members/${member.userId}`, {
        method: 'DELETE',
      })
      // Optimistic update — drop the row immediately.
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId))
      toast({
        title: 'Member removed',
        description: `${member.user?.name || member.user?.username || 'User'} is no longer in ${groupName || 'the group'}.`,
      })
      onChanged?.()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to remove member', variant: 'destructive' })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100dvw] flex-col gap-0 rounded-none border-0 p-0 sm:h-[85dvh] sm:max-w-md sm:rounded-lg sm:border">
        {/* Header (sticky) */}
        <DialogHeader className="shrink-0 border-b border-border px-4 pt-4 pb-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Members{groupName ? ` · ${groupName}` : ''}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {loading
              ? 'Loading…'
              : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
            {canManage && ' · you can remove members and add new ones.'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable members list */}
        <div className="scroll-pan-y min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 opacity-40" />
              No members found.
            </div>
          ) : (
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1.5"
            >
              {members.map((m: GroupMember) => {
                const u = m.user || ({} as NonNullable<GroupMember['user']>)
                const role = m.role
                const isOwner = role === 'owner'
                const isAdmin = role === 'admin'
                const isModerator = role === 'moderator'
                const isMe = u.id === currentUserId
                // Owner can remove anyone except themselves (cannot kick the
                // owner — server enforces too). Admin can remove only members
                // and moderators — NOT other admins. Moderators cannot remove.
                const canRemove =
                  canManage &&
                  !isOwner &&
                  !isMe &&
                  !(myRole === 'admin' && isAdmin)
                const displayName = u.name || u.username || 'User'
                return (
                  <li
                    key={m.id || m.userId || u.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                  >
                    <PremiumAvatar
                      user={{
                        isPremium: u.isPremium,
                        premiumTier: u.premiumTier,
                        avatar: u.avatar || undefined,
                        name: displayName,
                      }}
                      size={40}
                      showAura={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                        {isMe && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      {u.username && (
                        <p className="truncate text-xs text-muted-foreground">
                          @{u.username}
                        </p>
                      )}
                    </div>
                    {isOwner ? (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-600">
                        <Crown className="mr-1 h-3 w-3" /> Owner
                      </Badge>
                    ) : isAdmin ? (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Admin
                      </Badge>
                    ) : isModerator ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                        Moderator
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Member
                      </Badge>
                    )}
                    {canRemove && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          'min-h-[36px] text-destructive hover:bg-destructive/10 hover:text-destructive',
                        )}
                        onClick={() => handleRemove(m)}
                        disabled={removingId === m.userId}
                        aria-label={`Remove ${displayName}`}
                      >
                        {removingId === m.userId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </li>
                )
              })}
            </motion.ul>
          )}
        </div>

        {/* Footer with "Add member" button (owner/admin only) */}
        {canManage && (
          <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <Button
              className="btn-brand min-h-[44px] w-full"
              onClick={onAddMember}
              disabled={loading || !!removingId}
            >
              <UserPlus className="h-4 w-4" /> Add member
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
