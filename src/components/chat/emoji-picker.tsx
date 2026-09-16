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
 * A simple emoji picker shown in a Popover. Grid of common Unicode emojis
 * (smileys, hearts, hands, etc). No external emoji library — uses raw
 * Unicode characters.
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
        className={cn('w-[280px] max-w-[calc(100vw-1rem)] p-3', className)}
      >
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Emoji
        </div>
        <div className="grid max-h-[260px] grid-cols-8 gap-1 overflow-y-auto scroll-pan-y">
          {EMOJI_GRID.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePick(emoji)}
              className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded text-xl leading-none transition-colors hover:bg-accent"
              aria-label={`Insert ${emoji}`}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
