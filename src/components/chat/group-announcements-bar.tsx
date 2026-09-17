'use client'

import * as React from 'react'
import {
  Megaphone,
  X,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Check,
} from 'lucide-react'
import { format as formatDate } from 'date-fns'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PremiumAvatar } from '@/components/premium-avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnnouncementAuthor {
  id: string
  username?: string
  name?: string
  avatar?: string | null
  isPremium?: boolean
  premiumTier?: string
}

interface Announcement {
  id: string
  groupId: string
  authorId: string
  content: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  author?: AnnouncementAuthor | null
}

export interface GroupAnnouncementsBarProps {
  conversationId: string
  groupId: string
  isOwnerOrAdmin: boolean
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Group Announcements bar — pinned at the top of a group chat.
 *
 * - Fetches active announcements from GET /api/groups/[id]/announcements
 * - Shows the most recent announcement as a compact bar
 * - "View all" button (when there are >1) opens a Dialog listing every announcement
 * - Owner/admin: "Post announcement" button opens a Dialog with a Textarea
 * - Bar is dismissible (✕) — re-appears when a new announcement is posted
 */
export function GroupAnnouncementsBar({
  conversationId,
  groupId,
  isOwnerOrAdmin,
}: GroupAnnouncementsBarProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([])
  const [hidden, setHidden] = React.useState(false)
  // Track the latest announcement id we've shown. When a newer one appears,
  // un-hide the bar so the user notices it.
  const lastShownIdRef = React.useRef<string | null>(null)

  // Dialogs
  const [allDialogOpen, setAllDialogOpen] = React.useState(false)
  const [composeOpen, setComposeOpen] = React.useState(false)
  const [composeText, setComposeText] = React.useState('')
  const [composing, setComposing] = React.useState(false)

  const loadAnnouncements = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/api/groups/${groupId}/announcements`)
      const list: Announcement[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.announcements)
          ? res.announcements
          : []
      setAnnouncements(list)
      // If there's a new top announcement id, un-hide the bar.
      const latestId = list[0]?.id
      if (latestId && latestId !== lastShownIdRef.current) {
        if (lastShownIdRef.current !== null) {
          // Only un-hide on subsequent loads (not the very first one).
          setHidden(false)
        }
        lastShownIdRef.current = latestId
      }
    } catch {
      // Silent — announcements are non-critical
    } finally {
      setLoading(false)
    }
  }, [groupId])

  React.useEffect(() => {
    loadAnnouncements()
    // Re-fetch on conversation change too (defensive)
  }, [loadAnnouncements, conversationId])

  const handlePost = async () => {
    const content = composeText.trim()
    if (!content) {
      toast({ title: 'Announcement cannot be empty', variant: 'destructive' })
      return
    }
    setComposing(true)
    try {
      await apiFetch(`/api/groups/${groupId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      toast({ title: 'Announcement posted' })
      setComposeText('')
      setComposeOpen(false)
      setHidden(false)
      await loadAnnouncements()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to post announcement', variant: 'destructive' })
    } finally {
      setComposing(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/groups/${groupId}/announcements/${id}`, {
        method: 'DELETE',
      })
      toast({ title: 'Announcement removed' })
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to delete', variant: 'destructive' })
    }
  }

  const handleEdit = async (id: string, content: string) => {
    try {
      await apiFetch(`/api/groups/${groupId}/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      })
      toast({ title: 'Announcement updated' })
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, content } : a)),
      )
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to update', variant: 'destructive' })
      throw e
    }
  }

  // ----- Render: nothing to show -----
  if (!loading && announcements.length === 0) {
    if (!isOwnerOrAdmin) return null
    // Owner/admin: show a subtle "Post announcement" button when there are none.
    return (
      <>
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
          <Megaphone className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate text-xs text-muted-foreground">
            No announcements yet
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 min-h-[36px] gap-1 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              setComposeText('')
              setComposeOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Post announcement
          </Button>
        </div>
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          text={composeText}
          setText={setComposeText}
          busy={composing}
          onSubmit={handlePost}
        />
      </>
    )
  }

  if (loading) {
    // Skeleton while loading
    return (
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Megaphone className="h-4 w-4 shrink-0 text-primary" />
        <div className="h-3 flex-1 animate-pulse rounded bg-muted-foreground/15" />
      </div>
    )
  }

  const latest = announcements[0]
  if (!latest) return null

  // If user dismissed and the latest hasn't changed, hide the bar.
  if (hidden) {
    return (
      <>
        <div className="flex shrink-0 items-center justify-end gap-2 border-b bg-muted/20 px-3 py-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-h-[36px] gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => setHidden(false)}
          >
            <Megaphone className="h-3 w-3" /> Show announcements
          </Button>
        </div>
        <AllAnnouncementsDialog
          open={allDialogOpen}
          onOpenChange={setAllDialogOpen}
          announcements={announcements}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          text={composeText}
          setText={setComposeText}
          busy={composing}
          onSubmit={handlePost}
        />
      </>
    )
  }

  const author = latest.author
  const authorName = author?.name || author?.username || 'Group admin'
  const preview = latest.content.length > 90
    ? `${latest.content.slice(0, 90)}…`
    : latest.content

  return (
    <>
      <div className="announcement-bar flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Megaphone className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => setAllDialogOpen(true)}
          aria-label="View all announcements"
          className="flex min-w-0 flex-1 items-center justify-start text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs">
              <span className="font-semibold text-primary">{authorName}</span>{' '}
              <span className="text-foreground/85">{preview}</span>
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {formatDate(new Date(latest.createdAt), 'dd MMM yyyy, HH:mm')}
              {announcements.length > 1 && (
                <span className="ml-1">· +{announcements.length - 1} more</span>
              )}
            </div>
          </div>
        </button>

        {announcements.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-h-[36px] shrink-0 px-2 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => setAllDialogOpen(true)}
          >
            View all
          </Button>
        )}

        {isOwnerOrAdmin && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-h-[36px] shrink-0 gap-1 px-2 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              setComposeText('')
              setComposeOpen(true)
            }}
          >
            <Plus className="h-3 w-3" /> Post
          </Button>
        )}

        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide announcement bar"
          className="flex h-7 w-7 min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted-foreground/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <AllAnnouncementsDialog
        open={allDialogOpen}
        onOpenChange={setAllDialogOpen}
        announcements={announcements}
        isOwnerOrAdmin={isOwnerOrAdmin}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        text={composeText}
        setText={setComposeText}
        busy={composing}
        onSubmit={handlePost}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// All Announcements Dialog (lists every active announcement)
