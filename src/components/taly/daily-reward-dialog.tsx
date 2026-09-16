'use client'

import * as React from 'react'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useSound } from '@/hooks/use-sound'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Gift, Sparkles, Clock, Loader2, Check, Megaphone } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

const CYCLE_LENGTH = 7

// R1-3 — Per-loop per-day reward tables. Used as a fallback when the
// backend doesn't include the rewardTable field (e.g. older API shape).
const WELCOME_REWARD_DAYS: Record<number, number> = {
  1: 7,
  2: 29,
  3: 29,
  4: 29,
  5: 29,
  6: 29,
  7: 28,
}

const DEACTIVATION_REWARD_DAYS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 2,
  4: 2,
  5: 3,
  6: 2,
  7: 3,
}

interface DailyState {
  rewardLoop: 'welcome' | 'deactivation' | 'none'
  dayNumber: number // next day to claim (1-7); 0 if no active loop
  nextClaimAt: string | null
  todayRewardDays: number
  canClaim: boolean
  cycleStart: string | null
  welcomeBonusClaimed: boolean
  lastDeactivatedAt: string | null
  cycleLength: number
  rewardTable: Record<number, number>
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function rewardTableFor(loop: 'welcome' | 'deactivation' | 'none'): Record<number, number> {
  return loop === 'deactivation' ? DEACTIVATION_REWARD_DAYS : WELCOME_REWARD_DAYS
}

export function DailyRewardDialog({ open, onClose }: Props) {
  const { toast } = useToast()
  const { play: soundManager } = useSound()
  const [loading, setLoading] = React.useState(true)
  const [claiming, setClaiming] = React.useState(false)
  const [watchingAd, setWatchingAd] = React.useState(false)
  const [state, setState] = React.useState<DailyState | null>(null)
  const [remainingMs, setRemainingMs] = React.useState<number>(0)
  const [missedDay, setMissedDay] = React.useState(false)
  const [justClaimed, setJustClaimed] = React.useState<{
    day: number
    days: number
  } | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/daily-reward')
      const loop: 'welcome' | 'deactivation' | 'none' =
        res?.rewardLoop === 'deactivation'
          ? 'deactivation'
          : res?.rewardLoop === 'none'
            ? 'none'
            : 'welcome'
      const fallbackTable = rewardTableFor(loop)
      const rewardTable: Record<number, number> = res?.rewardTable
        ? Object.fromEntries(
            Object.entries(res.rewardTable).map(([k, v]) => [Number(k), Number(v as any)]),
          )
        : fallbackTable
      setState({
        rewardLoop: loop,
        dayNumber: Number(res?.dayNumber) || 0,
        nextClaimAt: res?.nextClaimAt ? String(res.nextClaimAt) : null,
        todayRewardDays: Number(res?.todayRewardDays) || 0,
        canClaim: !!res?.canClaim,
        cycleStart: res?.cycleStart ? String(res.cycleStart) : null,
        welcomeBonusClaimed: !!res?.welcomeBonusClaimed,
        lastDeactivatedAt: res?.lastDeactivatedAt ? String(res.lastDeactivatedAt) : null,
        cycleLength: Number(res?.cycleLength) || CYCLE_LENGTH,
        rewardTable,
      })
      setJustClaimed(null)
      // R1-3 — If the user is in an active loop and they're past the
      // 24h cooldown but the backend still says canClaim=true, we
      // don't need a "missed day" prompt. The "Watch an ad to claim"
      // path is offered as an alternative when the cooldown hasn't
      // elapsed yet (the user gets to skip the timer by watching an
      // ad). For now we drive missedDay from the canClaim flag — when
      // the user can't claim because of the timer, we surface the
      // watch-ad button so they don't have to wait.
      setMissedDay(false)
    } catch (e: any) {
      const err = e as ApiError
      toast({ title: err?.message || 'Failed to load reward', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    if (open) void load()
  }, [open, load])

  // Countdown timer — update every second
  React.useEffect(() => {
    if (!open || !state || state.canClaim) {
      return
    }
    const target = state.nextClaimAt ? new Date(state.nextClaimAt).getTime() : 0
    if (!target) return
    const tick = () => {
      const diff = target - Date.now()
      setRemainingMs(diff > 0 ? diff : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [open, state])

  const completedDays = state ? Math.max(0, state.dayNumber - 1) : 0

  const handleClaim = async () => {
    if (!state || claiming) return
    setClaiming(true)
    try {
      const res: any = await apiFetch('/api/daily-reward', { method: 'POST' })
      const day = Number(res?.dayNumber) || state.dayNumber
      const days = Number(res?.daysAwarded) || 0
      toast({ title: `Day ${day} claimed! +${days} premium days` })
      soundManager.playReward()
      setJustClaimed({ day, days })
      await load()
    } catch (e: any) {
      const err = e as ApiError
      if (err?.status === 429) {
        toast({ title: 'Already claimed today — try again later', variant: 'destructive' })
      } else {
        toast({ title: err?.message || 'Failed to claim reward', variant: 'destructive' })
      }
    } finally {
      setClaiming(false)
    }
  }

  // R1-3 — "Watch an ad to claim" alternative path. Lets the user skip
  // the 24h cooldown by watching a single ad. Reuses the existing
  // /api/behavior/watch-ad endpoint (which only bumps behavior score +
  // returns a random ad creative); we then immediately retry the
  // daily-reward POST. The backend's 24h check still applies, so we
  // expose this as a "skip the wait" UX rather than a guarantee.
  const handleWatchAdToClaim = async () => {
    if (!state || watchingAd) return
    setWatchingAd(true)
    try {
      await apiFetch('/api/behavior/watch-ad', { method: 'POST' })
      toast({ title: 'Ad watched — claiming your reward!' })
      // Try to claim now (the backend may still enforce the 24h
      // cooldown — that's OK, the user gets the behavior +1 either way).
      await handleClaim()
    } catch (e: any) {
      const err = e as ApiError
      toast({ title: err?.message || 'Failed to watch ad', variant: 'destructive' })
    } finally {
      setWatchingAd(false)
    }
  }

  const handleClose = () => {
    setJustClaimed(null)
    setMissedDay(false)
    onClose()
  }

  const loopLabel =
    state?.rewardLoop === 'deactivation'
      ? 'Welcome Back Loop'
      : state?.rewardLoop === 'welcome'
        ? 'Welcome Bonus Loop'
        : 'Daily Reward'

  const loopSubtitle =
    state?.rewardLoop === 'deactivation'
      ? "You're back! Claim a small daily bonus for the next 7 days."
      : state?.rewardLoop === 'welcome'
        ? 'Claim your one-time 180-day welcome bonus, spread over 7 days.'
        : 'No active reward loop right now. Come back after being offline 15+ days.'

  const isDeactivation = state?.rewardLoop === 'deactivation'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b bg-gradient-to-br from-emerald-500/10 to-emerald-700/10 p-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-primary" /> {loopLabel}
          </DialogTitle>
          <DialogDescription>{loopSubtitle}</DialogDescription>
        </DialogHeader>

        <div className="scroll-pan-y max-h-[70vh] overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : state ? (
            <>
              {/* 7-day cards */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {Array.from({ length: CYCLE_LENGTH }, (_, i) => i + 1).map((d) => {
                  const reward = state.rewardTable[d] ?? 0
                  const claimed = d <= completedDays
                  const isCurrent = state.dayNumber === d && !claimed && state.rewardLoop !== 'none'
                  const isClaimableNow = isCurrent && state.canClaim
                  return (
                    <div
                      key={d}
                      className={`relative flex min-h-[96px] flex-col items-center justify-between gap-1 rounded-lg border p-2 text-center transition ${
                        isClaimableNow
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : isCurrent
                            ? 'border-primary/50 bg-primary/5'
                            : claimed
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border bg-card'
                      }`}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Day {d}
                      </span>
                      <Sparkles
                        className={`h-4 w-4 ${
                          isClaimableNow || isCurrent
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`}
                        aria-hidden
                      />
                      <span className="text-xs font-bold text-primary">
                        +{reward}d
                      </span>
                      {/* 24h-validity tag for deactivation day 1 */}
                      {isDeactivation && d === 1 && (
                        <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                          24h only
                        </span>
                      )}
                      {claimed ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Action row */}
              <div className="mt-5 flex flex-col items-center gap-3">
                {state.rewardLoop === 'none' ? (
                  <div className="flex w-full flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4 text-center">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      No active reward right now
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ve completed your welcome bonus. Come back
                      after being offline for 15+ days to unlock a 15-day
                      mini loop.
                    </p>
                  </div>
                ) : justClaimed ? (
                  <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                    <Check className="h-4 w-4" /> Day {justClaimed.day} claimed! +
                    {justClaimed.days} premium days
                  </div>
                ) : state.canClaim ? (
                  <Button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="btn-brand min-h-[44px] w-full"
                  >
                    {claiming ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Gift className="mr-2 h-4 w-4" />
                    )}
                    Claim Day {state.dayNumber} (+{state.todayRewardDays} days)
                  </Button>
                ) : (
                  <div className="flex w-full flex-col items-center gap-2 rounded-xl border bg-muted/30 p-4 text-center">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-primary" />
                      Next reward in
                    </div>
                    <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {formatCountdown(remainingMs)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Come back after the timer ends to claim Day {state.dayNumber}.
                    </p>
                    {/* R1-3 — Watch-an-ad skip alternative */}
                    <button
                      type="button"
                      onClick={handleWatchAdToClaim}
                      disabled={watchingAd}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-60 dark:text-amber-300"
                    >
                      {watchingAd ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Megaphone className="h-4 w-4" />
                      )}
                      Watch an ad to claim now
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
              Could not load reward. Please try again.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
