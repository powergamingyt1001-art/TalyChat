'use client'

import { motion } from 'framer-motion'

interface Props {
  onClick: () => void
  hidden?: boolean
}

/**
 * Floating AI Agent — Radial Green Energy Aura
 * Fixed bottom-right, above bottom nav, with breathing animation.
 * Hidden when in chat view (parent passes hidden=true).
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
      {/* Radial green aura — multiple layered transparent rings */}
      <div className="pointer-events-none absolute inset-0">
        {/* Outer glow — fades to transparent */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(5,150,105,0.25) 30%, rgba(4,120,87,0.15) 55%, rgba(0,0,0,0) 80%)',
            filter: 'blur(8px)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Middle aura */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.45) 0%, rgba(5,150,105,0.3) 40%, rgba(0,0,0,0) 70%)',
            filter: 'blur(4px)',
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
        {/* Inner saturated ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(6,95,70,0.6) 0%, rgba(5,150,105,0.4) 50%, rgba(0,0,0,0) 100%)',
          }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Avatar image — sharp, on top */}
      <motion.img
        src="/ai-agent.png"
        alt="Taly AI"
        className="relative z-10 h-12 w-12 rounded-full object-cover shadow-lg ring-2 ring-emerald-500/40"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Small "AI" badge */}
      <span className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
        AI
      </span>
    </motion.button>
  )
}
