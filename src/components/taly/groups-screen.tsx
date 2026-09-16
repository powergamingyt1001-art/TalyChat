'use client'

import { useState } from 'react'
import { ImagePlus, Loader2, Plus, Users } from 'lucide-react'
import { apiFetch, apiUpload } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { CATEGORIES } from '@/components/taly/customizer-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

export function GroupsScreen({ conversations, onOpenChat, onRefresh }: GroupsProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoinByCode = async () => {
    const code = inviteCode.trim().toUpperCase()
    if (!code) return
    setJoining(true)
    try {
      const res: any = await apiFetch('/api/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code }),
      })
      // Defensive: API returns { group: {...}, alreadyMember, role }.
      // Fall back to bare group object just in case shape changes.
      const group = res?.group || (res?.id ? res : null)
      toast({
        title: res?.alreadyMember
          ? 'You are already a member'
          : `Joined ${group?.name || 'group'} 🎉`,
      })
      setInviteCode('')
      onRefresh()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to join', variant: 'destructive' })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Button onClick={() => setCreateOpen(true)} className="btn-brand min-h-[44px]">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      {/* Join by invite code */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <Label className="text-sm font-medium">Have an invite code?</Label>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="e.g. AB12CD"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            className="uppercase"
          />
          <Button
            onClick={handleJoinByCode}
            disabled={joining || !inviteCode.trim()}
            className="min-h-[44px]"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join'}
          </Button>
        </div>
      </div>

      {/* List of joined groups */}
      <h2 className="mt-5 text-base font-semibold">Your groups</h2>
      <div className="mt-2 space-y-2">
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
            You haven&apos;t joined any groups. Use an invite code or create one above.
          </div>
        ) : (
          conversations.map((c) => {
            const g = c.group
            const memberCount = g?.membersCount || 0
            const last = c.lastMessage
            const preview = messagePreview(last)
            return (
              <button
                key={c.id}
                onClick={() => onOpenChat(c)}
                className="flex w-full min-h-[60px] items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={g?.logo || c.avatar || undefined} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                    {(c.name || '?')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(last?.createdAt || c.updatedAt)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{memberCount} members</span>
                    {last && <span> · {preview}</span>}
                  </p>
                </div>
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
      toast({ title: code ? `Group created! Invite code: ${code}` : 'Group created 🎉' })
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
              <p className="text-xs text-muted-foreground">Anyone can find and join</p>
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
