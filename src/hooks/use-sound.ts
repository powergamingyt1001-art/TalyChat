'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSoundManager, SoundManager } from '@/lib/sounds'

/**
 * useSound — React binding for the global SoundManager singleton.
 *
 * Returns:
 *   - `play`        the SoundManager instance (call play.playMessage(), etc.)
 *   - `enabled`     boolean — whether sound is currently on
 *   - `setEnabled`   toggle sound on/off (persists to localStorage)
 *   - `volume`      0..1 master volume
 *   - `setVolume`   set master volume (persists to localStorage, takes effect immediately)
 *
 * The hook reads initial values from localStorage (via the singleton
 * constructor) and keeps React state in sync when toggled. The SoundManager
 * itself is a singleton, so all callers share the same volume / enabled
 * state.
 */
export function useSound() {
  const manager = getSoundManager()
  const [enabled, setEnabledState] = useState<boolean>(manager.enabled)
  const [volume, setVolumeState] = useState<number>(manager.volume)

  // On mount, ensure we're in sync with whatever the singleton thinks (in
  // case another component changed it before this one mounted).
  useEffect(() => {
    setEnabledState(manager.enabled)
    setVolumeState(manager.volume)
  }, [manager])

  const setEnabled = useCallback(
    (v: boolean) => {
      manager.setEnabled(v)
      setEnabledState(v)
    },
    [manager],
  )

  const setVolume = useCallback(
    (v: number) => {
      manager.setVolume(v)
      setVolumeState(v)
    },
    [manager],
  )

  return {
    play: manager as SoundManager,
    enabled,
    setEnabled,
    volume,
    setVolume,
  } as const
}
