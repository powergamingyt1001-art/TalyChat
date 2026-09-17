'use client'

import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
  hidden?: boolean
}

/**
 * Floating AI Agent — PRD-2 subtle green radiation glow
 *
 * Three concentric dark-green rings breathing gently behind the AI
 * avatar image. Calmer than the previous version (vibration reduced
 * 30% — scale 1.0 → 1.04 → 1.0 over a 2s cycle). Glow is capped at
 * ~30px beyond the 48px avatar (max 108px outer ring diameter), so
 * the radiation stays close to the avatar instead of spreading too
 * far ("dhamaaa" bug).
 *
 * Critical layout fix vs. earlier iterations:
 *   • The avatar image is in NORMAL flow (position: relative + z-30)
 *     and is centered by the parent's flex. It NEVER uses translate,
 *     so it can't flip into the "88-shape" / "image goes down while
 *     glow goes up" bug when entering a chat.
 *   • The glow rings are position: absolute (z-1 to z-3) and stay
 *     BEHIND the image, so the radiation reads as emanating from the
 *     avatar rather than swallowing it.
 *   • Darker green palette (inner = oklch 0.15, middle = oklch 0.25,
 *     outer = oklch 0.35) — close to avatar = darker, far = slightly
 *     lighter but never bright. No rainbow, just dark green.
 *
 * Fixed bottom-right, above the bottom nav. Returns null when hidden
 * (parent passes hidden=true) so the animation fully unmounts and
 * cleanly remounts next time — eliminating any residual transform
 * state.
 */
export function FloatingAIAgent({ onClick, hidden }: Props) {
  // PRD-2 — Return null (not an empty motion.button) when hidden so
  // the glow animation doesn't run in the background and there's
  // nothing for the layout to position. Fully unmounting means the
  // next mount starts with the rings + image in the correct places.
  if (hidden) return null

  return (
    <motion.button
      onClick={onClick}
      aria-label="Ask Taly Support AI"
      // Container is 64x64 (matches 48px avatar + small padding).
      // `overflow-visible` so the glow rings (108px max) aren't
      // clipped at the button bounds. z-40 keeps the floating agent
      // above page content but below modals/dialogs. The flex center
      // keeps the image centered; the absolutely-positioned glow
      // rings center themselves on the container too.
      className="fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center overflow-visible rounded-full md:bottom-6 md:right-6"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
    >
      {/* =========================================================
          Radiation glow rings (CSS keyframes — see globals.css).
          Each ring is absolutely positioned + centered via
          translate(-50%, -50%) so it stays centered on the avatar
          while it breathes. The rings do NOT touch the avatar
          image — they're behind it (z-1 to z-3 vs. image's z-30).
          ========================================================= */}
      <span aria-hidden className="floating-ai-glow floating-ai-glow-outer" />
      <span aria-hidden className="floating-ai-glow floating-ai-glow-middle" />
      <span aria-hidden className="floating-ai-glow floating-ai-glow-inner" />

      {/* =========================================================
          Avatar image — SHARP, on top (z-30), never flips or scales.
          `position: relative` keeps it in normal flow (no
          translate) so it can't drift / flip relative to the glow.
          The parent flex centers it; the rings center on the same
          container so the whole thing reads as one cohesive unit.
          ========================================================= */}
      <img
        src="/ai-agent.png"
        alt="Taly AI"
        className="relative z-30 h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-emerald-400/70"
      />

      {/* Small "AI" badge below the avatar. z-20 so it sits above
          the rings (z-1 to z-3) but does not overlap the image
          (z-30). Positioned with absolute so it doesn't shift the
          centered image. */}
      <span className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
        AI
      </span>
    </motion.button>
  )
}
