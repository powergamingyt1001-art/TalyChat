'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface PremiumAvatarUser {
  isPremium?: boolean | null
  premiumTier?: string | null
  avatar?: string | null
  name: string
  /** PRD-2 — User ID used as the deterministic seed for the fallback
   *  background color. When no avatar image is available, the
   *  fallback renders the first letter of the name on a colored
   *  background. Falls back to `name` when id is missing so the
   *  color is still stable across renders. */
  id?: string | null
  /** Username fallback — used as a secondary seed if `id` is missing. */
  username?: string | null
}

interface PremiumAvatarProps {
  user: PremiumAvatarUser
  size?: number
  showAura?: boolean
  className?: string
  /** When true, render a small pulsing green dot at the avatar's bottom-right. */
  isOnline?: boolean
}

// Tier → ring color (hex)
// PRD-1 — Gold tone changed from bright #FFD700 (harsh yellow) to subtle
// premium metallic gold #D4AF37. The bronze and silver tones stay.
const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#D4AF37',
}

// PRD-1 — Subtle premium gold accent tones used for the crown + glow.
// Primary gold #D4AF37, light gold #E8C547, dark gold #B8860B (dark
// goldenrod). Replaces the previous bright-yellow #FFD700 / #FFA500
// tones so the premium tier reads as classy metallic gold, not a
// bright yellow explosion.
const GOLD_PRIMARY = '#D4AF37'
const GOLD_DARK = '#B8860B'

// PRD-2 — Palette of pleasant background colors for the avatar
// fallback. Each user deterministically picks one of these colors
// based on a hash of their user id, so the same user always gets
// the same color across every screen (chat list, header, members,
// home, discover, etc.).
const AVATAR_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#06b6d4', // cyan
]

/**
 * PRD-2 — Deterministic per-user color picker. Hashes the seed
 * (user id, with fallback to username / name) and returns one of
 * the 10 palette colors. Same seed → same color every render, so
 * a user always gets the same color across the app.
 */
function getAvatarColor(seed: string): string {
  if (!seed) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Pick a readable foreground (white / near-black) for a given hex
// background so the initial always has good contrast.
function pickReadableText(hex: string): string {
  // Convert #rrggbb → relative luminance and choose text color.
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lum =
    0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
  return lum > 0.55 ? '#1f2937' : '#ffffff'
}

// Crown SVG (only for gold tier) — PRD-1: subtle premium gold fill
// (#D4AF37) with a dark goldenrod (#B8860B) stroke. Gem dots switched
// from harsh pure red (#ff0000) to a softer ruby-rose so they don't
// clash with the muted gold.
function CrownMark({ size }: { size: number }) {
  const w = Math.max(20, Math.round(size * 0.8))
  const h = Math.round(w * 16 / 24)
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 24 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="pointer-events-none select-none"
      style={{
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))',
      }}
    >
      <path
        d="M2 14 L4 4 L8 8 L12 2 L16 8 L20 4 L22 14 Z"
        fill={GOLD_PRIMARY}
        stroke={GOLD_DARK}
        strokeWidth="0.5"
      />
      <circle cx="4" cy="4" r="1.5" fill="#b91c1c" />
      <circle cx="12" cy="2" r="1.5" fill="#b91c1c" />
      <circle cx="20" cy="4" r="1.5" fill="#b91c1c" />
    </svg>
  )
}

function initialsOf(name: string): string {
  return (name || '?').toString().charAt(0).toUpperCase() || '?'
}

/**
 * PremiumAvatar — renders a user's Avatar with premium visual effects
 * (bronze/silver/gold ring, optional aura, and a crown for gold tier).
 *
 * PRD-2 — When no avatar image is available, the fallback now shows
 * the user's first initial on a deterministic per-user color
 * background (based on user id). This works for ALL users (not just
 * the current user) across every screen: chat list, chat header,
 * group members, home screen, discover. The avatar is fully round.
 *
 * Tier mapping (per V2 spec):
 * - free (not premium): plain avatar, no effects
 * - bronze (2-month plan): bronze ring, no aura, no crown
 * - silver (6-month plan): silver ring + soft silver aura
 * - gold (1-year plan): gold ring + heavy golden aura + crown on top
 *
 * R8-11 — Bug fix: when a user has `isPremium=true` but no `premiumTier`
 * (or a "free" tier value), we now promote them to the highest tier
 * (`gold`) so their premium visual effects still render. Previously the
 * premium ring / aura / crown silently disappeared in this case, which
 * is why "premium effects are NOT showing in profile" was reported.
 */
