'use client'

import * as React from 'react'
import {
  MapPin,
  Navigation,
  Crosshair,
  Clock,
  Loader2,
  ExternalLink,
  StopCircle,
  Check,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import { getSocket } from '@/lib/socket'
import { PremiumAvatar } from '@/components/premium-avatar'
import { cn } from '@/lib/utils'

interface ActiveShare {
  id: string
  conversationId: string
  userId: string
  lat: number
  lng: number
  expiresAt: string
  isLive: boolean
  createdAt: string
  user?: {
    id: string
    username: string
    name: string
    avatar?: string | null
    isPremium?: boolean
    premiumTier?: string
  }
}

interface Props {
  open: boolean
  onClose: () => void
  conversationId: string
}

const DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
]

/**
 * V8 — Live location sharing dialog.
 *
 * Lets the user grab their current GPS position (user gesture → geolocation
 * permission), preview it on an OpenStreetMap embed, choose a share
 * duration, and start/stop a live location share in this conversation.
 * Also lists other members' active shares.
 */
export function LocationShareDialog({ open, onClose, conversationId }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = React.useState(false)
  const [fetchingGps, setFetchingGps] = React.useState(false)
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = React.useState<string | null>(null)
  const [duration, setDuration] = React.useState('15')
  const [shares, setShares] = React.useState<ActiveShare[]>([])
  const [sharing, setSharing] = React.useState(false)
  const [stopping, setStopping] = React.useState(false)

  const loadShares = React.useCallback(async () => {
    try {
      const res: any = await apiFetch(`/api/conversations/${conversationId}/location`)
      const list: ActiveShare[] = Array.isArray(res?.shares) ? res.shares : []
      setShares(list)
    } catch (e: any) {
      // Silent — best-effort fetch
    }
  }, [conversationId])

  // Load existing active shares when the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setGpsError(null)
    setCoords(null)
    setLoading(true)
    loadShares().finally(() => setLoading(false))
  }, [open, loadShares])

  const myShare = shares.find((s) => s.userId === user?.id)

  // ----- Geolocation (must be triggered by a user gesture) -----
  const fetchGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by this browser.')
      return
    }
    setFetchingGps(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setFetchingGps(false)
      },
      (err) => {
        let msg = 'Failed to get your location.'
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Update your browser settings to allow it.'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Position unavailable. Try again or move to an open area.'
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Try again.'
        }
        setGpsError(msg)
        setFetchingGps(false)
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    )
  }

  const handleShare = async () => {
    if (!coords) return
    setSharing(true)
    try {
      // 1) Create the live location share record (so other members see
      //    us in the "sharing now" list and we can stop sharing later).
      await apiFetch(`/api/conversations/${conversationId}/location`, {
        method: 'POST',
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          duration: Number(duration),
        }),
      })
      // 2) Also post a one-time location message so the location appears
      //    as a chat bubble with the map preview. (The Message model has
      //    been extended in V8 to support type='location'.)
      try {
        const res: any = await apiFetch('/api/messages', {
          method: 'POST',
          body: JSON.stringify({
            conversationId,
            type: 'location',
            lat: coords.lat,
            lng: coords.lng,
            content: '',
          }),
        })
        // Defensive: API returns { message: {...} } (201), fall back to bare object.
        const sent: any = res?.message || (res?.id ? res : null)
        if (sent) {
          // Broadcast to all conversation members (including ourselves for
          // confirmation). The chat-view's `message:new` handler will pick
          // this up via the socket echo and add the bubble to the list.
          getSocket()?.emit('message:send', { conversationId, message: sent })
        }
      } catch {
        // Non-fatal — the share record was created; the message is just
        // a visual aid in the chat.
      }
      toast({ title: 'Live location shared' })
      await loadShares()
    } catch (e: any) {
      toast({ title: e.message || 'Failed to share location', variant: 'destructive' })
    } finally {
      setSharing(false)
    }
  }

  const handleStop = async () => {
    setStopping(true)
    try {
      await apiFetch(`/api/conversations/${conversationId}/location`, { method: 'DELETE' })
      toast({ title: 'Stopped sharing location' })
      await loadShares()
    } catch (e: any) {
      toast({ title: e.message || 'Failed to stop sharing', variant: 'destructive' })
    } finally {
      setStopping(false)
    }
  }

  const otherShares = shares.filter((s) => s.userId !== user?.id)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Live Location
          </DialogTitle>
          <DialogDescription>
            Share your real-time location with this conversation.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* My sharing status */}
            {myShare ? (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  You are sharing your live location
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expires at{' '}
                  <LiveCountdown
                    expiresAt={myShare.expiresAt}
                    className="font-medium text-foreground"
                  />
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={osmEmbedUrl(myShare.lat, myShare.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-md border px-3 text-sm hover:bg-accent"
                  >
                    <ExternalLink className="h-4 w-4" /> View map
                  </a>
                  <Button
                    variant="outline"
                    onClick={handleStop}
                    disabled={stopping}
                    className="min-h-[40px] border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {stopping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StopCircle className="h-4 w-4" />
                    )}
                    Stop
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* GPS trigger button */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  {!coords ? (
                    <Button
                      onClick={fetchGps}
                      disabled={fetchingGps}
                      className="btn-brand min-h-[44px] w-full"
                    >
                      {fetchingGps ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crosshair className="h-4 w-4" />
                      )}
                      Get my location
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-md border">
                        <iframe
                          title="Location preview"
                          src={osmEmbedUrl(coords.lat, coords.lng)}
                          className="h-44 w-full"
                          style={{ border: 0 }}
                          loading="lazy"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3 text-primary" />
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </span>
                        <button
                          type="button"
                          onClick={fetchGps}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded px-2 text-xs text-primary hover:bg-accent"
                        >
                          <Navigation className="h-3 w-3" /> Refresh
                        </button>
                      </div>
                    </div>
                  )}
                  {gpsError && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-destructive">
                      <X className="mt-0.5 h-3 w-3 shrink-0" />
                      {gpsError}
                    </p>
                  )}
                </div>

                {/* Duration selector */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" /> Share duration
                  </label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="min-h-[40px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Share button */}
                <Button
                  onClick={handleShare}
                  disabled={!coords || sharing}
                  className="btn-brand min-h-[44px] w-full"
                >
                  {sharing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  Share Location
                </Button>
              </>
            )}

            {/* Other members' active shares */}
            {otherShares.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sharing now
                </p>
                {otherShares.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <PremiumAvatar
                      user={{
                        isPremium: s.user?.isPremium,
                        premiumTier: s.user?.premiumTier,
                        avatar: s.user?.avatar || undefined,
                        name: s.user?.name || s.user?.username || 'U',
                        id: s.user?.id || s.userId || undefined,
                        username: s.user?.username || undefined,
                      }}
                      size={32}
                      showAura={false}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.user?.name || s.user?.username || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Live until{' '}
                        <LiveCountdown
                          expiresAt={s.expiresAt}
                          className="font-medium text-foreground"
                        />
                      </p>
                    </div>
                    <a
                      href={googleMapsUrl(s.lat, s.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1 rounded-md border px-2 text-xs hover:bg-accent"
                    >
                      <ExternalLink className="h-3 w-3" /> Map
                    </a>
                  </div>
                ))}
              </div>
            )}

            {otherShares.length === 0 && !myShare && (
              <p className="flex items-center justify-center gap-1 rounded-md border border-dashed bg-muted/10 p-3 text-center text-xs text-muted-foreground">
                <Check className="h-3 w-3" /> No active location shares in this chat.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// Helpers
// ===========================================================================

function osmEmbedUrl(lat: number, lng: number): string {
  // OpenStreetMap embed iframe — centered on the coordinates with a marker.
  // bbox = [min_lon, min_lat, max_lon, max_lat] — small box around the point.
  const d = 0.005
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16`
}

function LiveCountdown({
  expiresAt,
  className,
}: {
  expiresAt: string
  className?: string
}) {
  const target = new Date(expiresAt).getTime()
  const [text, setText] = React.useState('')

  React.useEffect(() => {
    function update() {
      const diff = target - Date.now()
      if (diff <= 0) {
        setText('expired')
        return
      }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1000)
      if (h > 0) {
        setText(`${h}h ${m}m ${s}s`)
      } else if (m > 0) {
        setText(`${m}m ${s}s`)
      } else {
        setText(`${s}s`)
      }
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [target])

  // Also render the absolute time as a tooltip title
  const absolute = new Date(expiresAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <span className={cn(className)} title={`Ends at ${absolute}`}>
      {text}
    </span>
  )
}
