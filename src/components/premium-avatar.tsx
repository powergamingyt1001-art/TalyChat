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
const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
}

// Crown SVG (only for gold tier)
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
        fill="#ffd700"
        stroke="#b8860b"
        strokeWidth="0.5"
      />
      <circle cx="4" cy="4" r="1.5" fill="#ff0000" />
      <circle cx="12" cy="2" r="1.5" fill="#ff0000" />
      <circle cx="20" cy="4" r="1.5" fill="#ff0000" />
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
 * Tier mapping (per V2 spec):
 * - free (not premium): plain avatar, no effects
 * - bronze (2-month plan): bronze ring, no aura, no crown
 * - silver (6-month plan): silver ring + soft silver aura
 * - gold (1-year plan): gold ring + heavy golden aura + crown on top
 *
 * The aura uses layered radial gradients + a slow breathing animation via Framer Motion.
 */
export function PremiumAvatar({
  user,
  size = 40,
  showAura = true,
  className,
  isOnline = false,
}: PremiumAvatarProps) {
  const tier = (user?.premiumTier || 'free').toLowerCase()
  const isPremium = !!user?.isPremium || tier !== 'free'
  const color = TIER_COLORS[tier]
  const ringColor = isPremium && color ? color : undefined

  // Only render aura for silver/gold (bronze = "minimal or no aura")
  const auraActive = showAura && isPremium && (tier === 'silver' || tier === 'gold')
  const crown = isPremium && tier === 'gold'

  // Aura sizing — extend ~25-35% beyond avatar for gold, ~15% for silver
  const auraExtent =
    tier === 'gold' ? Math.round(size * 0.32) : Math.round(size * 0.18)
  const auraSize = size + auraExtent * 2

  // Aura opacity by tier
  const auraOpacity = tier === 'gold' ? 0.85 : 0.45

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* Aura layer (behind avatar) */}
      {auraActive && ringColor && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: auraSize,
            height: auraSize,
            top: -auraExtent,
            left: -auraExtent,
            background: `radial-gradient(circle, ${ringColor}cc 0%, ${ringColor}55 35%, ${ringColor}00 70%)`,
            filter: `blur(${tier === 'gold' ? 5 : 3}px)`,
            opacity: auraOpacity,
            zIndex: 0,
          }}
          animate={{
            scale: [1, 1.05, 1],
            opacity: [auraOpacity, auraOpacity * 1.18, auraOpacity],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Secondary subtle inner glow ring for gold */}
      {tier === 'gold' && ringColor && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size + 6,
            height: size + 6,
            top: -3,
            left: -3,
            background: `radial-gradient(circle, ${ringColor}00 55%, ${ringColor}88 70%, ${ringColor}00 82%)`,
            filter: 'blur(2px)',
            opacity: 0.6,
            zIndex: 0,
          }}
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.5, 0.8, 0.5],
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

      {/* The actual avatar with ring */}
      <Avatar
        className="relative z-10 border-2"
        style={{
          width: size,
          height: size,
          borderColor: ringColor || 'transparent',
          boxShadow: ringColor
            ? tier === 'gold'
              ? `0 0 0 1px ${ringColor}, 0 0 8px ${ringColor}aa`
              : tier === 'silver'
                ? `0 0 0 1px ${ringColor}aa, 0 0 4px ${ringColor}66`
                : `0 0 0 1px ${ringColor}aa`
            : undefined,
        }}
      >
        {user?.avatar && <AvatarImage src={user.avatar} alt={user.name || ''} />}
        <AvatarFallback
          className="bg-primary/10 text-primary"
          style={{ fontSize: Math.max(12, Math.round(size * 0.4)) }}
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
