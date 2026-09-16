'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { ChatAd } from './chat-types'
import { cn } from '@/lib/utils'

interface ChatAdBoxProps {
  ad: ChatAd | null
  onClose: () => void
  onCtaClick?: (ad: ChatAd) => void
  className?: string
}

/**
 * In-chat ad box (PRD section 10). Split-pane layout: left ad image (~35%),
 * right content (~65%). Brand + "Sponsored" badge, headline, description,
 * CTA button, close button top-right.
 *
 * The close ✕ appears after 3 seconds (handled here via state). Hiding the
 * ad calls `onClose` which the parent uses to restart the timer.
 */
export function ChatAdBox({ ad, onClose, onCtaClick, className }: ChatAdBoxProps) {
  const [closeVisible, setCloseVisible] = React.useState(false)

  React.useEffect(() => {
    // Reset close visibility whenever the ad changes.
    setCloseVisible(false)
    if (!ad) return
    const t = setTimeout(() => setCloseVisible(true), 3000)
    return () => clearTimeout(t)
  }, [ad?.id])

  if (!ad) return null

  const handleCta = () => {
    if (onCtaClick) onCtaClick(ad)
    if (ad.ctaUrl && ad.ctaUrl !== '#') {
      try {
        window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer')
      } catch {}
    }
  }

  return (
    <div
      className={cn(
        'ad-box mx-auto my-2 flex w-full max-w-md items-stretch overflow-hidden',
        className
      )}
      role="complementary"
      aria-label={`Ad from ${ad.brandName}`}
    >
      {/* Left pane — image (~35%) */}
      {ad.imageUrl && (
        <div
          className="relative w-[35%] shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ad.imageUrl})` }}
          aria-hidden
        >
          {!ad.imageUrl && (
            <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">
              AD
            </div>
          )}
        </div>
      )}
      {!ad.imageUrl && (
        <div
          className="flex w-[35%] shrink-0 items-center justify-center bg-primary/10 text-2xl text-primary/60"
          aria-hidden
        >
          AD
        </div>
      )}

      {/* Right pane — content (~65%) */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="truncate text-sm font-semibold">
              {ad.brandName}
            </span>
            <span className="sponsored-label">Sponsored</span>
          </div>
          {closeVisible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close ad"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {ad.headline && (
          <div className="truncate text-sm font-medium">{ad.headline}</div>
        )}
        {ad.description && (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {ad.description}
          </div>
        )}
        <button
          type="button"
          onClick={handleCta}
          className="btn-brand mt-1 self-start rounded-md px-3 py-1.5 text-xs font-semibold"
        >
          {ad.ctaText || 'Learn More'}
        </button>
      </div>
    </div>
  )
}
