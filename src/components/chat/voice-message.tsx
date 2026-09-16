'use client'

import * as React from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { formatDuration } from './chat-helpers'
import { cn } from '@/lib/utils'

interface VoiceMessageProps {
  mediaUrl: string
  voiceDuration?: number | null
  isMine: boolean
  /** Stop click propagation so the bubble's dropdown doesn't toggle on play/pause. */
  stopPropagation?: boolean
  className?: string
}

/**
 * Renders a voice message bubble: play/pause button, progress bar, duration.
 * Uses HTML5 <audio>. Each instance has its own <audio> element and play state.
 */
export function VoiceMessage({
  mediaUrl,
  voiceDuration,
  isMine,
  stopPropagation = true,
  className,
}: VoiceMessageProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const [progress, setProgress] = React.useState(0) // 0..1
  const [current, setCurrent] = React.useState(0) // seconds
  const [duration, setDuration] = React.useState<number>(voiceDuration || 0)
  const [loading, setLoading] = React.useState(false)

  // Resolve a full URL if mediaUrl is relative.
  const src = React.useMemo(() => {
    if (!mediaUrl) return ''
    if (mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('data:')) {
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

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStop(e)
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setProgress(ratio)
    setCurrent(ratio * duration)
  }

  return (
    <div
      className={cn('flex items-center gap-2 min-w-[180px] max-w-full', className)}
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
        <div
          className="h-1.5 w-full cursor-pointer rounded-full bg-black/20"
          onClick={seek}
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${current} of ${duration} seconds`}
        >
          <div
            className={cn(
              'h-full rounded-full',
              isMine ? 'bg-white' : 'bg-primary'
            )}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
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
