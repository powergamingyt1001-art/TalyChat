'use client'

import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
  hidden?: boolean
}

/**
 * Floating AI Agent — F5-9 Radiation Glow
 *
 * Four concentric rings expanding outward like radiation waves, plus a
 * steady "core" pulse. The outer ring is VERY dark green (#022c22) and
 * 250px in diameter so the glow reaches 80-100px beyond the 48px avatar.
 *
 *   1. OUTER  — very dark green  (250px, blur 12px, 1.5s cycle, no delay)
 *   2. MIDDLE — dark green       (180px, blur 6px,  1.5s cycle, 0.2s delay)
 *   3. INNER  — parrot green     (120px, blur 3px,  1.5s cycle, 0.4s delay)
 *   4. CORE   — light green      (80px,  blur 1.5px, steady pulse 1.5s)
 *
 * F5-9 fixes vs. R8-11:
 *   • The avatar image is ALWAYS on top (z-30) and SHARP — it never
 *     scales or flips, eliminating the "green goes up, image goes down,
 *     88-shape" bug that happened when entering a chat.
 *   • Outer glow is 250px (was ~86px) so the aura extends 80-100px
 *     beyond the avatar (was ~50px).
 *   • Dark green is #022c22 (very dark, was lighter green).
 *   • Animation is 1.5s (was 3.6s for the outer ring).
 *   • CSS @keyframes (in globals.css) power the rings — pure CSS for
 *     performance, no React re-renders.
 *   • Container uses `overflow-visible` so the large glow isn't clipped.
 *
 * Fixed bottom-right, above the bottom nav. Hidden when in chat view
 * (parent passes hidden=true).
 */
export function FloatingAIAgent({ onClick, hidden }: Props) {
  // F5-9 — Return null (not an empty motion.button) when hidden so the
  // glow animation doesn't run in the background and there's nothing
  // for the layout to position. This is what fixes the "color flips /
  // 88-shape" bug when re-entering the chat: the component fully
  // unmounts and remounts cleanly, so the next time it renders the
  // rings + image start in the correct positions.
  if (hidden) return null

  return (
    <motion.button
      onClick={onClick}
      aria-label="Ask Taly Support AI"
      // F5-9 — Container is 64x64 (matches avatar + small padding).
      // overflow-visible so the 250px outer glow can extend FAR beyond
      // the button bounds without being clipped. z-40 keeps the floating
      // agent above page content but below modals/dialogs.
      className="fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center overflow-visible rounded-full md:bottom-6 md:right-6"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
    >
      {/* =========================================================
          Radiation glow rings (CSS keyframes — see globals.css).
          Each ring is absolutely positioned + centered (translate
          -50% -50%) so it stays centered on the avatar while it
          scales outward. The rings do NOT touch the avatar image —
          they're behind it (z-index 1-4 vs. image's z-30).
          ========================================================= */}
      <span aria-hidden className="floating-ai-glow floating-ai-glow-outer" />
      <span aria-hidden className="floating-ai-glow floating-ai-glow-middle" />
      <span aria-hidden className="floating-ai-glow floating-ai-glow-inner" />
      <span aria-hidden className="floating-ai-glow floating-ai-glow-core" />

      {/* =========================================================
          Avatar image — SHARP, on top (z-30), never flips or scales.
          Positioned absolute + centered so it stays put while the
          glow rings expand around it. The emerald ring + drop shadow
          anchor it visually so the radiation reads as emanating FROM
          the avatar.
          ========================================================= */}
      <img
        src="/ai-agent.png"
        alt="Taly AI"
        className="absolute left-1/2 top-1/2 z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover shadow-lg ring-2 ring-emerald-400/70"
      />

      {/* Small "AI" badge below the avatar — z-40 so it sits above the
          image but below modal overlays. */}
      <span className="absolute -bottom-1 left-1/2 z-40 -translate-x-1/2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
        AI
      </span>
    </motion.button>
  )
}