// ---------------------------------------------------------------------------

interface AllAnnouncementsDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  announcements: Announcement[]
  isOwnerOrAdmin: boolean
  onDelete: (id: string) => void | Promise<void>
  onEdit: (id: string, content: string) => Promise<void>
}

function AllAnnouncementsDialog({
  open,
  onOpenChange,
  announcements,
  isOwnerOrAdmin,
  onDelete,
  onEdit,
}: AllAnnouncementsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Group announcements
          </DialogTitle>
          <DialogDescription>
            {announcements.length > 0
              ? `${announcements.length} active ${announcements.length === 1 ? 'announcement' : 'announcements'} in this group.`
              : 'No active announcements.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60dvh]">
          <div className="space-y-2 pr-2">
            {announcements.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No announcements in this group yet.
              </div>
            ) : (
              announcements.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function AnnouncementCard({
  announcement,
  isOwnerOrAdmin,
  onDelete,
  onEdit,
}: {
  announcement: Announcement
  isOwnerOrAdmin: boolean
  onDelete: (id: string) => void | Promise<void>
  onEdit: (id: string, content: string) => Promise<void>
}) {
  const { toast } = useToast()
  const [deleting, setDeleting] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(announcement.content)
  const [saving, setSaving] = React.useState(false)

  const author = announcement.author
  const authorName = author?.name || author?.username || 'Group admin'

  const submitEdit = async () => {
    if (!draft.trim()) {
      toast({ title: 'Announcement cannot be empty', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await onEdit(announcement.id, draft.trim())
      setEditing(false)
    } catch {
      // toast already shown in parent
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setDraft(announcement.content)
    setEditing(false)
  }

  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <PremiumAvatar
          user={{
            isPremium: !!author?.isPremium,
            premiumTier: author?.premiumTier,
            avatar: author?.avatar || undefined,
            name: authorName,
            id: author?.id || undefined,
            username: author?.username || undefined,
          }}
          size={28}
          showAura={false}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{authorName}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {formatDate(
              new Date(announcement.createdAt),
              'dd MMM yyyy, HH:mm',
            )}
            {announcement.updatedAt &&
              new Date(announcement.updatedAt).getTime() >
                new Date(announcement.createdAt).getTime() && (
                <span className="ml-1 italic">· edited</span>
              )}
          </div>
        </div>
        {isOwnerOrAdmin && !editing && (
          <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
            Author
          </Badge>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            className="min-h-[80px] resize-none bg-background text-sm"
            placeholder="Edit the announcement…"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="btn-brand min-h-[36px] flex-1"
              onClick={submitEdit}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-[36px]"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap break-words rounded-sm bg-background/60 px-2 py-1.5 text-sm">
          {announcement.content}
        </div>
      )}

      {isOwnerOrAdmin && !editing && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-[36px] flex-1"
            onClick={() => {
              setDraft(announcement.content)
              setEditing(true)
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[36px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              setDeleting(true)
              try {
                await onDelete(announcement.id)
              } finally {
                setDeleting(false)
              }
            }}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compose Dialog (post a new announcement)
// ---------------------------------------------------------------------------

interface ComposeDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  text: string
  setText: (s: string) => void
  busy: boolean
  onSubmit: () => void | Promise<void>
}

function ComposeDialog({
  open,
  onOpenChange,
  text,
  setText,
  busy,
  onSubmit,
}: ComposeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" /> Post announcement
          </DialogTitle>
          <DialogDescription>
            Announcements are pinned at the top of this group chat. Visible to all members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type the announcement — e.g. 'Welcome to the group! Read the rules in the pinned message.'"
            maxLength={2000}
            className="min-h-[120px] resize-none text-sm"
            autoFocus
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{text.length}/2000</span>
            <span>Press Ctrl/⌘+Enter to post</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            className="min-h-[40px]"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="btn-brand min-h-[40px]"
            onClick={onSubmit}
            disabled={busy || !text.trim()}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                onSubmit()
              }
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Megaphone className="h-4 w-4" />
            )}
            Post announcement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
