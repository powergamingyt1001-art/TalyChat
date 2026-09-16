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
import { Loader2, Search, UserPlus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface UserResult {
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
 * Add-member dialog for group chats. Searches users by name/username via
 * /api/users/search?q=… and adds them to the group via POST /api/groups/[id]/members.
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
  const [results, setResults] = React.useState<UserResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [addingId, setAddingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSearching(false)
      setAddingId(null)
    }
  }, [open])

  // Debounced search (300ms)
  React.useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res: any = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        // Defensive: API returns { users: [...] }, fall back to bare array.
        const list: UserResult[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.users)
            ? res.users
            : Array.isArray(res?.items)
              ? res.items
              : []
        setResults(list)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, open])

  const handleAdd = async (userId: string) => {
    setAddingId(userId)
    try {
      await apiFetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      toast({ title: 'Member added' })
      setResults((prev) => prev.filter((u) => u.id !== userId))
      onAdded?.()
    } catch (e: any) {
      toast({ title: e.message || 'Failed to add member', variant: 'destructive' })
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add member{groupName ? ` to ${groupName}` : ''}</DialogTitle>
          <DialogDescription>
            Search by username or name. Only users you haven&apos;t blocked and who haven&apos;t
            blocked you can be added.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="pl-8"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="scroll-pan-y max-h-[280px] overflow-y-auto">
          {results.length === 0 && !searching && query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No users found.
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Start typing to search.
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {results.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent"
              >
                <Avatar className="h-9 w-9">
                  {u.avatar && <AvatarImage src={u.avatar} alt={u.name || u.username} />}
                  <AvatarFallback>
                    {(u.name || u.username || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {u.name || u.username}
                  </div>
                  {u.username && (
                    <div className="truncate text-xs text-muted-foreground">
                      @{u.username}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAdd(u.id)}
                  disabled={addingId === u.id}
                >
                  {addingId === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Add
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
