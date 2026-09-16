'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImagePlus, Loader2, Lock, Plus, Users, Clock } from 'lucide-react'
import { apiFetch, apiUpload } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/components/taly/customizer-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConversationSummary } from '@/components/taly-app'

interface GroupsProps {
  conversations: ConversationSummary[]
  onOpenChat: (c: ConversationSummary) => void
  onRefresh: () => void
}

interface SentRequest {
  id: string
  groupId: string
  message: string
  status: string
  createdAt: string
  decidedAt: string | null
  group: {
    id: string
    name: string
    logo?: string | null
    category?: string | null
    isPublic: boolean
    membersCount: number
    inviteCode: string
    ownerId: string
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

function messagePreview(last: any): string {
  if (!last) return 'No messages yet'
  if (last.deletedAt) return '🚫 Message deleted'
  if (last.type === 'image') return '📷 Photo'
  if (last.type === 'voice') return '🎤 Voice'
  if (last.type === 'sticker') return '😊 Sticker'
  return last.content || 'No messages yet'
}

function groupLogo(c: ConversationSummary): string | undefined {
  // Prefer group's own logo, then conversation avatar, fall back to undefined.
  if (c.group?.logo) return c.group.logo
  if (c.avatar) return c.avatar
  return undefined
}

function groupInitial(c: ConversationSummary): string {
  const name = (c.name || c.group?.name || '?').toString()
  return name[0]?.toUpperCase() || '?'
}

export function GroupsScreen({ conversations, onOpenChat, onRefresh }: GroupsProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'private' | 'requests'>('all')
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)

  // Only group conversations are shown on the Groups tab.
  const groupConversations = useMemo(
    () => conversations.filter((c) => c.type === 'group'),
    [conversations],
  )

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unread':
        return groupConversations.filter((c) => (c.unread || 0) > 0)
      case 'private':
        // Private groups the user has joined.
        return groupConversations.filter((c) => c.group?.isPublic === false)
      case 'requests':
        // Requests tab is rendered separately below.
        return []
      default:
        return groupConversations
    }
  }, [filter, groupConversations])

  const loadSentRequests = async () => {
    setRequestsLoading(true)
    try {
      const res: any = await apiFetch('/api/groups/requests/sent')
      const list: SentRequest[] = Array.isArray(res)
        ? res
        : (res?.requests || res?.items || [])
      setSentRequests(list)
    } catch {
      setSentRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    if (filter === 'requests') {
      loadSentRequests()
    }
  }, [filter])

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Button onClick={() => setCreateOpen(true)} className="btn-brand min-h-[44px]">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      {/* Tabs: All / Unread / Private / Requests (no bottom indicator) */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as 'all' | 'unread' | 'private' | 'requests')}
        className="mt-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1">
            Unread
          </TabsTrigger>
          <TabsTrigger value="private" className="flex-1">
            Private
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1">
            Requests
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab content */}
      <div className="mt-4 space-y-2">
        {filter === 'requests' ? (
          <RequestsTab
            requests={sentRequests}
            loading={requestsLoading}
            onRefresh={loadSentRequests}
            onOpenChat={onOpenChat}
            conversations={groupConversations}
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
            {filter === 'unread'
              ? 'No unread groups 🎉'
              : filter === 'private'
                ? 'You haven’t joined any private groups yet.'
                : 'You haven’t joined any groups yet. Tap “Create” above or discover groups from the Discover tab.'}
          </div>
        ) : (
          filtered.map((c) => {
            const g = c.group
            const memberCount = g?.membersCount || 0
            const last = c.lastMessage
            const preview = messagePreview(last)
            const isPrivate = g?.isPublic === false
            return (
              <button
                key={c.id}
                onClick={() => onOpenChat(c)}
                className="flex w-full min-h-[60px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={groupLogo(c)} alt={c.name} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                    {groupInitial(c)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {isPrivate && (
                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(last?.createdAt || c.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {memberCount} members
                    </span>
                    {last && <span> · {preview}</span>}
                  </p>
                </div>
                {(c.unread || 0) > 0 && (
                  <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {(c.unread || 0) > 99 ? '99+' : c.unread}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          onRefresh()
        }}
      />
    </div>
  )
}

// ============================================================
// Requests tab — shows pending join requests the user has SENT
// ============================================================

function RequestsTab({
  requests,
  loading,
  onRefresh,
  conversations,
}: {
  requests: SentRequest[]
  loading: boolean
  onRefresh: () => void
  onOpenChat: (c: ConversationSummary) => void
  conversations: ConversationSummary[]
}) {
  // Defensive: only show pending requests by default.
  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading requests…
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No pending requests. When you ask to join a private group, it will appear here.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending ({pending.length})
          </p>
          {pending.map((r) => (
            <SentRequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
      {decided.length > 0 && (
        <div className="space-y-2">
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent decisions
          </p>
          {decided.map((r) => (
            <SentRequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="mt-2 min-h-[36px] w-full"
      >
        Refresh
      </Button>
      {/* conversations unused intentionally — kept for future "open chat" action */}
      <span className="hidden">{conversations.length}</span>
    </div>
  )
}

function SentRequestCard({ request }: { request: SentRequest }) {
  const g = request.group
  const statusLabel =
    request.status === 'pending'
      ? 'Pending'
      : request.status === 'accepted'
        ? 'Accepted'
        : 'Rejected'
  const badgeClass =
    request.status === 'pending'
      ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
      : request.status === 'accepted'
        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
        : 'bg-destructive/10 text-destructive border-destructive/30'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar className="h-10 w-10 rounded-lg">
        <AvatarImage src={g?.logo || undefined} alt={g?.name} />
        <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
          {(g?.name || '?')[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-semibold">{g?.name}</p>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {g?.membersCount || 0} members · {g?.category || 'Group'}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Sent {relativeTime(request.createdAt)}
        </p>
      </div>
      <Badge variant="outline" className={badgeClass}>
        {statusLabel}
      </Badge>
    </div>
  )
}

// ============================================================
// Create group dialog
// ============================================================

function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (g: any) => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('')
  const [isPublic, setIsPublic] = useState(true)
  const [logo, setLogo] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setDescription('')
    setCategory('')
    setIsPublic(true)
    setLogo('')
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res: any = await apiUpload('/api/upload', file)
      setLogo(res.url)
      toast({ title: 'Logo uploaded' })
    } catch (err: any) {
      toast({ title: err?.message || 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim() || !category) {
      toast({ title: 'Name and category are required', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res: any = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          logo: logo || undefined,
          category,
          isPublic,
        }),
      })
      // Defensive: API returns { group: {...} } (201), fall back to bare object.
      const group = res?.group || (res?.id ? res : null)
      const code = group?.inviteCode
      toast({
        title: code ? `Group created! Invite code: ${code}` : 'Group created 🎉',
      })
      reset()
      onCreated(group)
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to create group', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new group</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/50 hover:bg-muted">
              {logo ? (
                <img src={logo} alt="Group logo" className="h-full w-full object-cover" />
              ) : uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogo}
              />
            </label>
            <div className="flex-1">
              <Label htmlFor="group-name" className="text-xs text-muted-foreground">
                Group name *
              </Label>
              <Input
                id="group-name"
                placeholder="My Awesome Group"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="group-desc" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="group-desc"
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Public group</p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? 'Anyone can find and join'
                  : 'People must request to join'}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 rounded-lg">
                <AvatarImage src={logo || undefined} />
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {name?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name || 'Group name'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {category || 'Category'} · 1 member · {isPublic ? 'Public' : 'Private'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !category}
            className="btn-brand min-h-[44px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
