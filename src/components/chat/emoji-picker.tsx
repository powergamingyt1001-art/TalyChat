'use client'

import * as React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EMOJI_GRID } from './chat-types'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
  children: React.ReactNode
  onPick: (emoji: string) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/**
 * Emoji picker shown in a Popover. Single flat scrollable grid of all 150
 * emojis from EMOJI_GRID. No category tabs or sliders. Every emoji renders
 * in a uniform 44px+ touch target so it's easy to tap on mobile.
 */
export function EmojiPicker({
  children,
  onPick,
  align = 'center',
  side = 'top',
  className,
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false)

  const handlePick = (emoji: string) => {
    onPick(emoji)
    // Keep open so user can pick multiple quickly, but it's simpler to close
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className={cn('w-[340px] max-w-[calc(100vw-1rem)] p-3', className)}
      >
        <div className="grid max-h-[320px] grid-cols-6 gap-1 overflow-y-auto scroll-pan-y pr-1">
          {EMOJI_GRID.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => handlePick(emoji)}
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-xl leading-none transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Insert ${emoji}`}
            >
              <span aria-hidden className="select-none">
                {emoji}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
