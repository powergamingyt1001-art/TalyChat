'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Loader2,
  User,
  Globe,
  Layout,
  Shield,
  Bell,
  Info,
  Pencil,
  KeyRound,
  Trash2,
  Eye,
  Wifi,
  CheckCheck,
  MessageSquare,
  Users,
  Save,
  Github,
} from 'lucide-react'

const APP_VERSION = '1.0.0'
const FOUNDER = process.env.NEXT_PUBLIC_FOUNDER || 'Omkar Panday'
const TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || 'Chat. Connect. Mingle.'
const GITHUB_URL = 'https://github.com/omkarpanday/talychat'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'zh', label: 'Chinese' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
  { value: 'other', label: 'Other' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const loadPrefs = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/preferences')
      setPrefs(res || {})
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadPrefs()
     
  }, [open])

  const save = async (patch: Record<string, any>) => {
    setSavingKey(Object.keys(patch)[0] || null)
    // Optimistic local update
    setPrefs((p: any) => ({ ...p, ...patch }))
    try {
      await apiFetch('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(patch),
      })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
      // revert
      setPrefs((p: any) => ({ ...p }))
      void loadPrefs()
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Settings
          </SheetTitle>
          <SheetDescription>Manage your TalyChat account and preferences</SheetDescription>
        </SheetHeader>

        {loading || !prefs ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="scroll-pan-y flex-1">
            <div className="space-y-6 p-4">
              {/* Account */}
              <SettingsSection icon={<User className="h-4 w-4 text-primary" />} title="Account">
                <div className="space-y-3">
                  <AccountRow label="Display name" value={user?.name || '—'} />
                  <AccountRow label="Username" value={`@${user?.username || '—'}`} />
                  <AccountRow label="Email" value={user?.email || '—'} />
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose()
                      }}
                      className="min-h-[40px] flex-1"
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Edit profile
                    </Button>
                  </div>
                  <PasswordChanger />
                  <DeleteAccount />
                </div>
              </SettingsSection>

              {/* Language */}
              <SettingsSection icon={<Globe className="h-4 w-4 text-primary" />} title="Language">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="lang-select" className="text-sm">
                    App language
                  </Label>
                  <Select
                    value={prefs.language || 'en'}
                    onValueChange={(v) => save({ language: v })}
                  >
                    <SelectTrigger id="lang-select" className="min-h-[40px] w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {savingKey === 'language' && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">Saving…</p>
                )}
              </SettingsSection>

              {/* Layout Mode */}
              <SettingsSection icon={<Layout className="h-4 w-4 text-primary" />} title="Layout Mode">
                <RadioGroup
                  value={prefs.layoutMode || 'auto'}
                  onValueChange={(v) => save({ layoutMode: v })}
                  className="grid grid-cols-3 gap-2"
                >
                  {[
                    { value: 'auto', label: 'Auto' },
                    { value: 'mobile', label: 'Mobile' },
                    { value: 'desktop', label: 'Desktop' },
                  ].map((m) => (
                    <Label
                      key={m.value}
                      htmlFor={`lm-${m.value}`}
                      className="flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border p-2 text-center text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`lm-${m.value}`} value={m.value} className="sr-only" />
                      <span className="font-medium">{m.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
                {savingKey === 'layoutMode' && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">Saving…</p>
                )}
              </SettingsSection>

              {/* Privacy */}
              <SettingsSection icon={<Shield className="h-4 w-4 text-primary" />} title="Privacy">
                <div className="space-y-1">
                  <SwitchRow
                    icon={<Eye className="h-4 w-4" />}
                    label="Show last seen publicly"
                    desc="Others can see when you were last active"
                    checked={!!prefs.lastSeenPublic}
                    saving={savingKey === 'lastSeenPublic'}
                    onToggle={(v) => save({ lastSeenPublic: v })}
                  />
                  <SwitchRow
                    icon={<Wifi className="h-4 w-4" />}
                    label="Show online status"
                    desc="Others can see when you're online"
                    checked={!!prefs.onlinePublic}
                    saving={savingKey === 'onlinePublic'}
                    onToggle={(v) => save({ onlinePublic: v })}
                  />
                  <SwitchRow
                    icon={<CheckCheck className="h-4 w-4" />}
                    label="Read receipts"
                    desc="Send read receipts to others (you also won't see theirs if off)"
                    checked={!!prefs.readReceipts}
                    saving={savingKey === 'readReceipts'}
                    onToggle={(v) => save({ readReceipts: v })}
                  />
                </div>
              </SettingsSection>

              {/* Notifications */}
              <SettingsSection icon={<Bell className="h-4 w-4 text-primary" />} title="Notifications">
                <div className="space-y-1">
                  <SwitchRow
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Direct messages"
                    desc="Push notifications for new 1:1 messages"
                    checked={prefs.notifMessages !== false}
                    saving={savingKey === 'notifMessages'}
                    onToggle={(v) => save({ notifMessages: v })}
                  />
                  <SwitchRow
                    icon={<Users className="h-4 w-4" />}
                    label="Group messages"
                    desc="Push notifications for new group messages"
                    checked={prefs.notifGroups !== false}
                    saving={savingKey === 'notifGroups'}
                    onToggle={(v) => save({ notifGroups: v })}
                  />
                </div>
              </SettingsSection>

              {/* About */}
              <SettingsSection icon={<Info className="h-4 w-4 text-primary" />} title="About TalyChat">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono">{APP_VERSION}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Founder</span>
                    <span className="font-medium">{FOUNDER}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tagline</span>
                    <span className="italic">{TAGLINE}</span>
                  </div>
                  <Separator className="my-2" />
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent"
                  >
                    <Github className="h-4 w-4" /> View on GitHub
                  </a>
                </div>
              </SettingsSection>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ============================================================
// Helpers
// ============================================================

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h3>
      {children}
    </section>
  )
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  )
}

function SwitchRow({
  icon,
  label,
  desc,
  checked,
  saving,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  desc?: string
  checked: boolean
  saving?: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {saving ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Switch checked={checked} onCheckedChange={onToggle} aria-label={label} />
      )}
    </div>
  )
}

function PasswordChanger() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [conf, setConf] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!cur || !next || !conf) {
      toast({ title: 'All fields are required', variant: 'destructive' })
      return
    }
    if (next !== conf) {
      toast({ title: 'New passwords do not match', variant: 'destructive' })
      return
    }
    if (next.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      })
      toast({ title: 'Password updated' })
      setOpen(false)
      setCur('')
      setNext('')
      setConf('')
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="min-h-[40px] w-full justify-start"
      >
        <KeyRound className="mr-2 h-4 w-4" /> Change password
      </Button>
    )
  }
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Change password</p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Input
        type="password"
        placeholder="Current password"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        className="min-h-[40px]"
      />
      <Input
        type="password"
        placeholder="New password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="min-h-[40px]"
      />
      <Input
        type="password"
        placeholder="Confirm new password"
        value={conf}
        onChange={(e) => setConf(e.target.value)}
        className="min-h-[40px]"
      />
      <Button onClick={submit} disabled={saving} className="btn-brand min-h-[40px] w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Update password
      </Button>
    </div>
  )
}

function DeleteAccount() {
  const { toast } = useToast()
  const { logout } = useAuth()
  const [saving, setSaving] = useState(false)

  const handleDelete = async () => {
    setSaving(true)
    try {
      await apiFetch('/api/users/me', { method: 'DELETE' })
      toast({ title: 'Account deleted' })
      logout()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[40px] w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent. All your messages, groups, and data will be erased.
            You will be logged out immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={saving}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
