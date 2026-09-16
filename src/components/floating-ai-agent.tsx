'use client'

import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
  hidden?: boolean
}

/**
 * Floating AI Agent — R8-11 Radiation Glow
 *
 * Four layered radial gradients, each with its own blink / pulse animation,
 * create a "radiation" effect radiating outward from the AI agent image:
 *
 *   1. OUTER  — dark green  (slow blink, 3.6s)
 *   2. MIDDLE — green       (medium blink, 2.4s)
 *   3. INNER  — parrot green (fast blink, 1.5s)
 *   4. CORE   — light green (steady pulse, 1.2s)
 *
 * The AI agent image (/ai-agent.png) sits sharp in the center on top of
 * the glow stack. Fixed bottom-right, above the bottom nav, hidden when
 * in chat view (parent passes hidden=true).
 */
export function FloatingAIAgent({ onClick, hidden }: Props) {
  if (hidden) return null

  return (
    <motion.button
      onClick={onClick}
      aria-label="Ask Taly Support AI"
      className="fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full md:bottom-6 md:right-6"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
    >
      {/* =========================================================
          Layered radial-gradient glow stack (radiation effect).
          Each layer is positioned absolute inset-0 of the button
          (which is 64x64). The gradients are sized larger than the
          button (via blur + scale) so they radiate OUTSIDE the
          button bounds. Layers animate independently with different
          durations / delays so the eye reads it as an outward
          radiation, not a single pulse.
          ========================================================= */}

      {/* Layer 1 — OUTER: dark green, slow blink (3.6s) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(5,60,40,0.55) 0%, rgba(5,90,60,0.35) 35%, rgba(0,0,0,0) 75%)',
          filter: 'blur(10px)',
        }}
        animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0.85, 0.35] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Layer 2 — MIDDLE: green, medium blink (2.4s) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(16,140,90,0.55) 0%, rgba(10,160,105,0.35) 40%, rgba(0,0,0,0) 70%)',
          filter: 'blur(6px)',
        }}
        animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.95, 0.5] }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.25,
        }}
      />

      {/* Layer 3 — INNER: parrot green (#32cb34-ish), fast blink (1.5s) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(50,203,52,0.65) 0%, rgba(40,180,50,0.4) 50%, rgba(0,0,0,0) 100%)',
          filter: 'blur(3px)',
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.65, 1, 0.65] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.1,
        }}
      />

      {/* Layer 4 — CORE: light green, steady pulse (1.2s) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(170,255,170,0.85) 0%, rgba(120,240,140,0.4) 45%, rgba(0,0,0,0) 90%)',
          filter: 'blur(1.5px)',
        }}
        animate={{ scale: [0.85, 1.06, 0.85], opacity: [0.7, 1, 0.7] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.05,
        }}
      />

      {/* Avatar image — sharp, on top of all glow layers. The emerald ring
          + shadow anchor it visually so the radiation reads as emanating
          FROM the avatar. */}
      <motion.img
        src="/ai-agent.png"
        alt="Taly AI"
        className="relative z-10 h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-emerald-400/70"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Small "AI" badge */}
      <span className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
        AI
      </span>
    </motion.button>
  )
}
