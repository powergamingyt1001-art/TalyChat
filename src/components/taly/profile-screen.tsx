'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, apiUpload, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Pencil,
  Crown,
  Copy,
  Gift,
  Users,
  Shield,
  LogOut,
  CheckCircle2,
  Star,
  CalendarDays,
  Upload,
  Sparkles,
  Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { SettingsDialog } from '@/components/taly/settings-dialog'

const UPI_ID = process.env.NEXT_PUBLIC_PAYMENT_UPI_ID || '9897186065@fam'
const QR_SRC = process.env.NEXT_PUBLIC_PAYMENT_QR || '/payment/qr-code.png'
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'talychat.app'

const OFFER_KEY = 'talychat-offer-start'
const OFFER_WINDOW_MS = 30 * 60 * 1000 // 30 minutes
const OFFER_LOOP_MS = 24 * 60 * 60 * 1000 // 24 hours
const OFFER_PRICE = 189
const REGULAR_PRICE = 199

interface ReferralData {
  code: string
  count: number
  progress: string
  tierReached: string | null
  recent: Array<{
    id: string
    status: string
    createdAt: string
    referred: {
      id: string
      name: string
      username: string
      avatar?: string | null
      isPremium: boolean
    }
  }>
}

export function ProfileScreen() {
  const { user, updateUser, logout } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [buyPlan, setBuyPlan] = useState<null | { id: string; label: string; price: number; months: number }>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [referral, setReferral] = useState<ReferralData | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/users/me')
      // Defensive: API returns { user: {...}, preferences: {...} }.
      // Fall back to bare object if shape changes.
      const u = res?.user || (res?.id ? res : null)
      setProfile(u)
      if (u) updateUser(u)
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, updateUser])

  const loadReferral = useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/referral/me')
      // Defensive: API returns flat { code, count, recent, tierReached, progress }.
      // Some backends might wrap as { referral: {...} } — handle both.
      const data = res?.referral || res?.data || res
      setReferral(data as ReferralData)
    } catch {
      setReferral(null)
    }
  }, [])

  useEffect(() => {
     
    loadProfile()
     
    loadReferral()
  }, [loadProfile, loadReferral])

  if (loading && !profile) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl p-4 text-center text-muted-foreground">
        Could not load profile. Please try again.
      </div>
    )
  }

  const premiumActive =
    profile.isPremium &&
    profile.premiumUntil &&
    new Date(profile.premiumUntil) > new Date()

  const copyReferralLink = async () => {
    const link = `${APP_DOMAIN}/?ref=${user?.username || profile.username}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Referral link copied!' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      toast({ title: 'Enter a code first', variant: 'destructive' })
      return
    }
    setRedeemLoading(true)
    try {
      const res: any = await apiFetch('/api/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: redeemCode.trim() }),
      })
      // Defensive: API returns flat { ok, premiumUntil }, but may also be
      // wrapped as { redeem: {...} } or { data: {...} } in some envs.
      const data: any = res?.redeem || res?.data || res
      const premiumUntil = data?.premiumUntil
      toast({
        title: 'Premium activated!',
        description: premiumUntil
          ? `Valid until ${format(new Date(premiumUntil), 'dd MMM yyyy')}`
          : 'Your premium has been extended.',
      })
      setRedeemCode('')
      loadProfile()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setRedeemLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* Profile header card */}
      <Card className="p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar className="h-24 w-24 shrink-0 border-2 border-primary/30">
            <AvatarImage src={profile.avatar || undefined} alt={profile.name} />
            <AvatarFallback className="bg-primary text-2xl font-bold text-primary-foreground">
              {profile.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="truncate text-xl font-bold">{profile.name}</h2>
              {premiumActive && (
                <span className="premium-badge">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio ? (
              <p className="mt-2 line-clamp-3 text-sm">{profile.bio}</p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">No bio yet.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground sm:justify-start">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    profile.isOnline ? 'bg-green-500' : 'bg-muted-foreground'
                  }`}
                />
                {profile.isOnline ? 'Online' : 'Offline'}
              </span>
              {profile.createdAt && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Joined {format(new Date(profile.createdAt), 'MMM yyyy')}
                </span>
              )}
            </div>
            <div className="mt-4">
              <Button
                onClick={() => setEditOpen(true)}
                variant="outline"
                size="sm"
                className="min-h-[40px]"
              >
                <Pencil className="mr-1 h-4 w-4" /> Edit Profile
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Premium section */}
      <Separator />
      <PremiumSection
        premiumActive={premiumActive}
        premiumUntil={profile.premiumUntil}
        onChoosePlan={(plan) => setBuyPlan(plan)}
      />

      {/* Redeem code */}
      <Separator />
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Gift className="h-4 w-4 text-primary" /> Redeem a Code
        </h3>
        <div className="flex gap-2">
          <Input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="Enter redeem code (e.g., TALY-XXXXXXXX)"
            className="min-h-[44px] flex-1 uppercase"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRedeem()
            }}
          />
          <Button
            onClick={handleRedeem}
            disabled={redeemLoading}
            className="btn-brand min-h-[44px] px-5"
          >
            {redeemLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Redeem'
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Get codes from promotions, friends, or the founder.
        </p>
      </Card>

      {/* Referral section */}
      <Separator />
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" /> Refer & Earn
        </h3>
        <p className="text-sm text-muted-foreground">
          Invite friends. At 4 referrals → 30 days premium, 7 → 90 days, 15 → lifetime!
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded-md border bg-muted px-3 py-2 text-sm font-mono">
            {user?.username || profile.username}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={copyReferralLink}
            className="min-h-[40px]"
          >
            <Copy className="mr-1 h-4 w-4" /> Copy link
          </Button>
        </div>
        {referral ? (
          <>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{referral.progress} active referrals</span>
                {referral.tierReached && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Star className="h-3 w-3" /> Tier {referral.tierReached} reached!
                  </span>
                )}
              </div>
              <Progress value={Math.min((referral.count / 15) * 100, 100)} />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent referrals
              </p>
              {referral.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No referrals yet. Share your link to start earning!
                </p>
              ) : (
                <ScrollArea className="max-h-48">
                  <ul className="space-y-2">
                    {referral.recent.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-2 rounded-md border p-2"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.referred?.avatar || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {r.referred?.name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.referred?.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{r.referred?.username}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.status === 'active'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading referral data…</p>
        )}
      </Card>

      {/* Privacy and Safety */}
      <Separator />
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4 text-primary" /> Privacy and Safety
        </h3>
        <Button
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          className="min-h-[44px] w-full justify-start"
        >
          <Shield className="mr-2 h-4 w-4" /> Open privacy settings
        </Button>
        <Separator className="my-3" />
        <Button
          variant="ghost"
          onClick={() => {
            logout()
            toast({ title: 'Logged out' })
          }}
          className="min-h-[44px] w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </Card>

      {/* Edit profile dialog */}
      <EditProfileDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={() => {
          loadProfile()
        }}
      />

      {/* Buy plan dialog */}
      <BuyPlanDialog
        open={!!buyPlan}
        plan={buyPlan}
        onClose={() => setBuyPlan(null)}
        onSubmitted={() => {
          setBuyPlan(null)
        }}
      />

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

// ============================================================
// Premium section with offer countdown timer
// ============================================================

function PremiumSection({
  premiumActive,
  premiumUntil,
  onChoosePlan,
}: {
  premiumActive: boolean
  premiumUntil: string | null
  onChoosePlan: (plan: { id: string; label: string; price: number; months: number }) => void
}) {
  const [offerMsLeft, setOfferMsLeft] = useState<number | null>(null)
  const [offerPrice, setOfferPrice] = useState(OFFER_PRICE)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const compute = () => {
      const now = Date.now()
      let start = Number(localStorage.getItem(OFFER_KEY) || 0)
      if (!start || now - start > OFFER_LOOP_MS) {
        // restart offer cycle
        start = now
        localStorage.setItem(OFFER_KEY, String(start))
      }
      const elapsed = now - start
      if (elapsed < OFFER_WINDOW_MS) {
        setOfferMsLeft(OFFER_WINDOW_MS - elapsed)
        setOfferPrice(OFFER_PRICE)
      } else {
        setOfferMsLeft(0)
        setOfferPrice(REGULAR_PRICE)
      }
    }
    compute()
    timerRef.current = setInterval(compute, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (premiumActive) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-base font-semibold">
              Premium active
              <span className="premium-badge">
                <Crown className="h-3 w-3" /> Pro
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              {premiumUntil
                ? `Valid until ${format(new Date(premiumUntil), 'dd MMM yyyy')}`
                : 'Lifetime'}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const plans = [
    { id: '2mo', label: '2 Months', price: 49, months: 2, best: false },
    { id: '6mo', label: '6 Months', price: 99, months: 6, best: false },
    { id: '1yr', label: '1 Year', price: offerPrice, months: 12, best: true },
  ]

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Upgrade to Premium
        </h3>
        {offerMsLeft && offerMsLeft > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            <Clock className="h-3 w-3" />
            {formatCountdown(offerMsLeft)}
          </span>
        )}
      </div>
      {offerMsLeft && offerMsLeft > 0 ? (
        <p className="mb-3 text-xs text-primary">
          Limited-time offer! 1-year plan for ₹{OFFER_PRICE} (was ₹{REGULAR_PRICE})
        </p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Offer ended — 1-year plan is back to ₹{REGULAR_PRICE}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative flex flex-col gap-1 rounded-xl border-2 p-3 ${
              p.best ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            {p.best && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                Best Value
              </span>
            )}
            <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
            <p className="text-2xl font-bold text-primary">₹{p.price}</p>
            <p className="text-[10px] text-muted-foreground">
              ₹{Math.round((p.price / p.months) * 100) / 100}/mo
            </p>
            <Button
              size="sm"
              variant={p.best ? 'default' : 'outline'}
              className={`mt-2 min-h-[36px] ${p.best ? 'btn-brand' : ''}`}
              onClick={() => onChoosePlan(p)}
            >
              Choose
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ============================================================
// Edit profile dialog
// ============================================================

function EditProfileDialog({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  profile: any
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [gender, setGender] = useState<string>('other')
  const [dob, setDob] = useState<Date | undefined>(undefined)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open && profile) {
      setName(profile.name || '')
      setUsername(profile.username || '')
      setBio(profile.bio || '')
      setGender(profile.gender || 'other')
      setDob(profile.dob ? new Date(profile.dob) : undefined)
      setAvatar(profile.avatar || null)
    }
  }, [open, profile])

  const handleAvatar = async (file: File) => {
    setUploading(true)
    try {
      const res: any = await apiUpload('/api/upload', file)
      setAvatar(res?.url || null)
      toast({ title: 'Avatar uploaded' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    if (!username.trim()) {
      toast({ title: 'Username is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body: any = {
        name: name.trim(),
        username: username.trim(),
        bio: bio,
        gender,
        avatar: avatar || '',
        dob: dob ? format(dob, 'yyyy-MM-dd') : '',
      }
      const res: any = await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast({ title: 'Profile updated!' })
      onSaved()
      onClose()
      void res
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70dvh]">
          <div className="space-y-4 pr-2">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/30">
                <AvatarImage src={avatar || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label
                  htmlFor="avatar-upload"
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm shadow-xs hover:bg-accent"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload avatar
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleAvatar(f)
                    e.target.value = ''
                  }}
                  disabled={uploading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG/PNG, max 5MB
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="ep-name">Name</Label>
              <Input
                id="ep-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 min-h-[44px]"
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="ep-username">Username</Label>
              <Input
                id="ep-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 min-h-[44px]"
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="ep-bio">Bio</Label>
              <Textarea
                id="ep-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1"
                maxLength={200}
                rows={3}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {bio.length}/200
              </p>
            </div>
            <div>
              <Label htmlFor="ep-gender">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="ep-gender" className="mt-1 min-h-[44px] w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-1 min-h-[44px] w-full justify-start text-left font-normal"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dob ? format(dob, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={setDob}
                    disabled={(d) => d > new Date() || d < new Date('1900-01-01')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="btn-brand min-h-[44px]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Buy plan dialog (QR + UPI + payment proof)
// ============================================================

function BuyPlanDialog({
  open,
  plan,
  onClose,
  onSubmitted,
}: {
  open: boolean
  plan: null | { id: string; label: string; price: number; months: number }
  onClose: () => void
  onSubmitted: () => void
}) {
  const { toast } = useToast()
  const [txnId, setTxnId] = useState('')
  const [utr, setUtr] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (open) {
      setTxnId('')
      setUtr('')
      setScreenshot(null)
      setNotes('')
    }
  }, [open])

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      toast({ title: 'UPI ID copied' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const handleScreenshot = async (file: File) => {
    setUploading(true)
    try {
      const res: any = await apiUpload('/api/upload', file)
      setScreenshot(res?.url || null)
      toast({ title: 'Screenshot uploaded' })
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!plan) return
    if (!txnId.trim()) {
      toast({ title: 'Transaction ID is required', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/payment/submit', {
        method: 'POST',
        body: JSON.stringify({
          plan: plan.id,
          amount: plan.price,
          transactionId: txnId.trim(),
          utrNumber: utr.trim() || undefined,
          screenshotUrl: screenshot || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      toast({
        title: 'Payment submitted for verification',
        description: 'Admin will approve within 24h. Thanks!',
      })
      onSubmitted()
    } catch (e: any) {
      const err = e as ApiError
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Buy Premium — {plan?.label} (₹{plan?.price})
          </DialogTitle>
          <DialogDescription>
            Scan the QR or pay to the UPI ID below, then submit your payment details.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70dvh]">
          <div className="space-y-4 pr-2">
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <img
                src={QR_SRC}
                alt="UPI QR Code"
                className="h-44 w-44 rounded-lg border bg-white p-2"
              />
              <div className="flex w-full items-center gap-2">
                <code className="flex-1 truncate rounded-md border bg-background px-3 py-2 text-sm font-mono">
                  {UPI_ID}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyUpi}
                  className="min-h-[40px]"
                >
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Payee: TalyChat · Amount: ₹{plan?.price}
              </p>
            </div>

            <div>
              <Label htmlFor="bp-txn">Transaction ID *</Label>
              <Input
                id="bp-txn"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                className="mt-1 min-h-[44px]"
                placeholder="UPI ref / bank txn id"
              />
            </div>
            <div>
              <Label htmlFor="bp-utr">UTR Number (optional)</Label>
              <Input
                id="bp-utr"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                className="mt-1 min-h-[44px]"
                placeholder="12-digit UTR (bank transfers)"
              />
            </div>
            <div>
              <Label>Payment Screenshot</Label>
              <Label
                htmlFor="bp-shot"
                className="mt-1 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm shadow-xs hover:bg-accent"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : screenshot ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-primary" /> Screenshot attached
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Upload screenshot
                  </>
                )}
              </Label>
              <input
                id="bp-shot"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleScreenshot(f)
                  e.target.value = ''
                }}
                disabled={uploading}
              />
              {screenshot && (
                <img
                  src={screenshot}
                  alt="Payment screenshot"
                  className="mt-2 max-h-32 rounded-md border"
                />
              )}
            </div>
            <div>
              <Label htmlFor="bp-notes">Notes (optional)</Label>
              <Textarea
                id="bp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Anything we should know?"
              />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="btn-brand min-h-[44px]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Submit for verification'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
