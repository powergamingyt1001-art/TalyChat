'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  Check,
  Globe,
  Loader2,
  Lock,
  Plus,
  Search,
  Users,
  X,
  Clock,
} from 'lucide-react'
import { apiFetch, apiUpload, ApiError } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@/components/taly-app'

interface GroupsProps {
  conversations: ConversationSummary[]
  onOpenChat: (c: ConversationSummary) => void
  onRefresh: () => void
  // R8-11 — Find button used to navigate to the Discover tab so the user
  // could browse / join communities instead of creating a new one from this
  // tab. With the new Find/Create capsule switch, the "Find" tab shows the
  // groups list directly. We still keep this prop for the empty-state hint.
  onOpenDiscover?: () => void
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

// Categories accepted by /api/groups POST. Must match the server's allowed
// list (the server only requires that `category` be a non-empty string).
const CREATE_CATEGORIES = [
  'AI',
  'Game',
  'Fun',
  'Technology',
  'Education',
  'Music',
  'Foodie',
  'Travel',
  'Trend',
  'Clothes',
  'Other',
] as const

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

export function GroupsScreen({ conversations, onOpenChat, onRefresh, onOpenDiscover }: GroupsProps) {
  // Find/Create capsule switch — Find shows the existing groups list, Create
  // shows a full-screen create-group form.
  const [mode, setMode] = useState<'find' | 'create'>('find')

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

  // After a successful create, switch back to Find and refresh the list.
  const handleCreated = () => {
    setMode('find')
    onRefresh?.()
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="section-header">Groups</h1>
        {/* F10-11 — Find/Create capsule switch (iOS-style segmented control)
            Find  → shows the existing groups list (default)
            Create → shows a full-screen create-group form */}
        <div
          role="tablist"
          aria-label="Find or create a group"
          className="inline-flex items-center rounded-full bg-muted p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'find'}
            onClick={() => setMode('find')}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors',
              mode === 'find'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Search className="h-4 w-4" /> Find
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => setMode('create')}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1 rounded-full px-4 text-sm font-medium transition-colors',
              mode === 'create'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>
      </div>

      {/* Capsule-switch content */}
      {mode === 'create' ? (
        <CreateGroupForm onCreated={handleCreated} />
      ) : (
        <>
          {/* Tabs: All / Unread / Private / Requests — segmented control */}
          <div className="mt-4">
            <div className="segmented-control w-full">
              {(['all', 'unread', 'private', 'requests'] as const).map((id) => {
                const active = filter === id
                return (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={cn('flex-1 capitalize', active ? 'active' : '')}
                  >
                    {id}
                  </button>
                )
              })}
            </div>
          </div>

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
                    : 'You haven’t joined any groups yet. Use the Create switch above to start one, or visit the Discover tab to find communities.'}
                {filter === 'all' && onOpenDiscover && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenDiscover()}
                      className="min-h-[36px]"
                    >
                      <Search className="h-4 w-4" /> Browse Discover
                    </Button>
                  </div>
                )}
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
                    className="chat-list-item taly-card taly-card-hover w-full border border-border text-left"
                  >
                    {/* Stacked member avatars — 2-3 small overlapping letter avatars + "+N" */}
                    <StackedGroupAvatars
                      logo={groupLogo(c)}
                      name={c.name}
                      memberCount={memberCount}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1 truncate text-[15px] font-semibold">
                          {isPrivate && (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(last?.createdAt || c.updatedAt)}
                        </span>
                      </div>
                      {/* Member count sub-text with Users icon */}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span className="font-medium text-foreground/80">{memberCount} members</span>
                        {last && <span className="truncate"> · {preview}</span>}
                      </p>
                    </div>
                    {(c.unread || 0) > 0 && (
                      <span className="unread-badge shrink-0">
                        {(c.unread || 0) > 99 ? '99+' : c.unread}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// StackedGroupAvatars — shows 2-3 overlapping small letter avatars
// representing the group's members. Falls back to the group's logo
// avatar as the topmost avatar when available. Shows "+N" when
// memberCount > 3.
// ============================================================
function StackedGroupAvatars({
  logo,
  name,
  memberCount,
}: {
  logo?: string
  name: string
  memberCount: number
}) {
  // Generate up to 3 distinct "member" initials from the group name.
  const baseName = name || 'G'
  const initials = (baseName.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean))
  const derived: string[] = []
  for (let i = 0; i < initials.length && derived.length < 3; i++) {
    derived.push(initials[i][0]?.toUpperCase() || 'U')
  }
  // Pad with the group's own initial + generic dots until we have 3 entries.
  while (derived.length < 3) {
    derived.push(baseName[0]?.toUpperCase() || 'U')
  }
  const visible = derived.slice(0, 3)
  // "+N" overflow chip — show extra member count beyond the 3 visible.
  const extra = Math.max(0, memberCount - 3)

  // Color palette per slot — emerald, amber, sky for variety.
  const slotClass = (i: number) => {
    switch (i % 3) {
      case 0:
        return 'bg-emerald-500/15 text-emerald-600'
      case 1:
        return 'bg-amber-500/15 text-amber-600'
      default:
        return 'bg-sky-500/15 text-sky-600'
    }
  }

  return (
    <div className="relative flex shrink-0 items-center" aria-hidden>
      <div className="relative flex h-10 w-14 items-center">
        {visible.map((letter, i) => {
          const z = visible.length - i // back→front
          const offset = i * 14 // 14px stagger, overlap 6px on 20px avatars
          return (
            <div
              key={i}
              className={cn(
                'absolute flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card',
                slotClass(i),
              )}
              style={{ left: `${offset}px`, zIndex: z }}
            >
              {i === 0 && logo ? (
                <img
                  src={logo}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                letter
              )}
            </div>
          )
        })}
        {extra > 0 && (
          <span
            className="absolute -right-1 top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground ring-2 ring-card"
            style={{ zIndex: visible.length + 1 }}
          >
            +{extra > 99 ? '99' : extra}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================
// CreateGroupForm — full-screen create-group form with logo upload,
// title, description, category, public/private switch, and a live
// preview card. On submit, POSTs to /api/groups and toasts the invite
// code, then switches back to the Find tab.
// ============================================================

function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('AI')
  const [isPublic, setIsPublic] = useState(true)
  const [logo, setLogo] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleLogoPick = async (file: File | null) => {
    if (!file) return
    // Basic client-side validation (server enforces too).
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)) {
      toast({ title: 'Please pick an image file', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const res: any = await apiUpload('/api/upload', file)
      const url: string | undefined = res?.url
      if (!url) throw new Error('Upload did not return a URL')
      setLogo(url)
      toast({ title: 'Logo uploaded' })
    } catch (e: any) {
      const err = e as ApiError
      toast({ title: err?.message || 'Logo upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast({ title: 'Group title is required', variant: 'destructive' })
      return
    }
    if (!category) {
      toast({ title: 'Pick a category', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res: any = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          logo: logo || undefined,
          category,
          isPublic,
        }),
      })
      // Defensive: API returns { group: { ..., inviteCode } }
      const group = res?.group || (res?.id ? res : null)
      const inviteCode = group?.inviteCode || ''
      toast({
        title: 'Group created 🎉',
        description: inviteCode
          ? `Invite code: ${inviteCode} — share it so others can join.`
          : 'Share the group from its 3-dot menu to invite members.',
      })
      // Reset form for next time.
      setName('')
      setDescription('')
      setCategory('AI')
      setIsPublic(true)
      setLogo(null)
      onCreated()
    } catch (e: any) {
      const err = e as ApiError
      toast({ title: err?.message || 'Failed to create group', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  // Live preview card — reflects the current form state.
  const previewName = name.trim() || 'Your group name'
  const previewInitial = previewName.charAt(0).toUpperCase() || 'G'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mt-4 space-y-4"
    >
      {/* Live preview card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live preview
        </p>
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 rounded-xl border border-border">
            {logo ? (
              <AvatarImage src={logo} alt={previewName} />
            ) : null}
            <AvatarFallback className="rounded-xl bg-emerald-500/15 text-lg font-bold text-emerald-600">
              {previewInitial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {!isPublic && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="truncate text-base font-semibold">{previewName}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>1 member (you)</span>
              <span aria-hidden>·</span>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                {category}
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                {isPublic ? (
                  <>
                    <Globe className="h-3 w-3" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> Private
                  </>
                )}
              </span>
            </div>
            {description.trim() && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {description.trim()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Logo upload */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Label className="text-sm font-medium">Group logo</Label>
        <p className="mb-3 text-xs text-muted-foreground">
          Pick a square image. PNG / JPG / GIF up to 8 MB.
        </p>
        <div className="flex items-center gap-3">
          <Avatar className="h-16 w-16 rounded-xl border border-border">
            {logo ? (
              <AvatarImage src={logo} alt="Group logo" />
            ) : null}
            <AvatarFallback className="rounded-xl bg-muted text-muted-foreground">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                handleLogoPick(f)
                // Reset so picking the same file again still fires onChange.
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || creating}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : logo ? (
                <>
                  <Camera className="h-4 w-4" /> Change logo
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" /> Upload logo
                </>
              )}
            </Button>
            {logo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-[36px] w-full text-xs text-muted-foreground"
                onClick={() => setLogo(null)}
                disabled={uploading || creating}
              >
                <X className="h-3.5 w-3.5" /> Remove logo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Group title */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Label htmlFor="grp-title" className="text-sm font-medium">
          Group title
        </Label>
        <Input
          id="grp-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mumbai Foodies 🍱"
          maxLength={64}
          className="mt-2 min-h-[44px]"
          disabled={creating}
        />
      </div>

      {/* Description */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Label htmlFor="grp-desc" className="text-sm font-medium">
          Description
        </Label>
        <Textarea
          id="grp-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this group about?"
          maxLength={280}
          className="mt-2 min-h-[88px]"
          disabled={creating}
        />
        <p className="mt-1 text-right text-[10px] text-muted-foreground">
          {description.length}/280
        </p>
      </div>

      {/* Category */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Label className="text-sm font-medium">Category</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Used by Discover to filter your group.
        </p>
        <Select value={category} onValueChange={setCategory} disabled={creating}>
          <SelectTrigger className="min-h-[44px] w-full">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {CREATE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Public / Private switch */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">
              {isPublic ? 'Public group' : 'Private group'}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {isPublic
                ? 'Anyone can find and join via the invite code or Discover.'
                : 'People must request to join. You approve each request.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isPublic ? (
                <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Public</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Private</span>
              )}
            </span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={creating} aria-label="Public or private" />
          </div>
        </div>
      </div>

      {/* Create button */}
      <Button
        type="button"
        onClick={handleCreate}
        disabled={creating || uploading || !name.trim()}
        className="btn-brand min-h-[48px] w-full"
      >
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Create Group
          </>
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You become the group owner and can invite members next.
      </p>
    </motion.div>
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
