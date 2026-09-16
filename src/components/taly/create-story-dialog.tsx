'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  Type,
  Upload,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { apiFetch, apiUpload, ApiError } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// CreateStoryDialog
// ============================================================
// Two-tab dialog (Text | Image) to compose a new 24h story.
// Posts to /api/stories with type='text' or 'image'.

interface CreateStoryProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

// 6 preset bg colors per task spec
const BG_PRESETS: Array<{
  key: string
  bg: string
  text: string
  label: string
  ring: string
}> = [
  {
    key: 'emerald',
    bg: '#10b981',
    text: '#ffffff',
    label: 'Emerald',
    ring: 'ring-emerald-500',
  },
  {
    key: 'blue',
    bg: '#3b82f6',
    text: '#ffffff',
    label: 'Blue',
    ring: 'ring-blue-500',
  },
  {
    key: 'purple',
    bg: '#8b5cf6',
    text: '#ffffff',
    label: 'Purple',
    ring: 'ring-violet-500',
  },
  {
    key: 'pink',
    bg: '#ec4899',
    text: '#ffffff',
    label: 'Pink',
    ring: 'ring-pink-500',
  },
  {
    key: 'orange',
    bg: '#f97316',
    text: '#ffffff',
    label: 'Orange',
    ring: 'ring-orange-500',
  },
  {
    key: 'dark',
    bg: '#1f2937',
    text: '#ffffff',
    label: 'Dark',
    ring: 'ring-zinc-500',
  },
]

export function CreateStoryDialog({ open, onClose, onCreated }: CreateStoryProps) {
  const { toast } = useToast()
  const [tab, setTab] = React.useState<'text' | 'image'>('text')

  // Text tab state
  const [text, setText] = React.useState('')
  const [bgIdx, setBgIdx] = React.useState(0)

  // Image tab state
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [caption, setCaption] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [posting, setPosting] = React.useState(false)

  const resetState = () => {
    setText('')
    setBgIdx(0)
    setImageUrl(null)
    setCaption('')
    setUploading(false)
    setPosting(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) resetState()
  }, [open])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const res: any = await apiUpload('/api/upload', file, 'file')
      if (!res?.url) throw new Error('Upload did not return a URL')
      setImageUrl(res.url)
      toast({ title: 'Image uploaded' })
    } catch (err: any) {
      const e = err as ApiError
      toast({
        title: e?.message || 'Image upload failed',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePost = async () => {
    if (posting) return
    setPosting(true)
    try {
      if (tab === 'text') {
        if (!text.trim()) {
          toast({ title: 'Please write some text first', variant: 'destructive' })
          setPosting(false)
          return
        }
        const preset = BG_PRESETS[bgIdx]
        await apiFetch('/api/stories', {
          method: 'POST',
          body: JSON.stringify({
            type: 'text',
            content: text.trim(),
            bgColor: preset.bg,
            textColor: preset.text,
          }),
        })
      } else {
        if (!imageUrl) {
          toast({ title: 'Please upload an image first', variant: 'destructive' })
          setPosting(false)
          return
        }
        await apiFetch('/api/stories', {
          method: 'POST',
          body: JSON.stringify({
            type: 'image',
            content: imageUrl,
            caption: caption.trim() || null,
          }),
        })
      }
      toast({ title: 'Story posted! It will expire in 24h.' })
      // Notify other connected clients (and our other sessions) that a new
      // story was created so the Home screen refetches its stories list.
      try {
        getSocket()?.emit('story:new', {})
      } catch {}
      handleClose()
      onCreated()
    } catch (err: any) {
      const e = err as ApiError
      toast({
        title: e?.message || 'Failed to post story',
        variant: 'destructive',
      })
    } finally {
      setPosting(false)
    }
  }

  const preset = BG_PRESETS[bgIdx]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b p-4 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5 text-primary" /> New Story
          </DialogTitle>
          <DialogDescription>
            Stories disappear after 24 hours.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'text' | 'image')}
          className="flex flex-col gap-3 p-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="min-h-[40px]">
              <Type className="mr-1 h-4 w-4" /> Text
            </TabsTrigger>
            <TabsTrigger value="image" className="min-h-[40px]">
              <ImageIcon className="mr-1 h-4 w-4" /> Image
            </TabsTrigger>
          </TabsList>

          {/* TEXT TAB */}
          <TabsContent value="text" className="flex flex-col gap-3">
            {/* Live preview */}
            <motion.div
              key={preset.key + (text.length > 80 ? 'l' : 's')}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-xl p-4"
              style={{ background: preset.bg }}
            >
              <p
                className="whitespace-pre-wrap break-words text-center text-lg font-semibold leading-snug"
                style={{ color: preset.text }}
              >
                {text.trim() || 'Your story preview will look like this ✨'}
              </p>
              <span className="absolute bottom-2 right-3 text-[10px] font-medium uppercase tracking-wide opacity-60"
                style={{ color: preset.text }}
              >
                Preview
              </span>
            </motion.div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 500))}
              placeholder="What's on your mind?"
              maxLength={500}
              className="min-h-[80px] resize-none"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pick a background</span>
              <span>{text.length}/500</span>
            </div>

            {/* BG presets */}
            <div className="grid grid-cols-6 gap-2">
              {BG_PRESETS.map((p, i) => (
                <button
                  key={p.key}
                  onClick={() => setBgIdx(i)}
                  aria-label={p.label}
                  className={`relative h-9 w-full rounded-lg ring-2 transition ${
                    i === bgIdx
                      ? `${p.ring} ring-offset-2 ring-offset-background`
                      : 'ring-transparent hover:ring-foreground/20'
                  }`}
                  style={{ background: p.bg }}
                />
              ))}
            </div>
          </TabsContent>

          {/* IMAGE TAB */}
          <TabsContent value="image" className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />

            {imageUrl ? (
              <div className="relative overflow-hidden rounded-xl">
                <img
                  src={imageUrl}
                  alt="Story preview"
                  className="max-h-64 w-full object-contain bg-black"
                />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/80"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                <span className="text-sm font-medium">
                  {uploading ? 'Uploading…' : 'Tap to upload an image'}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  PNG / JPG / GIF · up to 8MB
                </span>
              </button>
            )}

            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 280))}
              placeholder="Caption (optional)"
              maxLength={280}
              disabled={!imageUrl}
              className="min-h-[44px]"
            />
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 border-t p-4 pt-3">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={posting}
            className="min-h-[44px] flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            disabled={posting || (tab === 'text' ? !text.trim() : !imageUrl)}
            className="btn-brand min-h-[44px] flex-1"
          >
            {posting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-1 h-4 w-4" />
            )}
            Post Story
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
