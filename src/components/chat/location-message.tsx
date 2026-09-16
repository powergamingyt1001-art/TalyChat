'use client'

import * as React from 'react'
import { MapPin, ExternalLink, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  lat: number
  lng: number
  isMine: boolean
  // Optional ISO timestamp for when this location share expires (if it's
  // a live share). If omitted, the location is treated as static.
  expiresAt?: string | null
}

/**
 * V8 — Location message body.
 *
 * Renders a small static-map preview (OpenStreetMap embed iframe) of the
 * coordinates plus an "Open in Maps" button that opens Google Maps with
 * a marker at the same coordinates.
 *
 * If `expiresAt` is in the future, shows a "Live until HH:MM" countdown
 * under the map.
 */
export function LocationMessage({ lat, lng, isMine, expiresAt }: Props) {
  const mapUrl = React.useMemo(
    () => osmEmbedUrl(lat, lng),
    [lat, lng]
  )
  const gmapsUrl = React.useMemo(
    () => `https://www.google.com/maps?q=${lat},${lng}&z=16`,
    [lat, lng]
  )

  return (
    <div className="min-w-[220px] max-w-[280px] space-y-1">
      <div className="overflow-hidden rounded-md border border-black/10">
        <iframe
          title="Location map"
          src={mapUrl}
          className="h-32 w-full"
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3 text-primary" />
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'inline-flex min-h-[32px] items-center gap-1 rounded px-2 text-xs font-medium',
            isMine
              ? 'text-white/90 hover:bg-white/10'
              : 'text-primary hover:bg-accent'
          )}
        >
          <ExternalLink className="h-3 w-3" /> Open in Maps
        </a>
      </div>
      {expiresAt && (
        <LiveBadge expiresAt={expiresAt} isMine={isMine} />
      )}
    </div>
  )
}

// ===========================================================================
// Helpers
// ===========================================================================

function osmEmbedUrl(lat: number, lng: number): string {
  // Build a small bounding box around the point and pass the marker
  // via the standard OSM export embed URL.
  const d = 0.005
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`
}

function LiveBadge({
  expiresAt,
  isMine,
}: {
  expiresAt: string
  isMine: boolean
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
      const m = Math.floor(diff / 60_000)
      const s = Math.floor((diff % 60_000) / 1000)
      const hours = Math.floor(m / 60)
      const minutes = m % 60
      if (hours > 0) {
        setText(`Live for ${hours}h ${minutes}m ${s}s`)
      } else if (minutes > 0) {
        setText(`Live for ${minutes}m ${s}s`)
      } else {
        setText(`Live for ${s}s`)
      }
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [target])

  const absolute = new Date(expiresAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-[10px] font-medium',
        isMine ? 'text-white/80' : 'text-primary'
      )}
      title={`Expires at ${absolute}`}
    >
      <Clock className="h-3 w-3" />
      {text}
    </div>
  )
}
