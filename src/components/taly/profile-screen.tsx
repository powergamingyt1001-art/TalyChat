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
  Edit,
  Trash2,
  TrendingUp,
  Zap,
  Info,
  Github,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { SettingsDialog } from '@/components/taly/settings-dialog'
// R1-3 — HighlightsRow, CreateHighlightDialog, StoryViewerDialog imports
// kept for backward-compat / future re-enablement, but no longer rendered
// in the Profile screen. Stories + Highlights feature parked under
// "Coming Soon".
import { HighlightsRow, type Highlight } from '@/components/taly/highlights-row'
import { CreateHighlightDialog } from '@/components/taly/create-highlight-dialog'
import { StoryViewerDialog } from '@/components/taly/story-viewer-dialog'

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

  // V6 — Scheduled messages state (kept for backward-compat; UI
  // section removed per R1-3 — Scheduled Messages feature parked under
  // "Coming Soon").
  const [scheduledOpen, setScheduledOpen] = useState(false)
  const [scheduledCount, setScheduledCount] = useState<number>(0)

  // V7 — Story highlights state (kept for backward-compat; UI row removed
  // per R1-3 — Story Highlights feature parked under "Coming Soon").
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [createHighlightOpen, setCreateHighlightOpen] = useState(false)
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null)

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

  // V6 — Fetch pending scheduled messages count (for the badge on the
  // Scheduled Messages card).
  const loadScheduledCount = useCallback(async () => {
    try {
      const res: any = await apiFetch('/api/messages/schedule')
      const list: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.scheduledMessages)
          ? res.scheduledMessages
          : Array.isArray(res?.items)
            ? res.items
            : []
      setScheduledCount(list.length)
    } catch {
      setScheduledCount(0)
    }
  }, [])

  // V7 — Fetch my story highlights (with story contents).
  const loadHighlights = useCallback(async () => {
    setHighlightsLoading(true)
    try {
      const res: any = await apiFetch('/api/highlights/me')
      const list: Highlight[] = Array.isArray(res?.highlights)
        ? res.highlights
        : []
      setHighlights(list)
    } catch {
      setHighlights([])
    } finally {
      setHighlightsLoading(false)
    }
  }, [])

  useEffect(() => {
     
    loadProfile()
     
    loadReferral()
    loadBlockedCount()
    loadBehavior()
    loadScheduledCount()
    loadHighlights()
  }, [loadProfile, loadReferral, loadBlockedCount, loadBehavior, loadScheduledCount, loadHighlights])

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

  // V5 — behavior score for the ring around the avatar
  const behaviorScore = behavior?.score ?? 100
  const behaviorRingClass =
    behaviorScore >= 80
      ? 'ring-emerald-500/60'
      : behaviorScore >= 50
        ? 'ring-amber-500/60'
        : 'ring-red-500/60'

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-x-hidden px-3 pb-20 pt-4">
      {/* V12 — Group 1: Identity & Status.
          Wraps the profile header, story highlights, behavior bar, and
          watch-behavior card into a single tinted container so the user
          can scan their identity + behavior stats as one block. */}
      <section className="space-y-3 rounded-2xl bg-muted/20 p-3">
        <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <UserCheck className="h-3.5 w-3.5" /> Your Profile
        </p>
      {/* Profile header card — V3: taly-card with shadow, larger avatar, online dot, joined date */}
      <div className="taly-card taly-card-hover w-full max-w-full animate-fade-in-up overflow-hidden p-4" style={{ animationDelay: '0ms' }}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            {/* V5 — behavior ring (static emerald/amber/red) around the
                avatar. R8-11: removed the `animate-pulse` utility because
                it dimmed the entire PremiumAvatar subtree (including the
                gold ring / aura / crown), making the premium effects
                hard to see. The ring stays visible at full opacity.
                V13 — `dark-avatar-glow` adds an emerald + cream glow
                around the avatar in dark theme so it stays visible. */}
            <div
              className={`relative inline-flex rounded-full ring-4 ${behaviorRingClass} dark-avatar-glow`}
            >
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
            </div>
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

      {/* V7 — Story Highlights row (own profile) — REMOVED per R1-3.
          Story Highlights feature parked under "Coming Soon" in the
          About section at the bottom of this screen. */}
      {/* <div className="animate-fade-in-up" style={{ animationDelay: '30ms' }}>
        <HighlightsRow
          highlights={highlights}
          loading={highlightsLoading}
          isOwn
          onOpenHighlight={(h) => setActiveHighlight(h)}
          onCreateHighlight={() => setCreateHighlightOpen(true)}
          onHighlightsChanged={loadHighlights}
          onViewAll={() =>
            toast({
              title: 'Scroll horizontally',
              description: 'Swipe the highlights row to see all of them.',
            })
          }
        />
      </div> */}

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
      </section>

      {/* V12 — Group 2: Growth & Rewards.
          Premium card (or upgrade plans), redeem code, and referral
          section — all the monetization / growth touchpoints grouped
          under a subtle emerald/gold tint. */}
      <section className="space-y-3 rounded-2xl bg-emerald-50/30 p-3 dark:bg-emerald-950/10">
        <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-300/70">
          <TrendingUp className="h-3.5 w-3.5" /> Growth Center
        </p>

      {/* Premium section */}
      <div className="animate-fade-in-up" style={{ animationDelay: '180ms' }}>
        <PremiumSection
          premiumActive={premiumActive}
          premiumUntil={profile.premiumUntil}
          onChoosePlan={(plan) => {
            // V12 — Intercept "manage" / "benefits" pseudo-plans from the
            // redesigned premium-active card so we don't open the buy
            // dialog (which expects a real plan with a price). These
            // buttons are informational for now.
            if (plan.id === 'manage') {
              toast({
                title: 'Manage subscription',
                description:
                  'Subscription management is coming soon. For now, contact support.',
              })
              return
            }
            if (plan.id === 'benefits') {
              toast({
                title: 'Premium benefits ✨',
                description:
                  'Ad-free messaging, premium avatar aura, exclusive badges, larger uploads, and more.',
              })
              return
            }
            setBuyPlan(plan)
          }}
        />
      </div>

      {/* Redeem code */}
      <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4" style={{ animationDelay: '240ms' }}>
        <div className="section-header mb-3">
          <Gift className="h-4 w-4 text-primary" /> Redeem a Code
        </div>
        <div className="flex gap-2">
          <Input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="Enter redeem code (e.g., TALY-XXXXXXXX)"
            className="min-h-[44px] min-w-0 flex-1 uppercase"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRedeem()
            }}
          />
          <button
            onClick={handleRedeem}
            disabled={redeemLoading}
            className="action-btn min-h-[44px] shrink-0 px-5 disabled:opacity-60"
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
      </section>

      {/* V12 — Group 3: Settings & Safety.
          Privacy, scheduled messages, block list, and logout — the
          lower-stakes / account-management block grouped under a
          neutral tint. */}
      <section className="space-y-2 rounded-2xl bg-muted/10 p-3">
        <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          <Shield className="h-3.5 w-3.5" /> Settings &amp; Safety
        </p>

      {/* Privacy and Safety */}
      <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4" style={{ animationDelay: '360ms' }}>
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
      </div>

      {/* V6 — Scheduled Messages card. REMOVED per R1-3 — Scheduled
          Messages feature parked under "Coming Soon" in the About
          section at the bottom of this screen. The ScheduledMessagesCard
          function is kept for future re-enablement. */}
      {/* <div className="taly-card animate-fade-in-up p-5" style={{ animationDelay: '390ms' }}>
        <ScheduledMessagesCard
          open={scheduledOpen}
          onOpenChange={setScheduledOpen}
          count={scheduledCount}
          onCountChange={setScheduledCount}
        />
      </div> */}

      {/* V5 — Account container: red-tinted bg, holds Block List + Logout */}
      <div
        className="w-full max-w-full animate-fade-in-up overflow-hidden rounded-xl border border-red-500/20 bg-red-50/50 p-4 dark:bg-red-950/10"
        style={{ animationDelay: '420ms' }}
      >
        <div className="section-header mb-3 text-red-600 dark:text-red-400">
          <ShieldAlert className="h-4 w-4" /> Account
        </div>
        <button
          onClick={() => setBlockedOpen(true)}
          className="ghost-btn min-h-[44px] w-full justify-start !border-red-500/20 hover:!bg-red-500/10"
        >
          <Ban className="mr-2 h-4 w-4" /> Block List
          {blockedCount > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
              {blockedCount}
            </span>
          )}
        </button>
        <Separator className="my-3 bg-red-500/10" />
        {/* V5 — Logout as text-only link style (low contrast to prevent accidental taps) */}
        <button
          onClick={() => {
            logout()
            toast({ title: 'Logged out' })
          }}
          className="mx-auto block min-h-[44px] w-full text-center text-xs font-medium text-muted-foreground/70 transition-colors hover:text-destructive"
        >
          Logout
        </button>
      </div>
      </section>

      {/* R1-3 — About / Coming Soon section.
          New bottom-of-profile card with a 2-tab toggle (About | Coming
          Soon). About shows app info; Coming Soon lists the V2 features
          that have been parked for a later release. */}
      <AboutComingSoonSection />

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

      {/* V7 — Create-highlight dialog (picks from archive of own stories) */}
      <CreateHighlightDialog
        open={createHighlightOpen}
        onClose={() => setCreateHighlightOpen(false)}
        onCreated={() => loadHighlights()}
      />

      {/* V7 — Highlight viewer (StoryViewerDialog in highlight mode) */}
      <StoryViewerDialog
        open={!!activeHighlight}
        onClose={() => setActiveHighlight(null)}
        userId={user?.id || ''}
        allStories={[]}
        mode="highlight"
        highlightTitle={activeHighlight?.title}
        highlightCoverColor={activeHighlight?.coverColor}
        highlightStories={activeHighlight?.stories}
        onHighlightsChanged={loadHighlights}
      />

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
    // V12 — Redesigned premium active card: gradient bg + crown watermark,
    // pulsing green dot, big "Premium Active" text, days remaining
    // countdown, Manage + View Benefits buttons, expiry as small subtext.
    const untilDate = premiumUntil ? new Date(premiumUntil) : null
    const daysRemaining = untilDate
      ? Math.max(
          0,
          Math.ceil((untilDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        )
      : null

    return (
      <div className="taly-card taly-card-hover relative w-full max-w-full animate-fade-in-up overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 dark:from-amber-950/20 dark:to-yellow-950/10">
        {/* V12 — Faint crown watermark in the background */}
        <Crown
          className="pointer-events-none absolute -right-3 -top-3 h-28 w-28 text-amber-500/10"
          aria-hidden
        />

        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-md shadow-amber-500/30">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            {/* V12 — Big "Premium Active" text with pulsing green dot */}
            <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-amber-900 dark:text-amber-200">
              <Crown className="h-4 w-4 text-amber-500" />
              Premium Active
              {/* Pulsing green dot — indicates active status */}
              <span className="relative inline-flex h-2.5 w-2.5" aria-label="active">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            </p>

            {/* V12 — Days remaining countdown (big + amber) */}
            {daysRemaining !== null ? (
              <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
              </p>
            ) : (
              <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                Lifetime access
              </p>
            )}

            {/* V12 — Expiry date as small subtext */}
            {untilDate && (
              <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-300/60">
                Expires on {format(untilDate, 'dd MMM yyyy')}
              </p>
            )}
          </div>
        </div>

        {/* V12 — Action buttons: Manage Subscription (ghost) + View Benefits (secondary) */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChoosePlan({ id: 'manage', label: 'Manage', price: 0, months: 0 })}
            className="ghost-btn min-h-[40px] !border-amber-500/30 !text-amber-700 dark:!text-amber-300 hover:!bg-amber-500/10"
          >
            Manage Subscription
          </button>
          <button
            type="button"
            onClick={() => onChoosePlan({ id: 'benefits', label: 'Benefits', price: 0, months: 0 })}
            className="ghost-btn min-h-[40px]"
          >
            View Benefits
          </button>
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
    <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="section-header min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" /> Upgrade to Premium
        </div>
        {offerMsLeft && offerMsLeft > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
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
      <div className="grid gap-2 sm:grid-cols-3 sm:items-stretch">
        {plans.map((p) => {
          // V8 — Best Value elevation: scale-105, emerald bg tint, larger
          // BEST VALUE badge with crown icon, larger pulsing Choose button.
          // Other plans: slightly smaller, more muted, ghost button.
          const isBest = p.best
          return (
            <div
              key={p.id}
              className={`taly-card relative flex min-w-0 flex-col gap-1 overflow-hidden p-3 transition-all ${
                isBest
                  ? 'taly-card-hover scale-[1.02] border-2 border-emerald-500/50 bg-emerald-50/70 shadow-xl shadow-emerald-500/20 dark:bg-emerald-950/30'
                  : 'taly-card-hover opacity-95 border-border bg-card'
              }`}
            >
              {/* Best value ribbon + shimmer overlay (larger + crown icon) */}
              {isBest && (
                <>
                  <div className="premium-shimmer pointer-events-none absolute inset-0 opacity-60" />
                  <span className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-bl-xl bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    <Crown className="h-3.5 w-3.5" /> Best Value
                  </span>
                </>
              )}
              <p
                className={`text-xs font-medium ${
                  isBest ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground/70'
                }`}
              >
                {p.label}
              </p>
              <p
                className={`text-2xl font-bold ${
                  isBest ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'
                }`}
              >
                ₹{p.price}
              </p>
              <p className="text-[10px] text-muted-foreground/80">
                ₹{Math.round((p.price / p.months) * 100) / 100}/mo
              </p>
              <button
                onClick={() => onChoosePlan(p)}
                className={`mt-2 text-sm font-semibold ${
                  isBest
                    ? 'action-btn relative min-h-[48px] overflow-hidden animate-pulse text-base'
                    : 'ghost-btn min-h-[40px] opacity-90'
                }`}
                style={isBest ? { animationDuration: '2s' } : undefined}
              >
                {isBest && (
                  <span className="premium-shimmer pointer-events-none absolute inset-0 opacity-40" />
                )}
                <span className="relative flex items-center gap-1">
                  {isBest && <Crown className="h-4 w-4" />} Choose
                </span>
              </button>
            </div>
          )
        })}
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

  // V8 — semantic thresholds: green≥80, amber≥50, red<50
  const colorClass =
    score >= 80
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
  // V8 — clearer status labels (Excellent / Good / Needs improvement)
  const statusLabel =
    score >= 80 ? 'Excellent' : score >= 50 ? 'Good' : 'Needs improvement'
  // V8 — status badge color matches score color
  const statusBadgeClass =
    score >= 80
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
      : score >= 50
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400'
        : 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400'

  // V8 — calculate ads-to-next-level for the tooltip. Each ad = +1 score
  // point (clamped at 100). Thresholds: 50 (Good), 80 (Excellent).
  const nextThreshold = score < 50 ? 50 : score < 80 ? 80 : 100
  const nextLabel = score < 50 ? "'Good'" : score < 80 ? "'Excellent'" : '100%'
  const adsToNext = Math.max(0, nextThreshold - score)

  // V8 — segmented bar: 5 blocks (20% each). The block at the user's CURRENT
  // score segment pulses to indicate active progress.
  const blocks = [
    { color: 'bg-red-500', filled: score >= 20, threshold: 20 },
    { color: 'bg-orange-500', filled: score >= 40, threshold: 40 },
    { color: 'bg-amber-400', filled: score >= 60, threshold: 60 },
    { color: 'bg-lime-400', filled: score >= 80, threshold: 80 },
    { color: 'bg-emerald-500', filled: score >= 100, threshold: 100 },
  ]
  // The "current" block is the segment whose threshold range contains the
  // user's current score (e.g. score 70 → block 3 [60, 80); score 100 → block 4).
  // It pulses to highlight where the user is on the ladder right now.
  const currentIdx = Math.min(4, Math.max(0, Math.floor(score / 20)))

  return (
    <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="section-header min-w-0">
          <Target className="h-4 w-4 shrink-0 text-primary" /> Behavior
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {/* V8 — status label badge */}
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass}`}
            title={`Status: ${statusLabel}`}
          >
            <TrendingUp className="h-3 w-3" />
            {statusLabel}
          </span>
          <Badge
            variant={canMessage ? 'default' : 'destructive'}
            className={`shrink-0 ${
              canMessage
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-red-500/10 text-red-600 border-red-500/30'
            } border`}
          >
            {canMessage ? 'Can message' : 'Blocked'}
          </Badge>
        </div>
      </div>

      {/* Big score number + descriptive label + ads watched */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>{score}%</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${colorClass}`}>
            {statusLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground/80">
          Ads watched today: {adsWatchedToday}/{maxAdsPerDay}
        </span>
      </div>

      {/* V8 — gamified behavior bar: 5 segmented blocks (20% each) with
          red → orange → amber → light-green → green color ramp.
          Filled blocks are tinted, empty blocks are muted. The block at
          the user's CURRENT progress position pulses to indicate where
          they are on the ladder. Trophy icon marks the 100% goal.
          A tooltip on hover tells them how many ads they need to watch
          to reach the next level. */}
      <div className="group relative mt-2 w-full max-w-full overflow-hidden">
        <div className="behavior-bar flex w-full gap-1 px-0" style={{ height: '14px' }}>
          {blocks.map((block, i) => {
            const isCurrent = i === currentIdx
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors duration-500 ${
                  block.filled ? block.color : 'bg-muted-foreground/15'
                } ${isCurrent ? 'animate-pulse' : ''}`}
              />
            )
          })}
        </div>
        {/* V8 — tooltip overlay on hover */}
        <div
          className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:block group-hover:opacity-100"
          role="tooltip"
        >
          {score >= 100
            ? 'Perfect score! 🎉'
            : `Watch ${adsToNext} more ad${adsToNext === 1 ? '' : 's'} to reach ${nextLabel} status`}
        </div>
        {/* Trophy marker at the 100% position */}
        <span
          className={`absolute -top-1 right-0 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-card transition-all ${
            score >= 100
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40'
              : 'bg-muted text-muted-foreground'
          }`}
          title={score >= 100 ? 'Perfect score!' : 'Reach 100 to unlock the trophy'}
        >
          <Trophy className="h-3 w-3" />
        </span>
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
    <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4">
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-sm">
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
          className="action-btn min-h-[40px] shrink-0 disabled:opacity-60"
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
      <div className="behavior-bar mt-3 w-full max-w-full overflow-hidden">
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
    <div className="taly-card w-full max-w-full animate-fade-in-up overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="section-header min-w-0">
          <Users className="h-4 w-4 shrink-0 text-primary" /> Refer & Earn
        </div>
        <button
          onClick={onViewTeam}
          className="ghost-btn min-h-[36px] shrink-0"
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

      {/* Task tier selection — disabled while an active task is in progress.
          V8 — redesigned as a vertical "Milestone Ladder" with a connecting
          line on the left side linking the tier circles. */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
          {hasActiveTask ? 'Available tasks (locked)' : 'Milestone ladder'}
        </p>
        <div className="relative flex flex-col gap-3 pl-2">
          {/* V8 — vertical connecting line on the left side */}
          <span
            className="pointer-events-none absolute bottom-4 left-[26px] top-2 w-0.5 bg-gradient-to-b from-emerald-500/60 via-amber-400/40 to-muted-foreground/20"
            aria-hidden="true"
          />
          {tiers.map((t) => {
            // V5 — locked state: Tier 2 (rewardMonths 3–6) requires
            // completing a Tier 1 task; Tier 3 (rewardMonths ≥7) requires
            // completing a Tier 2 task. Tier 1 is always available.
            const tierNum = t.rewardMonths <= 2 ? 1 : t.rewardMonths <= 6 ? 2 : 3
            const completed = referral?.completedTasks ?? []
            const tier1Done = completed.some((c) => c.rewardMonths <= 2 && c.completedAt)
            const tier2Done = completed.some((c) => c.rewardMonths <= 6 && c.rewardMonths > 2 && c.completedAt)
            const locked = tierNum === 2 ? !tier1Done : tierNum === 3 ? !tier2Done : false
            const isActive = activeTask?.tier === t.tier
            return (
              <TaskTierCard
                key={t.tier}
                tier={t}
                disabled={hasActiveTask}
                selected={isActive}
                locked={locked && !hasActiveTask}
                isActive={isActive}
                onSelect={onSelectTask}
              />
            )
          })}
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
// Task tier card — V8 redesigned as a horizontal "ladder rung":
// [circle icon with number] [title + reward] [Select button on right]
// Locked tiers: greyed with lock icon, reward text still visible.
// Active tier: emerald border + Active + Fast Track badges.
// ============================================================

function TaskTierCard({
  tier,
  disabled,
  selected,
  locked,
  isActive,
  onSelect,
}: {
  tier: TaskTier
  disabled: boolean
  selected: boolean
  locked?: boolean
  isActive?: boolean
  onSelect: (tier: string) => void
}) {
  const tierNum = tier.rewardMonths <= 2 ? '1' : tier.rewardMonths <= 6 ? '2' : '3'
  // V8 — circle icon color reflects tier state
  const circleClass = isActive
    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/40'
    : locked
      ? 'bg-muted text-muted-foreground border-border'
      : selected
        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/40'
        : 'bg-primary/10 text-primary border-primary/30'

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border p-3 transition-all ${
        isActive
          ? 'border-emerald-500/60 bg-emerald-50/50 shadow-md shadow-emerald-500/10 dark:bg-emerald-950/20'
          : selected
            ? 'border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10'
            : locked
              ? 'border-muted-foreground/20 bg-muted/20 opacity-70'
              : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      {/* V8 — Circle icon (the rung node on the ladder line) */}
      <div className="relative z-10 flex shrink-0 items-center justify-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${circleClass}`}
        >
          {locked ? <Lock className="h-4 w-4" /> : tierNum}
        </span>
      </div>

      {/* Title + reward — always visible (even when locked) */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold">
            {tier.requiredCount} members · {tier.windowDays}d
          </p>
          {isActive && (
            <>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 shadow-sm"
                title="Fast Track — selected to complete for premium reward"
              >
                <Zap className="h-3 w-3" /> Fast Track
              </span>
            </>
          )}
          {locked && !isActive && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked
            </span>
          )}
        </div>
        {/* Reward — visible even when locked (per V8 spec) */}
        <p
          className={`mt-0.5 flex items-center gap-1 text-xs ${
            locked && !isActive ? 'text-muted-foreground/80' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          <Trophy className="h-3 w-3" />
          Reward: {tier.rewardMonths} months premium
        </p>
      </div>

      {/* Select / Locked button on the right */}
      <button
        disabled={disabled || locked || isActive}
        onClick={() => onSelect(tier.tier)}
        className={`min-h-[40px] shrink-0 rounded-lg px-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
          isActive
            ? 'ghost-btn'
            : locked
              ? 'ghost-btn cursor-not-allowed'
              : selected
                ? 'ghost-btn'
                : 'action-btn'
        }`}
      >
        {isActive ? (
          'Active'
        ) : locked ? (
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" /> Locked
          </span>
        ) : selected ? (
          'Selected ✓'
        ) : (
          'Select'
        )}
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
      <div className="mt-3 w-full max-w-full overflow-hidden">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Progress: {progress}/{task.requiredCount} members
          </span>
          <span className="text-muted-foreground/80">{Math.round(pct)}%</span>
        </div>
        <div className="behavior-bar w-full">
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

// ============================================================
// V6 — Scheduled Messages card + dialog
// Lists pending scheduled messages; allows cancel / edit time.
// ============================================================

interface ScheduledItem {
  id: string
  senderId: string
  conversationId: string
  content: string
  type: string
  mediaUrl?: string | null
  replyToId?: string | null
  scheduledFor: string
  isSent: boolean
  isCancelled: boolean
  createdAt: string
  sentAt?: string | null
  conversation?: {
    id: string
    type: 'private' | 'group'
    name?: string | null
    avatar?: string | null
    group?: { id: string; name: string; logo?: string | null } | null
    otherUser?: {
      id: string
      username?: string
      name?: string
      avatar?: string | null
    } | null
  } | null
}

function ScheduledMessagesCard({
  open,
  onOpenChange,
  count,
  onCountChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  count: number
  onCountChange: (n: number) => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())

  // Tick every 30s so the countdowns refresh.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/messages/schedule')
      const list: ScheduledItem[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.scheduledMessages)
          ? res.scheduledMessages
          : Array.isArray(res?.items)
            ? res.items
            : []
      setItems(list)
      onCountChange(list.length)
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to load scheduled messages', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [onCountChange, toast])

  // Load whenever the dialog opens (and refresh count when it closes).
  useEffect(() => {
    if (open) {
      void load()
    }
  }, [open, load])

  const handleCancel = useCallback(
    async (id: string) => {
      setCancellingId(id)
      try {
        await apiFetch(`/api/messages/schedule/${id}`, { method: 'DELETE' })
        toast({ title: 'Scheduled message cancelled' })
        setItems((prev) => prev.filter((it) => it.id !== id))
        onCountChange(Math.max(0, count - 1))
      } catch (e: any) {
        toast({ title: e?.message || 'Failed to cancel', variant: 'destructive' })
      } finally {
        setCancellingId(null)
      }
    },
    [count, onCountChange, toast],
  )

  const startEdit = (item: ScheduledItem) => {
    const d = new Date(item.scheduledFor)
    const pad = (n: number) => String(n).padStart(2, '0')
    setEditValue(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    )
    setEditingId(item.id)
  }

  const saveEdit = async (id: string) => {
    if (!editValue) return
    const when = new Date(editValue)
    if (isNaN(when.getTime())) {
      toast({ title: 'Invalid date/time', variant: 'destructive' })
      return
    }
    if (when.getTime() <= Date.now()) {
      toast({ title: 'Pick a time in the future', variant: 'destructive' })
      return
    }
    setSavingEdit(true)
    try {
      await apiFetch(`/api/messages/schedule/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledFor: when.toISOString() }),
      })
      toast({ title: 'Scheduled time updated' })
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, scheduledFor: when.toISOString() } : it)),
      )
      setEditingId(null)
    } catch (e: any) {
      toast({ title: e?.message || 'Failed to update', variant: 'destructive' })
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <>
      <div className="section-header mb-3">
        <Clock className="h-4 w-4 text-primary" /> Scheduled Messages
        {count > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
            {count}
          </span>
        )}
      </div>
      <button
        onClick={() => onOpenChange(true)}
        className="ghost-btn min-h-[44px] w-full justify-start"
      >
        <Clock className="mr-2 h-4 w-4" /> View &amp; manage scheduled
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Scheduled Messages
            </DialogTitle>
            <DialogDescription>
              Messages you&apos;ve scheduled to send later. Cancel or edit the
              time before they send.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60dvh]">
            <div className="flex flex-col gap-2 p-1">
              {loading && items.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 py-6 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No scheduled messages.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Open any chat → tap the 3-dot menu → &quot;Schedule send&quot;.
                  </p>
                </div>
              ) : (
                items.map((it) => {
                  const conv = it.conversation
                  let label = 'Conversation'
                  if (conv) {
                    if (conv.type === 'group') {
                      label = conv.group?.name || conv.name || 'Group chat'
                    } else {
                      label =
                        conv.otherUser?.name ||
                        conv.otherUser?.username ||
                        conv.name ||
                        'Private chat'
                    }
                  }
                  const when = new Date(it.scheduledFor)
                  const diffMs = when.getTime() - nowTick
                  const countdownLabel =
                    diffMs <= 0
                      ? 'Sending soon…'
                      : formatCountdownShort(diffMs)
                  return (
                    <div
                      key={it.id}
                      className="rounded-lg border bg-card p-3 text-sm shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-primary">
                            {label}
                          </div>
                          <div className="mt-0.5 line-clamp-2 break-words text-foreground/90">
                            {it.type === 'image' ? '📷 Photo' : it.content || '(empty)'}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(when, "dd MMM 'at' h:mm a")}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                              <Clock className="h-3 w-3" />
                              {countdownLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {editingId === it.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                          <input
                            type="datetime-local"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(it.id)}
                              disabled={savingEdit}
                              className="action-btn min-h-[36px] flex-1 text-xs"
                            >
                              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={savingEdit}
                              className="ghost-btn min-h-[36px] flex-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(it)}
                            className="ghost-btn min-h-[36px] flex-1 text-xs"
                          >
                            <Edit className="mr-1 h-3 w-3" /> Edit time
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(it.id)}
                            disabled={cancellingId === it.id}
                            className="ghost-btn min-h-[36px] flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                          >
                            {cancellingId === it.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="mr-1 h-3 w-3" />
                            )}
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}

function formatCountdownShort(ms: number): string {
  if (ms <= 0) return 'now'
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (day > 0) return `in ${day}d ${hr % 24}h`
  if (hr > 0) return `in ${hr}h ${min % 60}m`
  if (min > 0) return `in ${min}m ${sec % 60}s`
  return `in ${sec}s`
}

// ============================================================
// R1-3 — About / Coming Soon section (bottom of Profile screen)
// ============================================================

const APP_VERSION_R1_3 = '1.0.0'
const FOUNDER_R1_3 = process.env.NEXT_PUBLIC_FOUNDER || 'Omkar Panday'
const TAGLINE_R1_3 = process.env.NEXT_PUBLIC_APP_TAGLINE || 'Chat. Connect. Mingle.'
const GITHUB_URL_R1_3 = 'https://github.com/omkarpanday/talychat'

interface ComingSoonFeature {
  icon: string // emoji
  name: string
  desc: string
}

const COMING_SOON_FEATURES: ComingSoonFeature[] = [
  { icon: '📸', name: 'Stories', desc: 'Share disappearing moments' },
  { icon: '🔔', name: 'Push Notifications', desc: 'Never miss a message' },
  { icon: '🎵', name: 'Sound Effects', desc: 'Audio feedback for actions' },
  { icon: '↗️', name: 'Message Forwarding', desc: 'Share messages across chats' },
  { icon: '⭐', name: 'Story Highlights', desc: 'Save your favorite stories' },
  { icon: '🔒', name: 'Two-Factor Auth', desc: 'Extra account security' },
  { icon: '🕒', name: 'Scheduled Messages', desc: 'Send messages later' },
  { icon: '📍', name: 'Live Location Sharing', desc: 'Real-time GPS tracking' },
  { icon: '📤', name: 'Chat Export', desc: 'Download your chat history' },
]

function AboutComingSoonSection() {
  const [tab, setTab] = useState<'about' | 'coming'>('about')

  return (
    <section className="space-y-3 rounded-2xl bg-amber-50/30 p-3 dark:bg-amber-950/10">
      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/70">
        <Info className="h-3.5 w-3.5" /> About TalyChat
      </p>

      <div className="taly-card taly-card-hover w-full max-w-full animate-fade-in-up overflow-hidden p-4">
        {/* 2-tab toggle (About | Coming Soon) */}
        <div className="mb-4 inline-flex rounded-full border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTab('about')}
            className={`min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'about'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={tab === 'about'}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => setTab('coming')}
            className={`min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === 'coming'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-pressed={tab === 'coming'}
          >
            Coming Soon
          </button>
        </div>

        {tab === 'about' ? (
          <div className="space-y-3">
            {/* Logo + name + tagline */}
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="TalyChat"
                className="h-12 w-12 rounded-lg ring-1 ring-border"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold tracking-tight text-primary">
                  TalyChat
                </h3>
                <p className="text-xs italic text-muted-foreground">
                  {TAGLINE_R1_3}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground/90">
              TalyChat is a privacy-first chat & social platform built for
              genuine human connection. Message one-to-one, join vibrant
              communities, and discover new people — all in one place.
            </p>

            {/* Meta rows */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground/80">Founder</p>
                <p className="mt-0.5 font-medium">{FOUNDER_R1_3}</p>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-muted-foreground/80">Version</p>
                <p className="mt-0.5 font-mono font-medium">{APP_VERSION_R1_3}</p>
              </div>
            </div>

            {/* GitHub CTA */}
            <a
              href={GITHUB_URL_R1_3}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              <Github className="h-4 w-4" /> View on GitHub
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="px-1 text-xs text-muted-foreground">
              Features we&apos;re building next. Tap any item to learn more
              when they launch.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {COMING_SOON_FEATURES.map((f) => (
                <li
                  key={f.name}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-lg"
                  >
                    {f.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold">{f.name}</p>
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Coming Soon
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground/90">
                      {f.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

