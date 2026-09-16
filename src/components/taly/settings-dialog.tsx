'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import { usePushNotifications } from '@/hooks/use-push-notifications'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Badge } from '@/components/ui/badge'
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
  AlertTriangle,
  QrCode,
  Lock,
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
                  <TwoFactorSection />
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
                  {/* V8 — Push notifications toggle (browser Notification API + Push API) */}
                  <PushNotificationsRow />
                  <SwitchRow
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Direct messages"
                    desc="In-app notifications for new 1:1 messages"
                    checked={prefs.notifMessages !== false}
                    saving={savingKey === 'notifMessages'}
                    onToggle={(v) => save({ notifMessages: v })}
                  />
                  <SwitchRow
                    icon={<Users className="h-4 w-4" />}
                    label="Group messages"
                    desc="In-app notifications for new group messages"
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
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [saving, setSaving] = useState(false)

  const canSubmit =
    password.length > 0 && confirmText === 'DELETE' && !saving

  const handleDelete = async () => {
    if (!password) {
      toast({ title: 'Password is required', variant: 'destructive' })
      return
    }
    if (confirmText !== 'DELETE') {
      toast({ title: 'Please type DELETE to confirm', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await apiFetch('/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ password, confirmText }),
      })
      toast({ title: 'Account deleted', description: 'You will be logged out.' })
      setOpen(false)
      // Wipe auth state + redirect to auth screen
      logout()
      // Hard reload to clear any cached UI state.
      setTimeout(() => {
        window.location.href = window.location.origin
      }, 300)
    } catch (e: any) {
      toast({ title: e.message || 'Failed to delete account', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPassword('')
    setConfirmText('')
    setSaving(false)
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Delete your account?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will <span className="font-semibold text-destructive">permanently delete your account</span>.
            Your messages will be soft-deleted, your name anonymized to &quot;Deleted User&quot;, and
            you will be removed from all groups. This action <span className="font-semibold">cannot be undone</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="del-password">Enter your password</Label>
            <Input
              id="del-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[44px]"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-semibold text-destructive">DELETE</span> to confirm
            </Label>
            <Input
              id="del-confirm"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="min-h-[44px]"
              autoComplete="off"
            />
            {confirmText && confirmText !== 'DELETE' && (
              <p className="text-xs text-destructive">
                You must type exactly &quot;DELETE&quot;
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving} className="min-h-[44px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault() // keep dialog open until handler closes it
              handleDelete()
            }}
            disabled={!canSubmit}
            className="min-h-[44px] bg-destructive text-white hover:bg-destructive/90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete account permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// V8 — Push notifications toggle (browser Notification API + Push API)
// ============================================================

function PushNotificationsRow() {
  const { toast } = useToast()
  const {
    supported,
    pushSupported,
    permission,
    status,
    subscribe,
    unsubscribe,
  } = usePushNotifications()

  // "Enabled" means we've actually created a subscription. Falls back to
  // "permission granted" for browsers that don't support the Push API
  // (e.g. iOS Safari) — those still get local notifications.
  const isChecked =
    !supported
      ? false
      : status === 'subscribed' ||
        (permission === 'granted' && !pushSupported)

  const [busy, setBusy] = useState(false)

  let statusLabel = 'Disabled'
  if (!supported) statusLabel = 'Not supported'
  else if (permission === 'denied') statusLabel = 'Permission denied'
  else if (isChecked) statusLabel = 'Enabled'
  else statusLabel = 'Disabled'

  const handleToggle = async (v: boolean) => {
    setBusy(true)
    try {
      if (v) {
        if (!supported) {
          toast({
            title: 'Notifications not supported',
            description: 'This browser does not support desktop notifications.',
            variant: 'destructive',
          })
          return
        }
        const ok = await subscribe()
        if (ok) {
          toast({ title: 'Notifications enabled' })
        } else {
          toast({
            title: 'Could not enable notifications',
            description:
              permission === 'denied'
                ? 'Permission was denied. Update your browser settings to allow notifications.'
                : 'We could not create a push subscription. You will still get in-app alerts.',
            variant: 'destructive',
          })
        }
      } else {
        await unsubscribe()
        toast({ title: 'Notifications disabled' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[44px] items-center gap-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Desktop notifications</p>
        <p className="text-xs text-muted-foreground">{statusLabel}</p>
      </div>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Switch
          checked={isChecked}
          onCheckedChange={handleToggle}
          disabled={!supported}
          aria-label="Enable desktop notifications"
        />
      )}
    </div>
  )
}

// ============================================================
// V9 — Two-Factor Authentication (TOTP)
// ============================================================

interface TwoFactorState {
  enabled: boolean
  hasSecret: boolean
}

function TwoFactorSection() {
  const { toast } = useToast()
  const [state, setState] = useState<TwoFactorState>({
    enabled: false,
    hasSecret: false,
  })
  const [loading, setLoading] = useState(true)

  // Setup dialog state (open + QR data + verification code input)
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupData, setSetupData] = useState<{
    qrDataUrl: string
    secret: string
    label: string
  } | null>(null)
  const [setupToken, setSetupToken] = useState('')
  const [settingUp, setSettingUp] = useState(false)

  // Disable dialog state (password input)
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling, setDisabling] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/2fa/status')
      setState({
        enabled: !!res?.enabled,
        hasSecret: !!res?.hasSecret,
      })
    } catch {
      // Silent — section just shows "Disabled"
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const startEnable = async () => {
    setSettingUp(true)
    setSetupToken('')
    try {
      const res: any = await apiFetch('/api/auth/2fa/setup', { method: 'POST' })
      setSetupData({
        qrDataUrl: res.qrDataUrl,
        secret: res.secret,
        label: res.label,
      })
      setSetupOpen(true)
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to set up 2FA', variant: 'destructive' })
    } finally {
      setSettingUp(false)
    }
  }

  const confirmEnable = async () => {
    const token = setupToken.replace(/\s+/g, '').trim()
    if (!/^\d{6}$/.test(token)) {
      toast({ title: 'Enter the 6-digit code', variant: 'destructive' })
      return
    }
    setSettingUp(true)
    try {
      await apiFetch('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      toast({ title: '2FA enabled', description: 'Your account is now protected by 2FA.' })
      setSetupOpen(false)
      setSetupToken('')
      setSetupData(null)
      setState({ enabled: true, hasSecret: true })
    } catch (e: any) {
      toast({ title: e?.message || 'Invalid code', variant: 'destructive' })
    } finally {
      setSettingUp(false)
    }
  }

  const cancelSetup = async () => {
    setSetupOpen(false)
    setSetupToken('')
    setSetupData(null)
    // Optionally clear the stored secret so a future setup generates a fresh one.
    // We skip the explicit clear here because the next setup call will overwrite it.
  }

  const confirmDisable = async () => {
    if (!disablePassword) {
      toast({ title: 'Password is required', variant: 'destructive' })
      return
    }
    setDisabling(true)
    try {
      await apiFetch('/api/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disablePassword }),
      })
      toast({ title: '2FA disabled', description: 'Two-factor authentication has been turned off.' })
      setDisableOpen(false)
      setDisablePassword('')
      setState({ enabled: false, hasSecret: false })
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to disable 2FA', variant: 'destructive' })
    } finally {
      setDisabling(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-[44px] items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {state.enabled ? <Shield className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Two-factor authentication</p>
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : state.enabled ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Disabled
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {state.enabled
              ? 'Protect your account with a 6-digit code from your authenticator app.'
              : 'Add an extra layer of security to your account.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!state.enabled && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[40px] flex-1"
            onClick={startEnable}
            disabled={settingUp}
          >
            {settingUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="mr-2 h-4 w-4" />
            )}
            Enable 2FA
          </Button>
        )}
        {state.enabled && (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[40px] flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDisableOpen(true)}
          >
            <Lock className="mr-2 h-4 w-4" /> Disable 2FA
          </Button>
        )}
      </div>

      {/* ---------------- Setup dialog: QR + verification ---------------- */}
      <Dialog open={setupOpen} onOpenChange={(o) => !o && cancelSetup()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Set up two-factor authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password…).
              Then enter the 6-digit code your app generates.
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-3">
              <div className="flex justify-center rounded-md border bg-white p-3">
                <img
                  src={setupData.qrDataUrl}
                  alt="2FA QR code"
                  width={220}
                  height={220}
                  className="h-[220px] w-[220px]"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">
                  Or enter this code manually:
                </p>
                <code className="mt-1 block select-all break-all font-mono text-sm font-semibold tracking-wider text-foreground">
                  {setupData.secret}
                </code>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Account: {setupData.label}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="two-fa-token">Enter the 6-digit code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    id="two-fa-token"
                    maxLength={6}
                    value={setupToken}
                    onChange={(v) => setSetupToken(v)}
                    autoFocus
                    onComplete={confirmEnable}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="min-h-[40px]"
              onClick={cancelSetup}
              disabled={settingUp}
            >
              Cancel
            </Button>
            <Button
              className="btn-brand min-h-[40px]"
              onClick={confirmEnable}
              disabled={settingUp || !/^\d{6}$/.test(setupToken.replace(/\s+/g, ''))}
            >
              {settingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Verify & enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Disable dialog: password ---------------- */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Disable two-factor authentication?
            </DialogTitle>
            <DialogDescription>
              Your account will be less secure. To confirm, enter your password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="two-fa-pw">Enter your password</Label>
            <Input
              id="two-fa-pw"
              type="password"
              placeholder="••••••••"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="min-h-[44px]"
              autoComplete="current-password"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmDisable()
                }
              }}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="min-h-[40px]"
              onClick={() => {
                setDisableOpen(false)
                setDisablePassword('')
              }}
              disabled={disabling}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-[40px]"
              onClick={confirmDisable}
              disabled={disabling || !disablePassword}
            >
              {disabling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


