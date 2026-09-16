'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Loader2 } from 'lucide-react'
import { formatDuration } from './chat-helpers'
import { cn } from '@/lib/utils'

interface VoiceMessageProps {
  mediaUrl: string
  voiceDuration?: number | null
  isMine: boolean
  /** Used as a seed for deterministic waveform generation. */
  messageId?: string
  /** Stop click propagation so the bubble's dropdown doesn't toggle on play/pause. */
  stopPropagation?: boolean
  className?: string
}

const WAVEFORM_BARS = 36
const MIN_BAR_H = 4
const MAX_BAR_H = 24

/**
 * Generate a deterministic pseudo-random waveform based on a seed string.
 * Each unique seed (e.g. message ID) produces a stable, repeatable waveform
 * so re-renders don't reshuffle the bars.
 */
function generateWaveform(seed: string, bars: number = WAVEFORM_BARS): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const heights: number[] = []
  for (let i = 0; i < bars; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    const normalized = (hash % 1000) / 1000
    // Skew toward middle-height bars (more natural looking)
    heights.push(0.3 + normalized * 0.7)
  }
  return heights
}

/**
 * Renders a voice message bubble: play/pause button, waveform visualization,
 * and duration. Uses HTML5 <audio>. The waveform is a deterministic
 * pseudo-random pattern based on the message ID — clicking a bar seeks
 * to that position. Played bars are emerald; unplayed bars are muted gray.
 * The current bar pulses subtly while playing.
 */
export function VoiceMessage({
  mediaUrl,
  voiceDuration,
  isMine,
  messageId,
  stopPropagation = true,
  className,
}: VoiceMessageProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0) // 0..1
  const [current, setCurrent] = React.useState(0) // seconds
  const [duration, setDuration] = React.useState<number>(voiceDuration || 0)
  const [loading, setLoading] = React.useState(false)

  // Seed = messageId (preferred) → fallback to mediaUrl → fallback to constant.
  const seed = messageId || mediaUrl || 'voice-message'
  const waveform = React.useMemo(() => generateWaveform(seed), [seed])

  // Resolve a full URL if mediaUrl is relative.
  const src = React.useMemo(() => {
    if (!mediaUrl) return ''
    if (
      mediaUrl.startsWith('http') ||
      mediaUrl.startsWith('blob:') ||
      mediaUrl.startsWith('data:')
    ) {
      return mediaUrl
    }
    return mediaUrl
  }, [mediaUrl])

  // Stop on unmount
  React.useEffect(() => {
    const audio = audioRef.current
    return () => {
      try {
        audio?.pause()
      } catch {}
    }
  }, [])

  const handleStop = (e?: React.SyntheticEvent) => {
    if (stopPropagation) {
      e?.stopPropagation()
      e?.preventDefault()
    }
  }

  const togglePlay = async (e: React.MouseEvent<HTMLButtonElement>) => {
    handleStop(e)
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    try {
      setLoading(true)
      // If progress was at end, reset to start.
      if (progress >= 1) {
        audio.currentTime = 0
        setProgress(0)
        setCurrent(0)
      }
      await audio.play()
      setPlaying(true)
    } catch {
      // Autoplay rejection / network error
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  const onTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    const c = audio.currentTime
    const d = audio.duration && isFinite(audio.duration) ? audio.duration : duration
    setCurrent(c)
    if (d > 0) setProgress(Math.min(1, c / d))
  }

  const onLoadedMetadata = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.duration && isFinite(audio.duration)) {
      setDuration(audio.duration)
    }
  }

  const onEnded = () => {
    setPlaying(false)
    setProgress(0)
    setCurrent(0)
  }

  // Clicking a waveform bar seeks to that bar's position.
  const seekToBar = (index: number, e: React.MouseEvent) => {
    handleStop(e)
    const audio = audioRef.current
    if (!audio || !duration || !waveform.length) return
    const ratio = (index + 0.5) / waveform.length
    const clamped = Math.min(1, Math.max(0, ratio))
    audio.currentTime = clamped * duration
    setProgress(clamped)
    setCurrent(clamped * duration)
  }

  // Index of the bar that represents the current playback position.
  const playedIndex = Math.floor(progress * waveform.length)
  const activeIndex = Math.min(waveform.length - 1, playedIndex)

  return (
    <div
      className={cn('flex items-center gap-2 min-w-[220px] max-w-full', className)}
      onClick={handleStop}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full min-h-[44px] min-w-[44px]',
          isMine
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-primary/15 text-primary hover:bg-primary/25'
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        {/* Waveform — clickable bars, played portion emerald, unplayed muted */}
        <div
          className="flex h-7 w-full items-center justify-between gap-[1px]"
          role="slider"
          aria-label="Voice message progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${current.toFixed(1)} of ${duration} seconds`}
        >
          {waveform.map((h, i) => {
            const height = MIN_BAR_H + (MAX_BAR_H - MIN_BAR_H) * h
            const isPlayed = i < playedIndex
            const isActive = i === activeIndex
            // Subtle pulse on the currently-playing bar.
            const pulse = playing && isActive
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => seekToBar(i, e)}
                aria-label={`Seek to ${Math.round(((i + 0.5) / waveform.length) * (duration || 0))} seconds`}
                className="flex h-7 min-h-[28px] min-w-[6px] flex-1 cursor-pointer items-center justify-center px-[1px]"
                tabIndex={-1}
              >
                <motion.span
                  className={cn(
                    'block w-[2px] rounded-full',
                    isPlayed
                      ? 'bg-emerald-500'
                      : isMine
                        ? 'bg-white/40'
                        : 'bg-black/25'
                  )}
                  style={{ height }}
                  // Highlight the current bar.
                  animate={
                    pulse
                      ? { scaleY: [1, 1.4, 1], opacity: [1, 0.7, 1] }
                      : { scaleY: 1, opacity: 1 }
                  }
                  transition={
                    pulse
                      ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.15 }
                  }
                  // Make the active bar slightly wider/bolder via outline.
                />
              </button>
            )
          })}
        </div>
        <div
          className={cn(
            'text-[11px] tabular-nums',
            isMine ? 'text-white/80' : 'text-muted-foreground'
          )}
        >
          {playing ? formatDuration(current) : formatDuration(duration)}
        </div>
      </div>
    </div>
  )
}
