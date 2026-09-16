'use client'

import { Bell, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useSound } from '@/hooks/use-sound'

/**
 * SoundTogglePopover — a small button + popover used by the MobileTopBar and
 * DesktopSidebar. Renders a sound bell icon (with a "muted" strike when sound
 * is off), and on click opens a popover with:
 *
 *   - a sound on/off switch
 *   - a volume slider (0..100%)
 *   - a tiny "Test" button that plays the message ding so the user can
 *     preview the new volume live.
 *
 * The volume slider updates the SoundManager in real-time (no debounce), so
 * moving it makes the next test ping louder/softer immediately.
 */
export function SoundTogglePopover() {
  const { play, enabled, setEnabled, volume, setVolume } = useSound()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={enabled ? 'Sound settings' : 'Sound is off'}
          className="relative h-9 w-9"
        >
          {enabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Sounds</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <Label htmlFor="sound-enabled" className="text-sm">
            {enabled ? 'On' : 'Off'}
          </Label>
          <Switch
            id="sound-enabled"
            checked={enabled}
            onCheckedChange={(v) => setEnabled(v)}
          />
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Volume</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(volume * 100)]}
            min={0}
            max={100}
            step={1}
            disabled={!enabled}
            onValueChange={(v) => {
              const next = (Array.isArray(v) ? v[0] : v) ?? 0
              setVolume(next / 100)
            }}
            aria-label="Sound volume"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!enabled}
          className="mt-3 w-full min-h-[36px]"
          onClick={() => {
            // Touch the AudioContext inside the user gesture so Safari/Chrome
            // allow subsequent background sounds (socket-driven message ding).
            play.unlock()
            play.playMessage()
          }}
        >
          Test sound
        </Button>
      </PopoverContent>
    </Popover>
  )
}
