'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, apiUpload, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useSound } from '@/hooks/use-sound'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PremiumAvatar } from '@/components/premium-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
  ShieldAlert,
  LogOut,
  CheckCircle2,
  Star,
  CalendarDays,
  Upload,
  Sparkles,
  Clock,
  Ban,
  Lock,
  Eye,
  Megaphone,
  Award,
  Trophy,
  AlertTriangle,
  Target,
  Hourglass,
  UserCheck,
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
  // V2 task fields (optional so old shapes don't break TS)
  activeReferrals?: number
  taskTiers?: TaskTier[]
  currentTask?: ActiveTask | null
  completedTasks?: Array<{
    id: string
    tier: string
    requiredCount: number
    windowDays: number
    rewardMonths: number
    selectedAt: string
    completedAt: string | null
    expiresAt: string | null
  }>
}

interface TaskTier {
  tier: string
  requiredCount: number
  windowDays: number
  rewardMonths: number
}

interface ActiveTask {
  id: string
  tier: string
  requiredCount: number
  windowDays: number
  rewardMonths: number
  progress: number
  selectedAt: string
  expiresAt: string | null
  completedAt: string | null
  isActive: boolean
}

interface BehaviorData {
  score: number
  adsWatchedToday: number
  maxAdsPerDay: number
  canMessage: boolean
}

interface AdData {
  id: string
  brandName: string
  headline?: string | null
  description?: string | null
  imageUrl?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  placement?: string | null
  category?: string | null
}