export function PremiumAvatar({
  user,
  size = 40,
  showAura = true,
  className,
  isOnline = false,
}: PremiumAvatarProps) {
  // R8-11 — Normalize tier. If the user is premium but their tier is
  // missing or "free" (the DB default), promote to "gold" so the visual
  // effects always render. Otherwise use the provided tier.
  const rawTier = (user?.premiumTier || 'free').toLowerCase()
  const isPremium = !!user?.isPremium || rawTier !== 'free'
  const tier: string =
    isPremium && (rawTier === 'free' || !TIER_COLORS[rawTier])
      ? 'gold'
      : rawTier
  const color = TIER_COLORS[tier]
  const ringColor = isPremium && color ? color : undefined

  // Only render aura for silver/gold (bronze = "minimal or no aura")
  const auraActive = showAura && isPremium && (tier === 'silver' || tier === 'gold')
  const crown = isPremium && tier === 'gold'

  // PRD-1 — Subtle aura extents (was 0.4 / 0.22 → 0.22 / 0.16). The gold
  // aura no longer spreads too far beyond the avatar — instead it stays
  // close to the ring like a soft halo.
  const auraExtent =
    tier === 'gold' ? Math.round(size * 0.22) : Math.round(size * 0.16)
  const auraSize = size + auraExtent * 2

  // PRD-1 — Aura opacity reduced from 0.95 / 0.6 → 0.4 / 0.4 for a subtle,
  // elegant glow (not a bright yellow explosion).
  const auraOpacity = tier === 'gold' ? 0.4 : 0.4

  // PRD-2 — Per-user deterministic color for the fallback background.
  // Prefer user.id, fall back to username / name so the color is stable
  // across renders and screens even when id is unavailable.
  const fallbackSeed = (user?.id || user?.username || user?.name || 'unknown').toString()
  const fallbackColor = getAvatarColor(fallbackSeed)
  const fallbackTextColor = pickReadableText(fallbackColor)

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* Aura layer (behind avatar) — PRD-1: subtle gold halo, not a
          bright yellow explosion. Uses the tier ring color at low alpha
          (cc/55/00 gradient stops) with a small blur. */}
      {auraActive && ringColor && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: auraSize,
            height: auraSize,
            top: -auraExtent,
            left: -auraExtent,
            background: `radial-gradient(circle, ${ringColor}55 0%, ${ringColor}22 45%, ${ringColor}00 75%)`,
            filter: `blur(${tier === 'gold' ? 3 : 2}px)`,
            opacity: auraOpacity,
            zIndex: 0,
          }}
          animate={{
            scale: [1, 1.04, 1],
            opacity: [auraOpacity, auraOpacity * 1.15, auraOpacity],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Secondary subtle inner glow ring for gold — PRD-1: smaller,
          lower-opacity (0.35) so the gold ring reads as a soft controlled
          accent rather than a bright yellow halo. */}
      {tier === 'gold' && ringColor && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size + 4,
            height: size + 4,
            top: -2,
            left: -2,
            background: `radial-gradient(circle, ${ringColor}00 55%, ${ringColor}55 72%, ${ringColor}00 85%)`,
            filter: 'blur(1.5px)',
            opacity: 0.35,
            zIndex: 0,
          }}
          animate={{
            scale: [1, 1.04, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        />
      )}

      {/* Crown on top for gold tier */}
      {crown && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 -translate-y-[55%]"
          style={{ top: 0 }}
        >
          <CrownMark size={size} />
        </div>
      )}

      {/* The actual avatar with ring — PRD-1: thin 1px border (was
          border-2) for a subtle, controlled premium look. The ring glow
          is also smaller and lower-alpha so the gold reads as a classy
          accent, not a bright yellow halo. */}
      <Avatar
        className="relative z-10 border"
        style={{
          width: size,
          height: size,
          borderColor: ringColor || 'transparent',
          // PRD-1 — Subtle ring glow per tier. Outer glow reduced to small
          // radius + low alpha so it reads as a soft halo, not a bright
          // yellow explosion.
          boxShadow: ringColor
            ? tier === 'gold'
              ? `0 0 0 1px ${ringColor}, 0 0 5px ${ringColor}66, 0 0 10px ${ringColor}22`
              : tier === 'silver'
                ? `0 0 0 1px ${ringColor}, 0 0 4px ${ringColor}55, 0 0 8px ${ringColor}22`
                : `0 0 0 1px ${ringColor}, 0 0 2px ${ringColor}44`
            : undefined,
        }}
      >
        {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || ''} />}
        <AvatarFallback
          // PRD-2 — Per-user random color background, round shape, white
          // (or near-black for very light colors) initial. The fallback
          // shows when no avatar image is available — this is what
          // gives every user a distinct, persistent color across the
          // app (chat list, header, members, home, discover).
          className="rounded-full font-semibold"
          style={{
            backgroundColor: fallbackColor,
            color: fallbackTextColor,
            fontSize: Math.max(12, Math.round(size * 0.4)),
          }}
        >
          {initialsOf(user?.name)}
        </AvatarFallback>
      </Avatar>

      {/* Online status dot — only when explicitly marked online. The dot's
          visual style lives in globals.css (.online-dot + .online-dot::after)
          so the pulsing aura stays consistent across all avatars in the app.
          Scaled proportionally to the avatar size for large header avatars. */}
      {isOnline && (
        <span
          className="online-dot z-30"
          aria-hidden
          style={{
            width: Math.max(8, Math.round(size * 0.28)),
            height: Math.max(8, Math.round(size * 0.28)),
          }}
        />
      )}
    </div>
  )
}
