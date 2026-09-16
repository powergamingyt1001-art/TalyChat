'use client'

import * as React from 'react'
import { Gift, Plus, Ticket, Ban, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type AdminRedeemCode,
  EmptyState,
  formatDate,
  truncate,
} from './admin-shared'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export function AdminRedeem() {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [codes, setCodes] = React.useState<AdminRedeemCode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [disablingId, setDisablingId] = React.useState<string | null>(null)

  // form state
  const [code, setCode] = React.useState('')
  const [months, setMonths] = React.useState('1')
  const [note, setNote] = React.useState('')
  const [count, setCount] = React.useState('1')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/api/admin/codes')
      setCodes(res?.codes || [])
    } catch (e: any) {
      toast({ title: 'Failed to load codes', description: e?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    const monthsNum = parseInt(months, 10)
    const countNum = parseInt(count, 10)
    if (!monthsNum || monthsNum < 1) {
      toast({ title: 'Months must be a positive integer', variant: 'destructive' })
      return
    }
    if (!countNum || countNum < 1 || countNum > 100) {
      toast({ title: 'Count must be between 1 and 100', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res: any = await apiFetch('/api/admin/codes', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim() || undefined,
          months: monthsNum,
          note: note.trim(),
          count: countNum,
        }),
      })
      const n = res?.count ?? 1
      toast({
        title: n === 1 ? 'Code created' : `${n} codes created`,
        description: n === 1 ? res?.created?.[0]?.code : undefined,
      })
      setCode('')
      setNote('')
      setCount('1')
      setMonths('1')
      load()
    } catch (e: any) {
      toast({ title: 'Failed to create code', description: e?.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const disable = async (id: string) => {
    setDisablingId(id)
    try {
      await apiFetch(`/api/admin/codes/${id}/disable`, { method: 'POST' })
      toast({ title: 'Code disabled' })
      load()
    } catch (e: any) {
      toast({ title: 'Failed to disable code', description: e?.message, variant: 'destructive' })
    } finally {
      setDisablingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold">Redeem Codes</h2>
        <p className="text-sm text-muted-foreground">Create and manage premium redeem codes</p>
      </div>

      {/* Create codes form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4 text-primary" /> Create code(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Code (optional)">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto-generated if blank"
                className="h-11"
              />
            </Field>
            <Field label="Premium months">
              <Input
                type="number"
                min={1}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Count (1–100)">
              <Input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Note">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal note"
                className="h-11"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Long note (optional)"
              className="min-h-[60px]"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button className="btn-brand h-11" onClick={submit} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create {parseInt(count, 10) > 1 ? `${count} codes` : 'code'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Codes list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="size-4 text-primary" /> All codes ({codes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <EmptyState title="No codes yet" hint="Create your first redeem code above" icon={Gift} />
          ) : isMobile ? (
            <div className="divide-y">
              {codes.map((c) => (
                <CodeCard key={c.id} code={c} onDisable={disable} disabling={disablingId === c.id} />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Months</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm font-semibold">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.premiumMonths}mo</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {truncate(c.note || '', 40)}
                    </TableCell>
                    <TableCell>
                      {c.isActive ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-semibold tabular-nums">{c.redemptionCount}</span>
                      {c.count > 1 && (
                        <span className="text-muted-foreground"> / {c.count}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!c.isActive || disablingId === c.id}
                        onClick={() => disable(c.id)}
                        className="h-9"
                      >
                        {disablingId === c.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Ban className="size-4" />
                        )}
                        Disable
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CodeCard({
  code,
  onDisable,
  disabling,
}: {
  code: AdminRedeemCode
  onDisable: (id: string) => void
  disabling: boolean
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{code.code}</span>
        {code.isActive ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {code.premiumMonths} month premium · {code.redemptionCount}/{code.count || 1} redemptions
      </p>
      {code.note && <p className="text-xs text-muted-foreground">{truncate(code.note, 80)}</p>}
      <p className="text-xs text-muted-foreground">Created {formatDate(code.createdAt)}</p>
      {code.isActive && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabling}
          onClick={() => onDisable(code.id)}
          className="h-11"
        >
          {disabling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
          Disable
        </Button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1')}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
