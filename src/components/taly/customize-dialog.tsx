'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CustomizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId?: string
  isGroup?: boolean
}

/**
 * Minimal stub for CustomizeDialog.
 *
 * The full-featured Customize dialog (wallpaper picker, message style,
 * font family, font size) is being implemented by another agent.
 * This stub keeps the import path stable so ChatView can render the
 * trigger and not crash when the real dialog isn't ready yet.
 *
 * Replace this stub with the full implementation (Task 3-d or similar).
 */
export function CustomizeDialog({
  open,
  onOpenChange,
  isGroup,
}: CustomizeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Customize {isGroup ? 'Group' : 'Chat'}
          </DialogTitle>
          <DialogDescription>
            Coming soon — wallpaper, message style, font and font size
            controls will appear here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          Customization options are on the way.
        </div>
      </DialogContent>
    </Dialog>
  )
}