export function ProfileScreen() {
  const { user, updateUser, logout, setAuth } = useAuth()
  const { toast } = useToast()
  const { play: soundManager } = useSound()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [buyPlan, setBuyPlan] = useState<null | { id: string; label: string; price: number; months: number }>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [referral, setReferral] = useState<ReferralData | null>(null)

  // V2 — admin login via Redeem section.
  // When the user types "admin.in" (case-insensitive) as the redeem code
  // and taps Redeem, we open an admin-login password dialog instead of
  // calling the normal /api/redeem endpoint. On success we setAuth() and
  // the app re-renders as the admin panel (see src/app/page.tsx).
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)

  // Block list state
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedCount, setBlockedCount] = useState<number>(0)

  // Behavior + watch-ad state
  const [behavior, setBehavior] = useState<BehaviorData | null>(null)
  const [watchingAd, setWatchingAd] = useState<AdData | null>(null)
  const [watching, setWatching] = useState(false)
  const [watchCountdown, setWatchCountdown] = useState(5)

  // Team sheet state
  const [teamSheetOpen, setTeamSheetOpen] = useState(false)

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

  // Fetch behavior summary (score, adsWatchedToday, maxAdsPerDay, canMessage)
  const loadBehavior = useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/behavior/me')
      const data = res?.behavior || res?.data || res
      setBehavior({
        score: typeof data?.score === 'number' ? data.score : 100,
        adsWatchedToday: data?.adsWatchedToday ?? 0,
        maxAdsPerDay: data?.maxAdsPerDay ?? 10,
        canMessage: Boolean(data?.canMessage),
      })
    } catch {
      // Defensive default — assume full score if route fails
      setBehavior({
        score: 100,
        adsWatchedToday: 0,
        maxAdsPerDay: 10,
        canMessage: true,
      })
    }
  }, [])

  // Watch an ad: POST /api/behavior/watch-ad, then open dialog for 5s.
  const handleWatchAd = useCallback(async () => {
    if (watching) return
    if (behavior && behavior.adsWatchedToday >= behavior.maxAdsPerDay) {
      toast({ title: 'Daily limit reached — come back tomorrow!' })
      return
    }
    setWatching(true)
    try {
      const res: any = await apiFetch('/api/behavior/watch-ad', { method: 'POST' })
      const data = res?.behavior || res?.data || res
      const ad: AdData | null = data?.ad ?? null
      // Update behavior immediately with new score/adsWatchedToday.
      setBehavior({
        score: typeof data?.score === 'number' ? data.score : (behavior?.score ?? 100),
        adsWatchedToday: data?.adsWatchedToday ?? (behavior?.adsWatchedToday ?? 0) + 1,
        maxAdsPerDay: data?.maxAdsPerDay ?? behavior?.maxAdsPerDay ?? 10,
        canMessage: Boolean(data?.canMessage ?? (behavior?.canMessage ?? true)),
      })
      if (ad) {
        setWatchingAd(ad)
        setWatchCountdown(5)
      } else {
        toast({ title: 'Behavior +1! No ad creative available right now.' })
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to watch ad', variant: 'destructive' })
    } finally {
      setWatching(false)
    }
  }, [behavior, watching, toast])

  // Select a referral task tier.
  const handleSelectTask = useCallback(
    async (tier: string) => {
      try {
        await apiFetch('/api/referral/task', {
          method: 'POST',
          body: JSON.stringify({ tier }),
        })
        toast({ title: 'Task selected! Get referring 🚀' })
        await loadReferral()
      } catch (e: any) {
        toast({ title: e?.message || 'Failed to select task', variant: 'destructive' })
      }
    },
    [loadReferral, toast],
  )

  // Claim the active referral task reward.
  const handleClaimTask = useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/referral/task/claim', { method: 'POST' })
      const data = res?.claim || res?.data || res
      const until = data?.premiumUntil
      toast({
        title: 'Premium granted! 🎉',
        description: until
          ? `Valid until ${format(new Date(until), 'dd MMM yyyy')}`
          : undefined,
      })
      await loadReferral()
      await loadProfile()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to claim reward', variant: 'destructive' })
    }
  }, [loadProfile, loadReferral, toast])


  // Fetch the blocked-users count (for the badge on Privacy section).
  const loadBlockedCount = useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/blocks')
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.blocks)
          ? res.blocks
          : Array.isArray(res?.items)
            ? res.items
            : []
      setBlockedCount(list.length)
    } catch {
      setBlockedCount(0)
    }
  }, [])

  useEffect(() => {
     
    loadProfile()
     
    loadReferral()
    loadBlockedCount()
    loadBehavior()
  }, [loadProfile, loadReferral, loadBlockedCount, loadBehavior])

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
    // V2 — admin.in special case: open the admin login dialog instead of
    // calling /api/redeem. The case-insensitive match mirrors the backend
    // /api/auth/login behavior (which lower-cases the email).
    if (redeemCode.trim().toLowerCase() === 'admin.in') {
      setAdminPassword('')
      setAdminLoginOpen(true)
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
      // Fanfare — fires inside the user's "Redeem" button click gesture.
      soundManager.playPremium()
      setRedeemCode('')
      loadProfile()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally {
      setRedeemLoading(false)
    }
  }

  // V2 — submit admin login (called from the Admin Login dialog).
  // On success, setAuth() with the returned user/token; the app will then
  // re-render as the admin panel.
  const submitAdminLogin = async () => {
    if (!adminPassword) {
      toast({ title: 'Enter the admin password', variant: 'destructive' })
      return
    }
    setAdminLoginLoading(true)
    try {
      const res: any = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin.in', password: adminPassword }),
      })
      const u = res?.user || (res?.id ? res : null)
      const t = res?.token
      if (!u || !t) {
        throw new Error('Invalid admin response')
      }
      setAuth(u, t)
      toast({
        title: 'Welcome, Admin!',
        description: 'Switching to the admin panel…',
      })
      setAdminLoginOpen(false)
      setAdminPassword('')
      setRedeemCode('')
    } catch (e: any) {
      toast({ title: e?.message || 'Admin login failed', variant: 'destructive' })
    } finally {
      setAdminLoginLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      {/* Profile header card — V3: taly-card with shadow, larger avatar, online dot, joined date */}
      <div className="taly-card taly-card-hover animate-fade-in-up p-5" style={{ animationDelay: '0ms' }}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <PremiumAvatar
              user={{
                isPremium: profile.isPremium,
                premiumTier: profile.premiumTier,
                avatar: profile.avatar || undefined,
                name: profile.name || 'U',
              }}
              size={80}
              showAura
              className="shrink-0"
            />
            {profile.isOnline && <span className="online-dot" aria-label="online" />}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="truncate text-xl font-bold tracking-tight">{profile.name}</h2>
              {premiumActive && (
                <span className="premium-badge">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground/80">@{profile.username}</p>
            {profile.bio ? (
              <p className="mt-2 line-clamp-3 text-sm italic text-muted-foreground">{profile.bio}</p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">No bio yet.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground/80 sm:justify-start">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    profile.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'
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
              <button
                onClick={() => setEditOpen(true)}
                className="action-btn min-h-[40px]"
              >
                <Pencil className="h-4 w-4" /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Behavior Bar — V3: section-header + behavior-bar pill with inner glow */}
      <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <BehaviorBar behavior={behavior} />
      </div>

      {/* Watch Behavior (watch ads to increase score) */}
      <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <WatchBehaviorCard
          behavior={behavior}
          watching={watching}
          onWatchAd={handleWatchAd}
        />
      </div>

      {/* Premium section */}
      <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
        <PremiumSection
          premiumActive={premiumActive}
          premiumUntil={profile.premiumUntil}
          onChoosePlan={(plan) => setBuyPlan(plan)}
        />
      </div>

      {/* Redeem code */}
      <div className="taly-card animate-fade-in-up p-5" style={{ animationDelay: '240ms' }}>
        <div className="section-header mb-3">
          <Gift className="h-4 w-4 text-primary" /> Redeem a Code
        </div>
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
          <button
            onClick={handleRedeem}
            disabled={redeemLoading}
            className="action-btn min-h-[44px] px-5 disabled:opacity-60"
          >
            {redeemLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Redeem'
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Get codes from promotions, friends, or the founder.
        </p>
      </div>

      {/* V2 — Admin Login dialog (opened when user types 'admin.in' as the
          redeem code). On success, setAuth() switches the app to the
          admin panel. */}
      <Dialog open={adminLoginOpen} onOpenChange={(o) => !adminLoginLoading && setAdminLoginOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Admin Login
            </DialogTitle>
            <DialogDescription>
              Enter the admin password to switch to the TalyChat admin panel.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
              Admin password
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              className="min-h-[44px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdminLogin()
              }}
            />
            <p className="text-xs text-muted-foreground">
              You entered <code className="font-mono font-semibold">admin.in</code> as the
              redeem code — this is the admin sign-in shortcut.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!adminLoginLoading) {
                  setAdminLoginOpen(false)
                  setAdminPassword('')
                }
              }}
              disabled={adminLoginLoading}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={submitAdminLogin}
              disabled={adminLoginLoading || !adminPassword}
              className="btn-brand min-h-[44px]"
            >
              {adminLoginLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              Sign in as Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Referral section — V2 redesign with task tiers */}
      <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
        <ReferralSection
          referral={referral}
          username={user?.username || profile.username}
          onCopyLink={copyReferralLink}
          onSelectTask={handleSelectTask}
          onClaimTask={handleClaimTask}
          onViewTeam={() => setTeamSheetOpen(true)}
        />
      </div>

      {/* Privacy and Safety */}
      <div className="taly-card animate-fade-in-up p-5" style={{ animationDelay: '360ms' }}>
        <div className="section-header mb-3">
          <Shield className="h-4 w-4 text-primary" /> Privacy and Safety
          {blockedCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              <Ban className="h-3 w-3" />
              {blockedCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="ghost-btn min-h-[44px] w-full justify-start"
        >
          <Shield className="mr-2 h-4 w-4" /> Open privacy settings
        </button>
        <Separator className="my-3" />
        <button
          onClick={() => setBlockedOpen(true)}
          className="ghost-btn min-h-[44px] w-full justify-start"
        >
          <Ban className="mr-2 h-4 w-4" /> Block List
          {blockedCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
              {blockedCount}
            </span>
          )}
        </button>
        <Separator className="my-3" />
        <button
          onClick={() => {
            logout()
            toast({ title: 'Logged out' })
          }}
          className="ghost-btn min-h-[44px] w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </button>
      </div>

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

      {/* Block list dialog */}
      <BlockListDialog
        open={blockedOpen}
        onOpenChange={setBlockedOpen}
        onUnblocked={() => loadBlockedCount()}
      />

      {/* View Team sheet (full-screen on mobile, slides up from bottom) */}
      <ViewTeamSheet
        open={teamSheetOpen}
        onOpenChange={setTeamSheetOpen}
        referral={referral}
      />

      {/* Ad Watch dialog (auto-closes after 5s) */}
      <AdWatchDialog
        ad={watchingAd}
        countdown={watchCountdown}
        onCountdownChange={setWatchCountdown}
        onClose={() => setWatchingAd(null)}
      />
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
      <div className="taly-card taly-card-hover animate-fade-in-up p-5">
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
            <p className="text-sm text-muted-foreground/80">
              {premiumUntil
                ? `Valid until ${format(new Date(premiumUntil), 'dd MMM yyyy')}`
                : 'Lifetime'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const plans = [
    { id: '2mo', label: '2 Months', price: 49, months: 2, best: false },
    { id: '6mo', label: '6 Months', price: 99, months: 6, best: false },
    { id: '1yr', label: '1 Year', price: offerPrice, months: 12, best: true },
  ]

  return (
    <div className="taly-card animate-fade-in-up p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="section-header">
          <Sparkles className="h-4 w-4 text-primary" /> Upgrade to Premium
        </div>
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
        <p className="mb-3 text-xs text-muted-foreground/80">
          Offer ended — 1-year plan is back to ₹{REGULAR_PRICE}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`taly-card taly-card-hover relative flex flex-col gap-1 overflow-hidden p-4 ${
              p.best
                ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20'
                : ''
            }`}
          >
            {/* Best value ribbon + shimmer overlay */}
            {p.best && (
              <>
                <div className="premium-shimmer pointer-events-none absolute inset-0 opacity-60" />
                <span className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  Best Value
                </span>
              </>
            )}
            <p className="text-xs font-medium text-muted-foreground/80">{p.label}</p>
            <p className={`text-2xl font-bold ${p.best ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>₹{p.price}</p>
            <p className="text-[10px] text-muted-foreground/80">
              ₹{Math.round((p.price / p.months) * 100) / 100}/mo
            </p>
            <button
              onClick={() => onChoosePlan(p)}
              className={`mt-2 min-h-[36px] text-sm font-semibold ${
                p.best
                  ? 'action-btn relative overflow-hidden'
                  : 'ghost-btn'
              }`}
            >
              {p.best && (
                <span className="premium-shimmer pointer-events-none absolute inset-0 opacity-40" />
              )}
              <span className="relative">Choose</span>
            </button>
          </div>
        ))}
      </div>
    </div>
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

// ============================================================
// Block list dialog — shows blocked users with Unblock buttons
// ============================================================

interface BlockedUser {
  id: string
  name?: string
  username?: string
  avatar?: string | null
  isOnline?: boolean
  isPremium?: boolean
  blockedAt?: string
}

function BlockListDialog({
  open,
  onOpenChange,
  onUnblocked,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnblocked?: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState<BlockedUser[]>([])
  const [unblocking, setUnblocking] = useState<string | null>(null)

  const loadBlocked = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/blocks')
      const list: BlockedUser[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.blocks)
          ? res.blocks
          : Array.isArray(res?.items)
            ? res.items
            : []
      setBlocked(list)
    } catch {
      setBlocked([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadBlocked()
  }, [open, loadBlocked])

  const handleUnblock = async (u: BlockedUser) => {
    setUnblocking(u.id)
    try {
      await apiFetch('/api/blocks', {
        method: 'DELETE',
        body: JSON.stringify({ blockedId: u.id }),
      })
      setBlocked((prev) => prev.filter((b) => b.id !== u.id))
      toast({ title: `Unblocked ${u.name || u.username || 'user'}` })
      onUnblocked?.()
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to unblock', variant: 'destructive' })
    } finally {
      setUnblocking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block List</DialogTitle>
          <DialogDescription>
            Users you&apos;ve blocked can&apos;t message you, find you in search,
            or see your profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground/80">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : blocked.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground/80">
            You haven&apos;t blocked anyone.
          </div>
        ) : (
          <ScrollArea className="max-h-[60dvh]">
            <ul className="space-y-2 pr-2">
              {blocked.map((u) => (
                <li
                  key={u.id}
                  className="chat-list-item border border-border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    {u.avatar && <AvatarImage src={u.avatar} alt={u.name || u.username || ''} />}
                    <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                      {(u.name || u.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name || u.username || 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground/80">
                      @{u.username || 'user'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnblock(u)}
                    disabled={unblocking === u.id}
                    className="ghost-btn min-h-[36px] px-3 disabled:opacity-60"
                  >
                    {unblocking === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Unblock'
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// V2: Behavior Bar — gradient red→orange→green based on score %
// ============================================================

function BehaviorBar({ behavior }: { behavior: BehaviorData | null }) {
  // Defensive: if behavior not yet loaded, render an optimistic default.
  const score = behavior?.score ?? 100
  const adsWatchedToday = behavior?.adsWatchedToday ?? 0
  const maxAdsPerDay = behavior?.maxAdsPerDay ?? 10
  const canMessage = behavior?.canMessage ?? true

  // V3 — semantic thresholds: green≥80, amber≥50, red<50
  const colorClass =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
  const label =
    score >= 80
      ? 'Excellent'
      : score >= 50
        ? 'Fair'
        : 'Low'

  return (
    <div className="taly-card animate-fade-in-up p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="section-header">
          <Target className="h-4 w-4 text-primary" /> Behavior
        </div>
        <Badge
          variant={canMessage ? 'default' : 'destructive'}
          className={`${
            canMessage
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
              : 'bg-red-500/10 text-red-600 border-red-500/30'
          } border`}
        >
          {canMessage ? 'Can message' : 'Blocked'}
        </Badge>
      </div>

      {/* Big score number + descriptive label + ads watched */}
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>{score}%</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${colorClass}`}>
            {label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/80">
          Ads watched today: {adsWatchedToday}/{maxAdsPerDay}
        </span>
      </div>

      {/* V3 — behavior-bar pill with inner glow + gradient fill */}
      <div className="behavior-bar">
        <div
          className="behavior-bar-fill"
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>

      {/* Warning if score < 50 */}
      {score < 50 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Your behavior is too low to send messages. Watch ads to increase.
          </span>
        </p>
      )}
    </div>
  )
}

// ============================================================
// V2: Watch Behavior card — watch ads to increase score (max 10/day)
// ============================================================

function WatchBehaviorCard({
  behavior,
  watching,
  onWatchAd,
}: {
  behavior: BehaviorData | null
  watching: boolean
  onWatchAd: () => void
}) {
  const adsWatchedToday = behavior?.adsWatchedToday ?? 0
  const maxAdsPerDay = behavior?.maxAdsPerDay ?? 10
  const reachedMax = adsWatchedToday >= maxAdsPerDay

  return (
    <div className="taly-card animate-fade-in-up p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="section-header !text-base">
            Watch Behavior
          </div>
          <p className="text-sm text-muted-foreground/80">
            Watch ads to increase your behavior score. Max {maxAdsPerDay} per day.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">
            Today: <span className="text-primary">{adsWatchedToday}/{maxAdsPerDay}</span>{' '}
            ads watched
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            {reachedMax
              ? 'Daily limit reached — come back tomorrow.'
              : `${maxAdsPerDay - adsWatchedToday} ad${maxAdsPerDay - adsWatchedToday === 1 ? '' : 's'} left today.`}
          </p>
        </div>
        <button
          onClick={onWatchAd}
          disabled={watching || reachedMax}
          className="action-btn min-h-[40px] disabled:opacity-60"
        >
          {watching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : reachedMax ? (
            <>
              <Clock className="mr-1 h-4 w-4" /> Come back tomorrow
            </>
          ) : (
            <>
              <Eye className="mr-1 h-4 w-4" /> Watch Ad
            </>
          )}
        </button>
      </div>

      {/* V3 — behavior-bar style progress for today's ads */}
      <div className="behavior-bar mt-3">
        <div
          className="behavior-bar-fill"
          style={{
            width: `${Math.min((adsWatchedToday / maxAdsPerDay) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  )
}

// ============================================================
// V2: Ad Watch dialog — shows ad for 5s with countdown
// ============================================================

function AdWatchDialog({
  ad,
  countdown,
  onCountdownChange,
  onClose,
}: {
  ad: AdData | null
  countdown: number
  onCountdownChange: (n: number) => void
  onClose: () => void
}) {
  // Countdown timer — ticks every second; closes when hits 0.
  useEffect(() => {
    if (!ad) return
    if (countdown <= 0) {
      onClose()
      return
    }
    const t = setTimeout(() => onCountdownChange(countdown - 1), 1000)
    return () => clearTimeout(t)
  }, [ad, countdown, onClose, onCountdownChange])

  if (!ad) return null

  return (
    <Dialog
      open={!!ad}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Megaphone className="h-4 w-4 text-primary" /> Advertisement
            </span>
            <Badge variant="outline" className="bg-muted/40">
              {countdown}s
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Watch this ad to earn +1 behavior. Auto-closes in {countdown} second
            {countdown === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {ad.imageUrl ? (
            <img
              src={ad.imageUrl}
              alt={ad.brandName || 'Ad'}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              <Megaphone className="h-12 w-12" />
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-bold">{ad.brandName}</p>
            {ad.headline && (
              <p className="mt-1 text-sm font-medium">{ad.headline}</p>
            )}
            {ad.description && (
              <p className="mt-1 text-xs text-muted-foreground">{ad.description}</p>
            )}
            {ad.ctaText && ad.ctaUrl && (
              <a
                href={ad.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                {ad.ctaText}
              </a>
            )}
          </div>
        </div>

        {/* Countdown progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 5) * 100}%` }}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={countdown > 0}
            className="min-h-[40px]"
          >
            {countdown > 0 ? `Skip in ${countdown}s` : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// V2: Redesigned Referral Section — task tier cards, active task,
// referral code, recent referrals, View Team button
// ============================================================

function ReferralSection({
  referral,
  username,
  onCopyLink,
  onSelectTask,
  onClaimTask,
  onViewTeam,
}: {
  referral: ReferralData | null
  username: string
  onCopyLink: () => void
  onSelectTask: (tier: string) => void
  onClaimTask: () => void
  onViewTeam: () => void
}) {
  const tiers: TaskTier[] =
    referral?.taskTiers && referral.taskTiers.length > 0
      ? referral.taskTiers
      : [
          { tier: '8members7d', requiredCount: 8, windowDays: 7, rewardMonths: 2 },
          { tier: '18members15d', requiredCount: 18, windowDays: 15, rewardMonths: 6 },
          { tier: '25members30d', requiredCount: 25, windowDays: 30, rewardMonths: 12 },
        ]

  const activeTask = referral?.currentTask ?? null
  const hasActiveTask = !!activeTask

  return (
    <div className="taly-card animate-fade-in-up p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="section-header">
          <Users className="h-4 w-4 text-primary" /> Refer & Earn
        </div>
        <button
          onClick={onViewTeam}
          className="ghost-btn min-h-[36px]"
        >
          <Users className="mr-1 h-3.5 w-3.5" /> View Team
        </button>
      </div>

      <p className="mt-1 text-sm text-muted-foreground/80">
        Pick a referral task, invite friends, claim premium rewards!
      </p>

      {/* Active task card (if any) */}
      {hasActiveTask && activeTask && (
        <ActiveTaskCard task={activeTask} onClaim={onClaimTask} />
      )}

      {/* Task tier selection — disabled while an active task is in progress */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
          {hasActiveTask ? 'Available tasks (locked)' : 'Choose a task'}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <TaskTierCard
              key={t.tier}
              tier={t}
              disabled={hasActiveTask}
              selected={activeTask?.tier === t.tier}
              onSelect={onSelectTask}
            />
          ))}
        </div>
      </div>

      {/* Referral code + copy link */}
      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground/80">Your referral code</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-border bg-background px-3 py-2 text-sm font-mono">
            {username}
          </code>
          <button
            onClick={onCopyLink}
            className="action-btn min-h-[40px]"
          >
            <Copy className="mr-1 h-4 w-4" /> Copy link
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Share your link: {typeof window !== 'undefined' ? window.location.origin : 'talychat.app'}/?ref={username}
        </p>
      </div>

      {/* Recent referrals */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
          Recent referrals
        </p>
        {!referral ? (
          <p className="text-sm text-muted-foreground/80">Loading referral data…</p>
        ) : referral.recent.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/10 p-3 text-center text-sm text-muted-foreground/80">
            No referrals yet. Share your link to start earning!
          </p>
        ) : (
          <ScrollArea className="max-h-48">
            <ul className="space-y-2 pr-2">
              {referral.recent.map((r) => (
                <li
                  key={r.id}
                  className="chat-list-item border border-border bg-card"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={r.referred?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {r.referred?.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.referred?.name || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground/80">
                      @{r.referred?.username}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.status === 'active'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                    }
                  >
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Task tier card — Select button + reward display
// ============================================================

function TaskTierCard({
  tier,
  disabled,
  selected,
  onSelect,
}: {
  tier: TaskTier
  disabled: boolean
  selected: boolean
  onSelect: (tier: string) => void
}) {
  return (
    <div
      className={`taly-card taly-card-hover relative flex flex-col gap-1.5 p-4 transition-all ${
        selected
          ? 'ring-2 ring-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20'
          : disabled
            ? 'opacity-60'
            : ''
      }`}
    >
      {/* Selected checkmark badge top-right */}
      {selected && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Tier label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/80">
          Tier {tier.rewardMonths <= 2 ? '1' : tier.rewardMonths <= 6 ? '2' : '3'}
        </span>
      </div>

      {/* Required count */}
      <p className="flex items-center gap-1 text-sm font-bold">
        <Target className="h-3.5 w-3.5 text-primary" />
        {tier.requiredCount} members
      </p>
      <p className="flex items-center gap-1 text-xs text-muted-foreground/80">
        <Hourglass className="h-3 w-3" />
        in {tier.windowDays} days
      </p>

      {/* Reward */}
      <div className="mt-1 flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
        <Trophy className="h-3 w-3" />
        {tier.rewardMonths} months premium
      </div>

      <button
        disabled={disabled}
        onClick={() => onSelect(tier.tier)}
        className={`mt-2 min-h-[36px] text-sm font-semibold disabled:opacity-60 ${
          selected
            ? 'ghost-btn'
            : 'action-btn'
        }`}
      >
        {selected ? 'Selected ✓' : 'Select'}
      </button>
    </div>
  )
}

// ============================================================
// Active task card — progress bar + expiry countdown + claim button
// ============================================================

function ActiveTaskCard({
  task,
  onClaim,
}: {
  task: ActiveTask
  onClaim: () => void
}) {
  const progress = Math.min(task.progress, task.requiredCount)
  const pct = (progress / task.requiredCount) * 100
  const completed = progress >= task.requiredCount

  // Compute days remaining until expiry
  const daysLeft = task.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(task.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        ),
      )
    : 0

  return (
    <div className="mt-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Target className="h-3 w-3" /> Current Task
          </p>
          <p className="mt-1 text-sm font-semibold">
            Add {task.requiredCount} members in {task.windowDays} days
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-600"
        >
          <Hourglass className="mr-1 h-3 w-3" />
          {daysLeft}d left
        </Badge>
      </div>

      {/* Progress — V3 behavior-bar style */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Progress: {progress}/{task.requiredCount} members
          </span>
          <span className="text-muted-foreground/80">{Math.round(pct)}%</span>
        </div>
        <div className="behavior-bar">
          <div
            className="behavior-bar-fill"
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
      </div>

      {/* Reward */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
          <Trophy className="h-3 w-3 text-amber-500" />
          Reward: {task.rewardMonths} months premium
        </span>
        <button
          disabled={!completed}
          onClick={onClaim}
          className={`min-h-[36px] text-sm font-semibold disabled:opacity-60 ${
            completed ? 'action-btn' : 'ghost-btn'
          }`}
        >
          {completed ? (
            <>
              <Trophy className="mr-1 h-3.5 w-3.5" /> Claim Reward
            </>
          ) : (
            'Claim Reward'
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// V2: View Team Sheet — full screen on mobile, slides from bottom
// Shows total team size, active members, list of referred users
// ============================================================

function ViewTeamSheet({
  open,
  onOpenChange,
  referral,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  referral: ReferralData | null
}) {
  const referrals = referral?.recent || []
  const totalCount = referral?.count ?? referrals.length
  const activeCount = referrals.filter((r) => r.status === 'active').length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl sm:rounded-t-2xl"
      >
        <SheetHeader className="border-b p-4 pb-3">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" /> My Team
          </SheetTitle>
          <SheetDescription>
            Everyone you&apos;ve referred to TalyChat.
          </SheetDescription>
        </SheetHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-2 p-4 pb-2">
          <div className="taly-card p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalCount}</p>
            <p className="text-xs text-muted-foreground/80">Total referrals</p>
          </div>
          <div className="taly-card p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
            <p className="text-xs text-muted-foreground/80">Active members</p>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground/80">
              <Users className="mx-auto mb-2 h-10 w-10 opacity-40" />
              No team members yet. Share your referral link to start building your team!
            </div>
          ) : (
            <ul className="space-y-2">
              {referrals.map((r) => (
                <li
                  key={r.id}
                  className="chat-list-item border border-border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.referred?.avatar || undefined} />
                    <AvatarFallback className="bg-primary/15 text-primary">
                      {r.referred?.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.referred?.name || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground/80">
                      @{r.referred?.username}
                    </p>
                    {r.createdAt && (
                      <p className="text-[10px] text-muted-foreground/80">
                        Joined {format(new Date(r.createdAt), 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                  {r.status === 'active' ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                    >
                      <UserCheck className="mr-1 h-3 w-3" /> Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-muted-foreground/20 bg-muted/30 text-muted-foreground"
                    >
                      Inactive
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
