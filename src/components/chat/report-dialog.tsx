'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'

const REASONS = ['Spam', 'Harassment', 'Scam', 'Illegal', 'Fake', 'Other'] as const
type Reason = (typeof REASONS)[number]

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The user being reported (for private chats). */
  reportedUserId?: string | null
  /** The group being reported (for group chats). */
  reportedGroupId?: string | null
  /** Optional name for the dialog title. */
  targetName?: string
}

/**
 * Report dialog — submits to POST /api/reports with the given target id.
 */
export function ReportDialog({
  open,
  onOpenChange,
  reportedUserId,
  reportedGroupId,
  targetName,
}: ReportDialogProps) {
  const { toast } = useToast()
  const [reason, setReason] = React.useState<Reason | ''>('')
  const [description, setDescription] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setReason('')
      setDescription('')
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: 'Select a reason', variant: 'destructive' })
      return
    }
    if (!reportedUserId && !reportedGroupId) {
      toast({ title: 'Nothing to report', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUserId: reportedUserId || undefined,
          reportedGroupId: reportedGroupId || undefined,
          reason,
          description: description.trim() || undefined,
        }),
      })
      toast({ title: 'Report submitted. Thank you.' })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: e.message || 'Failed to submit report', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Report {targetName ? targetName : 'this ' + (reportedGroupId ? 'group' : 'user')}
          </DialogTitle>
          <DialogDescription>
            Help keep TalyChat safe. False reports may lead to action against your account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={
                'min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
                (reason === r
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent')
              }
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-description">Description (optional)</Label>
          <Textarea
            id="report-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide any additional context…"
            rows={3}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} variant="destructive">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
