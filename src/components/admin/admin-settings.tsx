'use client'

import * as React from 'react'
import {
  Settings,
  Image as ImageIcon,
  KeyRound,
  CreditCard,
  Bot,
  LogOut,
  Plus,
  Save,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AdminAd,
  type AdminPayment,
  type AdminTalyRequest,
  EmptyState,
  StatusBadge,
  formatDate,
  formatDateTime,
  formatINR,
  initials,
  truncate,
} from './admin-shared'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

// ============================================================
// Main settings tab — composes all sections
// ============================================================

export function AdminSettings({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">App configuration, ads, payments & support</p>
      </div>

      <AppSettingsSection />
      <Separator />
      <AdsSection />
      <Separator />
      <PasswordSection />
      <Separator />
      <PaymentsSection />
      <Separator />
      <TalyRequestsSection />
      <Separator />

      <div className="flex justify-center pb-4">
        <Button variant="destructive" className="h-11" onClick={onLogout}>
          <LogOut className="size-4" /> Logout
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Section 1 — App settings editor
// ============================================================

const AD_RELATED_KEYS = new Set([
  'ads_enabled',
  'ads_private_interval',
  'ads_group_interval',
])

function AppSettingsSection() {
  const { toast } = useToast()
  const [map, setMap] = React.useState<Record<string, string>>({})
  const [draft, setDraft] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/admin/settings')
      setMap(res?.settings || {})
      setDraft(res?.settings || {})
    } catch (e: any) {
      toast({ title: 'Failed to load settings', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const saveAll = async () => {
    const changed = Object.fromEntries(
      Object.entries(draft).filter(([k, v]) => map[k] !== v)
    )
    if (Object.keys(changed).length === 0) {
      toast({ title: 'No changes to save' })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(changed),
      })
      toast({ title: 'Settings saved', description: `${Object.keys(changed).length} updated` })
      load()
    } catch (e: any) {
      toast({ title: 'Failed to save', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const addNew = () => {
    const key = prompt('New setting key:')
    if (!key) return
    if (draft[key] !== undefined) {
      toast({ title: 'Key already exists' })
      return
    }
    setDraft((d) => ({ ...d, [key]: '' }))
  }

  const setVal = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  const adEntries = Object.entries(draft).filter(([k]) => AD_RELATED_KEYS.has(k))
  const otherEntries = Object.entries(draft).filter(([k]) => !AD_RELATED_KEYS.has(k))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Settings className="size-4 text-primary" /> App settings
          </h3>
          <p className="text-xs text-muted-foreground">Key/value pairs from <code className="font-mono">AppSetting</code></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={addNew}>
            <Plus className="size-4" /> New
          </Button>
          <Button className="btn-brand h-9" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save All
          </Button>
        </div>
      </div>

      {/* Ad-specific quick controls */}
      {adEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ad controls</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {adEntries.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium">{humanizeKey(k)}</Label>
                  <p className="text-xs text-muted-foreground">{k}</p>
                </div>
                {k === 'ads_enabled' ? (
                  <Switch
                    checked={v === 'true' || v === '1'}
                    onCheckedChange={(c) => setVal(k, c ? 'true' : 'false')}
                  />
                ) : (
                  <Input
                    type="number"
                    value={v}
                    onChange={(e) => setVal(k, e.target.value)}
                    className="h-9 w-32"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All settings */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : otherEntries.length === 0 && adEntries.length === 0 ? (
            <EmptyState title="No settings yet" hint="Add one with the New button" icon={Settings} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {otherEntries.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <Label className="text-xs font-medium">{k}</Label>
                  <Input
                    value={v}
                    onChange={(e) => setVal(k, e.target.value)}
                    className="h-10"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function humanizeKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ============================================================
// Section 2 — Ad management
// ============================================================

const AD_PLACEMENTS = ['in-chat', 'home', 'discover'] as const

function AdsSection() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [ads, setAds] = React.useState<AdminAd[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState<AdminAd | null>(null)
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/admin/ads')
      setAds(res?.ads || [])
    } catch (e: any) {
      toast({ title: 'Failed to load ads', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this ad permanently?')) return
    try {
      await apiFetch('/api/admin/ads', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      toast({ title: 'Ad deleted' })
      load()
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' })
    }
  }

  const toggleActive = async (ad: AdminAd) => {
    try {
      await apiFetch('/api/admin/ads', {
        method: 'PATCH',
        body: JSON.stringify({ id: ad.id, isActive: !ad.isActive }),
      })
      toast({ title: `Ad ${!ad.isActive ? 'enabled' : 'disabled'}` })
      load()
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="size-4 text-primary" /> Ad management
          </h3>
          <p className="text-xs text-muted-foreground">Create, edit and toggle ad units</p>
        </div>
        <Button className="btn-brand h-9" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New Ad
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : ads.length === 0 ? (
            <EmptyState title="No ads yet" hint="Create one to start serving ads" icon={ImageIcon} />
          ) : isMobile ? (
            <div className="divide-y">
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} onEdit={() => setEditing(ad)} onToggle={() => toggleActive(ad)} onDelete={() => remove(ad.id)} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ads.map((ad) => (
                  <TableRow key={ad.id}>
                    <TableCell className="font-medium">{ad.brandName}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {ad.headline}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{ad.placement}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ad.impressions.toLocaleString('en-IN')} imp · {ad.clicks.toLocaleString('en-IN')} clicks
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={ad.isActive} onCheckedChange={() => toggleActive(ad)} />
                        <span className="text-xs">{ad.isActive ? 'Active' : 'Off'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-9" onClick={() => setEditing(ad)} aria-label="Edit ad">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-9 text-destructive" onClick={() => remove(ad.id)} aria-label="Delete ad">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdEditor
        open={creating || !!editing}
        ad={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={() => {
          setCreating(false)
          setEditing(null)
          load()
        }}
      />
    </section>
  )
}

function AdCard({
  ad,
  onEdit,
  onToggle,
  onDelete,
}: {
  ad: AdminAd
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.brandName} className="size-12 rounded-md object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-md bg-muted">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ad.brandName}</p>
          <p className="truncate text-xs text-muted-foreground">{ad.headline}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">{ad.placement}</Badge>
            <span className="text-xs text-muted-foreground">
              {ad.impressions.toLocaleString('en-IN')} imp · {ad.clicks.toLocaleString('en-IN')} clicks
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={ad.isActive} onCheckedChange={onToggle} />
          <span className="text-xs">{ad.isActive ? 'Active' : 'Off'}</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-9" onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button size="icon" variant="ghost" className="size-9 text-destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function AdEditor({
  open,
  ad,
  onClose,
  onSaved,
}: {
  open: boolean
  ad: AdminAd | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<any>({})

  React.useEffect(() => {
    if (!open) return
    if (ad) {
      setForm({
        brandName: ad.brandName,
        headline: ad.headline,
        description: ad.description || '',
        imageUrl: ad.imageUrl || '',
        ctaText: ad.ctaText || 'Learn More',
        ctaUrl: ad.ctaUrl || '',
        placement: ad.placement,
        category: ad.category || '',
        startDate: ad.startDate ? ad.startDate.slice(0, 10) : '',
        endDate: ad.endDate ? ad.endDate.slice(0, 10) : '',
        isActive: ad.isActive,
      })
    } else {
      setForm({
        brandName: '',
        headline: '',
        description: '',
        imageUrl: '',
        ctaText: 'Learn More',
        ctaUrl: '',
        placement: 'in-chat',
        category: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        isActive: true,
      })
    }
  }, [ad, open])

  const submit = async () => {
    if (!form.brandName || !form.headline) {
      toast({ title: 'brandName and headline are required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        category: form.category || null,
        endDate: form.endDate || null,
        startDate: form.startDate || new Date().toISOString(),
      }
      if (ad) {
        await apiFetch('/api/admin/ads', {
          method: 'PATCH',
          body: JSON.stringify({ id: ad.id, ...payload }),
        })
      } else {
        await apiFetch('/api/admin/ads', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      toast({ title: ad ? 'Ad updated' : 'Ad created' })
      onSaved()
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ad ? 'Edit ad' : 'Create ad'}</DialogTitle>
          <DialogDescription>Configure creative, placement and schedule</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <LabeledInput label="Brand name" value={form.brandName} onChange={(v) => setForm((f: any) => ({ ...f, brandName: v }))} placeholder="Acme" />
          <LabeledInput label="Headline" value={form.headline} onChange={(v) => setForm((f: any) => ({ ...f, headline: v }))} placeholder="Check out our deal" />
          <LabeledTextarea label="Description" value={form.description} onChange={(v) => setForm((f: any) => ({ ...f, description: v }))} placeholder="Optional body copy" />
          <LabeledInput label="Image URL" value={form.imageUrl} onChange={(v) => setForm((f: any) => ({ ...f, imageUrl: v }))} placeholder="/uploads/…" />
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="CTA text" value={form.ctaText} onChange={(v) => setForm((f: any) => ({ ...f, ctaText: v }))} />
            <LabeledInput label="CTA URL" value={form.ctaUrl} onChange={(v) => setForm((f: any) => ({ ...f, ctaUrl: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Placement">
              <Select value={form.placement} onValueChange={(v) => setForm((f: any) => ({ ...f, placement: v }))}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_PLACEMENTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <LabeledInput label="Category (optional)" value={form.category} onChange={(v) => setForm((f: any) => ({ ...f, category: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Start date" type="date" value={form.startDate} onChange={(v) => setForm((f: any) => ({ ...f, startDate: v }))} />
            <LabeledInput label="End date (optional)" type="date" value={form.endDate} onChange={(v) => setForm((f: any) => ({ ...f, endDate: v }))} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground">Show this ad to users</p>
            </div>
            <Switch checked={!!form.isActive} onCheckedChange={(c) => setForm((f: any) => ({ ...f, isActive: c }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="btn-brand" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {ad ? 'Save changes' : 'Create ad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Section 3 — Change admin password
// ============================================================

function PasswordSection() {
  const { toast } = useToast()
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const submit = async () => {
    if (!current || !next || !confirm) {
      toast({ title: 'All fields required', variant: 'destructive' })
      return
    }
    if (next !== confirm) {
      toast({ title: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (next.length < 6) {
      toast({ title: 'New password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      toast({ title: 'Password updated' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (e: any) {
      toast({ title: 'Failed to update', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <KeyRound className="size-4 text-primary" /> Change admin password
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <LabeledInput label="Current password" type="password" value={current} onChange={setCurrent} />
        <LabeledInput label="New password" type="password" value={next} onChange={setNext} />
        <LabeledInput label="Confirm new" type="password" value={confirm} onChange={setConfirm} />
      </div>
      <div className="flex justify-end">
        <Button className="btn-brand h-10" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Update password
        </Button>
      </div>
    </section>
  )
}

// ============================================================
// Section 4 — Payment proofs
// ============================================================

function PaymentsSection() {
  const { toast } = useToast()
  const [payments, setPayments] = React.useState<AdminPayment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actingId, setActingId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<'pending' | 'approved' | 'rejected'>('pending')

  const load = React.useCallback(async (s: 'pending' | 'approved' | 'rejected') => {
    setLoading(true)
    try {
      const res: any = await apiFetch(`/api/admin/payments?status=${s}`)
      setPayments(res?.payments || [])
    } catch (e: any) {
      toast({ title: 'Failed to load payments', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load(statusFilter)
  }, [statusFilter, load])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id)
    try {
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      toast({ title: action === 'approve' ? 'Payment approved — premium granted' : 'Payment rejected' })
      // remove from current list if filter is pending
      if (statusFilter === 'pending') {
        setPayments((prev) => prev.filter((p) => p.id !== id))
      } else {
        load(statusFilter)
      }
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActingId(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="size-4 text-primary" /> Payment proofs
        </h3>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState title="No payments" hint={`No ${statusFilter} payment proofs`} icon={CreditCard} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {payments.map((p) => (
            <PaymentCard key={p.id} payment={p} acting={actingId === p.id} onAct={act} />
          ))}
        </div>
      )}
    </section>
  )
}

function PaymentCard({
  payment,
  acting,
  onAct,
}: {
  payment: AdminPayment
  acting: boolean
  onAct: (id: string, action: 'approve' | 'reject') => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-10">
            {payment.user.avatar ? <AvatarImage src={payment.user.avatar} alt={payment.user.name} /> : null}
            <AvatarFallback>{initials(payment.user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{payment.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">@{payment.user.username}</p>
            <p className="truncate text-xs text-muted-foreground">{payment.user.email}</p>
          </div>
          <StatusBadge status={payment.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Cell label="Plan" value={payment.plan} />
          <Cell label="Amount" value={formatINR(payment.amount)} />
          <Cell label="Txn ID" value={payment.transactionId} />
          <Cell label="UTR" value={payment.utrNumber || '—'} />
        </div>

        {payment.screenshotUrl && (
          <a
            href={payment.screenshotUrl}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img
              src={payment.screenshotUrl}
              alt="Payment proof"
              className="h-32 w-full rounded-md border object-cover"
            />
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="size-3" /> Tap to view full screenshot
            </p>
          </a>
        )}

        {payment.notes && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            {truncate(payment.notes, 200)}
          </p>
        )}

        <p className="text-xs text-muted-foreground">Submitted {formatDateTime(payment.createdAt)}</p>

        {payment.status === 'pending' && (
          <div className="flex gap-2">
            <Button size="sm" className="btn-brand h-11 flex-1" disabled={acting} onClick={() => onAct(payment.id, 'approve')}>
              {acting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" className="h-11 flex-1" disabled={acting} onClick={() => onAct(payment.id, 'reject')}>
              {acting ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Section 5 — Taly Support requests
// ============================================================

function TalyRequestsSection() {
  const { toast } = useToast()
  const [requests, setRequests] = React.useState<AdminTalyRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actingId, setActingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/admin/taly-requests?status=pending')
      setRequests(res?.requests || [])
    } catch (e: any) {
      toast({ title: 'Failed to load requests', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActingId(id)
    try {
      await apiFetch('/api/admin/taly-requests', {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      toast({ title: action === 'approve' ? 'Request approved' : 'Request rejected' })
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message, variant: 'destructive' })
    } finally {
      setActingId(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Bot className="size-4 text-primary" /> Taly Support requests
      </h3>
      <p className="text-xs text-muted-foreground">
        Pending escalation requests from users (e.g., account unlocks).
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState title="No pending requests" hint="All caught up" icon={Bot} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    {r.user.avatar ? <AvatarImage src={r.user.avatar} alt={r.user.name} /> : null}
                    <AvatarFallback>{initials(r.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{r.user.username}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.user.email}</p>
                  </div>
                </div>
                <p className="rounded-md bg-muted/50 p-2 text-sm">{r.message}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                <div className="flex gap-2">
                  <Button size="sm" className="btn-brand h-11 flex-1" disabled={actingId === r.id} onClick={() => act(r.id, 'approve')}>
                    {actingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-11 flex-1" disabled={actingId === r.id} onClick={() => act(r.id, 'reject')}>
                    {actingId === r.id ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

// ============================================================
// Small reusable form bits
// ============================================================

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10"
      />
    </Field>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[80px]" />
    </Field>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  )
}
