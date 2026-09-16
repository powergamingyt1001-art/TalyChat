'use client'

// SoundManager — generates UI sound effects using the Web Audio API.
//
// No audio files needed: every sound is a short oscillator sequence with an
// ADSR-ish gain envelope. The manager is a singleton (so the AudioContext is
// only created once and reused), and it respects two localStorage-backed
// settings:
//
//   - talychat-sound-enabled  ('true' | 'false')  — master on/off
//   - talychat-sound-volume   (0..1)               — master volume
//
// All sounds are *intentionally* triggered from user interaction events
// (incoming socket message, button click, form submit). The AudioContext is
// created lazily on the first call to any play* method, which keeps it inside
// the user-gesture window required by Chrome/Safari autoplay policies.

const LS_ENABLED = 'talychat-sound-enabled'
const LS_VOLUME = 'talychat-sound-volume'

export type SoundEventName =
  | 'message'
  | 'notification'
  | 'send'
  | 'reward'
  | 'premium'

interface ToneOptions {
  freq: number
  /** Duration in seconds. */
  duration: number
  /** Start time offset (seconds, relative to "now"). */
  startOffset?: number
  /** Gain (0..1) — multiplied by master volume. */
  gain?: number
  /** Oscillator type. */
  type?: OscillatorType
  /** Optional glide to a second frequency. */
  glideTo?: number
  /** Attack time (s). */
  attack?: number
  /** Release time (s). */
  release?: number
}

function lsGetBool(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    if (v === null) return fallback
    return v === 'true'
  } catch {
    return fallback
  }
}

function lsGetNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    if (v === null) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function lsSetBool(key: string, v: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(v))
  } catch {
    /* ignore */
  }
}

function lsSetNumber(key: string, v: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(v))
  } catch {
    /* ignore */
  }
}

export class SoundManager {
  private ctx: AudioContext | null = null
  private _enabled: boolean
  private _volume: number

  constructor() {
    this._enabled = lsGetBool(LS_ENABLED, true)
    this._volume = lsGetNumber(LS_VOLUME, 0.6)
  }

  // ----- public state -----

  get enabled(): boolean {
    return this._enabled
  }

  get volume(): number {
    return this._volume
  }

  setEnabled(v: boolean) {
    this._enabled = v
    lsSetBool(LS_ENABLED, v)
  }

  setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v))
    this._volume = clamped
    lsSetNumber(LS_VOLUME, clamped)
  }

  // ----- audio context -----

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      try {
        this.ctx = new Ctor()
      } catch {
        return null
      }
    }
    // Safari/Chrome start the context in "suspended" state until a user
    // gesture has occurred. resume() is a no-op if already running.
    if (this.ctx.state === 'suspended') {
      // Fire-and-forget — the await is intentional but we don't block on it.
      void this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * Try to unlock the AudioContext. Safe to call from a top-level user
   * gesture (e.g. on first click anywhere in the app). It is also called
   * implicitly by every play* method, so calling this manually is optional.
   */
  unlock() {
    this.ensureContext()
  }

  // ----- primitive tone -----

  private playTone(ctx: AudioContext, opts: ToneOptions) {
    const {
      freq,
      duration,
      startOffset = 0,
      gain = 0.3,
      type = 'sine',
      glideTo,
      attack = 0.005,
      release = 0.08,
    } = opts

    const t0 = ctx.currentTime + startOffset
    const t1 = t0 + duration
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo && glideTo !== freq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, glideTo),
        t0 + duration,
      )
    }

    const g = ctx.createGain()
    // Master volume multiplies per-tone gain.
    const peak = Math.max(0, Math.min(1, gain * this._volume))
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack)
    g.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(t0 + attack, t1 - release))
    g.gain.exponentialRampToValueAtTime(0.0001, t1)

    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }

  /**
   * Internal: play a sequence of tones (an "event"). No-ops if disabled.
   * Resolves after the last tone has been scheduled (not after it finishes).
   */
  private play(event: SoundEventName) {
    if (!this._enabled) return
    const ctx = this.ensureContext()
    if (!ctx) return

    switch (event) {
      case 'message':
        // Short pleasant two-note "ding" (rising fifth).
        this.playTone(ctx, {
          freq: 880,
          duration: 0.12,
          gain: 0.25,
          type: 'sine',
          startOffset: 0,
        })
        this.playTone(ctx, {
          freq: 1320,
          duration: 0.16,
          gain: 0.22,
          type: 'sine',
          startOffset: 0.08,
        })
        break

      case 'notification':
        // Soft chime — two slightly overlapping sine tones.
        this.playTone(ctx, {
          freq: 660,
          duration: 0.18,
          gain: 0.22,
          type: 'sine',
        })
        this.playTone(ctx, {
          freq: 990,
          duration: 0.22,
          gain: 0.18,
          type: 'triangle',
          startOffset: 0.1,
        })
        break

      case 'send':
        // Subtle pop — a short downward blip.
        this.playTone(ctx, {
          freq: 720,
          duration: 0.08,
          gain: 0.18,
          type: 'sine',
          glideTo: 480,
          attack: 0.002,
          release: 0.06,
        })
        break

      case 'reward':
        // Celebratory arpeggio — C-E-G-C (523, 659, 784, 1046).
        const rewardFreqs = [523.25, 659.25, 783.99, 1046.5]
        rewardFreqs.forEach((f, i) => {
          this.playTone(ctx, {
            freq: f,
            duration: 0.18,
            gain: 0.22,
            type: 'triangle',
            startOffset: i * 0.09,
            attack: 0.004,
            release: 0.1,
          })
        })
        break

      case 'premium':
        // Fanfare — ascending major triad + a high sustain.
        const premFreqs = [523.25, 659.25, 783.99]
        premFreqs.forEach((f, i) => {
          this.playTone(ctx, {
            freq: f,
            duration: 0.14,
            gain: 0.22,
            type: 'sawtooth',
            startOffset: i * 0.08,
            attack: 0.005,
            release: 0.08,
          })
        })
        this.playTone(ctx, {
          freq: 1046.5,
          duration: 0.5,
          gain: 0.22,
          type: 'triangle',
          startOffset: 0.28,
          attack: 0.01,
          release: 0.3,
        })
        // Low anchor for warmth.
        this.playTone(ctx, {
          freq: 261.63,
          duration: 0.6,
          gain: 0.15,
          type: 'sine',
          startOffset: 0.05,
          attack: 0.01,
          release: 0.4,
        })
        break
    }
  }

  // ----- public event helpers -----

  playMessage() {
    this.play('message')
  }

  playNotification() {
    this.play('notification')
  }

  playSend() {
    this.play('send')
  }

  playReward() {
    this.play('reward')
  }

  playPremium() {
    this.play('premium')
  }
}

// Singleton — every import gets the same instance + AudioContext.
let _instance: SoundManager | null = null

export function getSoundManager(): SoundManager {
  if (!_instance) {
    _instance = new SoundManager()
  }
  return _instance
}

// For tests / hot-reload safety — re-reads localStorage next time the
// singleton is requested.
export function __resetSoundManager() {
  _instance = null
}
