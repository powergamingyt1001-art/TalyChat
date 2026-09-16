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
import { Progress } from '@/components/ui/progress'
import { Gift, Sparkles, Clock, Loader2, Check } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

// Per PRD §14 — premium-day reward for each day of the 7-day cycle
const REWARD_DAYS: Record<number, number> = {
  1: 5,
  2: 5,
  3: 7,
  4: 8,
  5: 10,
  6: 10,
  7: 15,
}
const CYCLE_LENGTH = 7
const TOTAL_CYCLE_DAYS = Object.values(REWARD_DAYS).reduce((a, b) => a + b, 0) // 60

interface DailyState {
  dayNumber: number // next day to claim (1-7)
  nextClaimAt: string | null
  todayRewardDays: number
  canClaim: boolean
  cycleStart: string | null
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function DailyRewardDialog({ open, onClose }: Props) {
  const { toast } = useToast()
  const { play: soundManager } = useSound()
  const [loading, setLoading] = React.useState(true)
  const [claiming, setClaiming] = React.useState(false)
  const [state, setState] = React.useState<DailyState | null>(null)
  const [remainingMs, setRemainingMs] = React.useState<number>(0)
  const [justClaimed, setJustClaimed] = React.useState<{
    day: number
    days: number
  } | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/daily-reward')
      setState({
        dayNumber: Number(res?.dayNumber) || 1,
        nextClaimAt: res?.nextClaimAt ? String(res.nextClaimAt) : null,
        todayRewardDays: Number(res?.todayRewardDays) || 0,
        canClaim: !!res?.canClaim,
        cycleStart: res?.cycleStart ? String(res.cycleStart) : null,
      })
      setJustClaimed(null)
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
  const cycleEarnedDays = Array.from({ length: completedDays }, (_, i) => i + 1).reduce(
    (acc, d) => acc + (REWARD_DAYS[d] || 0),
    0
  )

  const handleClaim = async () => {
    if (!state || claiming) return
    setClaiming(true)
    try {
      const res: any = await apiFetch('/api/daily-reward', { method: 'POST' })
      const day = Number(res?.dayNumber) || state.dayNumber
      const days = Number(res?.daysAwarded) || 0
      toast({ title: `Day ${day} claimed! +${days} premium days` })
      // Celebratory arpeggio — fires inside the user's tap gesture so the
      // AudioContext stays unlocked on Safari/Chrome.
      soundManager.playReward()
      setJustClaimed({ day, days })
      // Refresh state
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

  const handleClose = () => {
    setJustClaimed(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b bg-gradient-to-br from-emerald-500/10 to-emerald-700/10 p-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-primary" /> Daily Reward
          </DialogTitle>
          <DialogDescription>
            Claim a premium-day bonus every 24 hours. Keep your streak going!
          </DialogDescription>
        </DialogHeader>

        <div className="scroll-pan-y max-h-[70vh] overflow-y-auto p-5">
          {loading ? (
            <div className="flex min-h-[180px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : state ? (
            <>
              {/* Summary */}
              <div className="mb-4 rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Cycle</span>
                  <span className="font-semibold">
                    {completedDays}/{CYCLE_LENGTH} days completed
                  </span>
                </div>
                <Progress
                  value={(completedDays / CYCLE_LENGTH) * 100}
                  className="mt-2 h-2"
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Total earned</span>
                  <span className="font-semibold text-primary">
                    {cycleEarnedDays} day{cycleEarnedDays === 1 ? '' : 's'} of {TOTAL_CYCLE_DAYS}
                  </span>
                </div>
              </div>

              {/* 7-day cards */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {Array.from({ length: CYCLE_LENGTH }, (_, i) => i + 1).map((d) => {
                  const reward = REWARD_DAYS[d]
                  const claimed = d <= completedDays
                  const isCurrent = state.dayNumber === d && !claimed
                  const isClaimableNow = isCurrent && state.canClaim
                  return (
                    <div
                      key={d}
                      className={`relative flex min-h-[88px] flex-col items-center justify-between gap-1 rounded-lg border p-2 text-center transition ${
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
                      <span className="text-xs font-bold text-primary">+{reward}d</span>
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
                {justClaimed ? (
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
