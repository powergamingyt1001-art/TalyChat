'use client'

import * as React from 'react'
import {
  Download,
  FileJson,
  FileText,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-store'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

// ============================================================
// ExportChatDialog
// ============================================================
// Lets the user export the current conversation's message history
// as a downloadable file (JSON or readable text transcript). Uses
// `fetch` with the `x-user-id` auth header to download a Blob, then
// creates an object URL + temporary <a> element to trigger the file
// download in the browser.
//
// Backend: GET /api/conversations/:id/export?format=json|txt
// ============================================================

interface ExportChatDialogProps {
  open: boolean
  onClose: () => void
  conversationId: string
  conversationName: string
}

type ExportFormat = 'json' | 'txt'

interface FormatOption {
  value: ExportFormat
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string }>
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'json',
    title: 'JSON',
    description: 'Full data — all messages, senders, reactions, timestamps. Best for backup & restore.',
    Icon: FileJson,
  },
  {
    value: 'txt',
    title: 'Text transcript',
    description: 'Readable chat log — like a chat transcript. Best for sharing or printing.',
    Icon: FileText,
  },
]

export function ExportChatDialog({
  open,
  onClose,
  conversationId,
  conversationName,
}: ExportChatDialogProps) {
  const { toast } = useToast()
  const token = useAuth((s) => s.token)
  const [format, setFormat] = React.useState<ExportFormat>('json')
  const [exporting, setExporting] = React.useState(false)

  // Reset to default when dialog reopens.
  React.useEffect(() => {
    if (open) {
      setFormat('json')
      setExporting(false)
    }
  }, [open])

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/export?format=${format}`,
        {
          method: 'GET',
          headers: token ? { 'x-user-id': token } : {},
        }
      )
      if (!res.ok) {
        // Try to parse an error message from the JSON body.
        let msg = res.statusText || 'Export failed'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {
          // ignore — fall back to statusText
        }
        throw new ApiError(msg, res.status)
      }

      const blob = await res.blob()
      // Determine filename from Content-Disposition if available; otherwise
      // fall back to a sensible name based on the conversation name.
      let filename = `talychat-export-${(conversationName || 'conversation')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 60) || 'conversation'}.${format === 'json' ? 'json' : 'txt'}`
      const cd = res.headers.get('Content-Disposition')
      if (cd) {
        const match = cd.match(/filename="?([^";]+)"?/i)
        if (match && match[1]) filename = match[1]
      }

      // Trigger the browser download via an object URL.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Give the browser a beat to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      toast({ title: 'Chat exported successfully' })
      onClose()
    } catch (e: any) {
      const err = e as ApiError
      toast({
        title: err?.message || 'Failed to export chat',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Export chat
          </DialogTitle>
          <DialogDescription>
            Download your conversation with{' '}
            <span className="font-medium text-foreground">
              {conversationName || 'this chat'}
            </span>
            . Includes up to 1000 most recent messages.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <RadioGroup
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
            className="gap-3"
          >
            {FORMAT_OPTIONS.map((opt) => {
              const checked = format === opt.value
              return (
                <Label
                  key={opt.value}
                  htmlFor={`export-fmt-${opt.value}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                    checked
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border hover:bg-accent/40'
                  )}
                >
                  <RadioGroupItem
                    id={`export-fmt-${opt.value}`}
                    value={opt.value}
                    className="mt-1"
                  />
                  <opt.Icon
                    className={cn(
                      'mt-0.5 h-6 w-6 shrink-0',
                      checked ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={exporting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="btn-brand min-h-[44px]"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
