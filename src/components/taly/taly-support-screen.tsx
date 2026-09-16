'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-store'
import { apiFetch, ApiError } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Send, Sparkles, Loader2 } from 'lucide-react'

interface Props {
  onBack: () => void
}

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  content: string
}

// R8-11 — New support tagline replaces the old "Official AI Assistant —
// by Omkar Panday" subtitle. The title "Taly Support" stays, but the bot
// icon is replaced with the AI agent image (/ai-agent.png).
const SUPPORT_TAGLINE = 'Your 24/7 support companion — here to help!'

const INITIAL_MESSAGE =
  "Hi! I'm Taly Support, your 24/7 support companion. Ask me anything about TalyChat! \u{1F44B}"

const QUICK_PROMPTS = [
  'How to create a group?',
  'Privacy settings?',
  'Premium features?',
  'How to mute a chat?',
]

let idCounter = 0
const nextId = () => `msg-${Date.now()}-${++idCounter}`

export function TalySupportScreen({ onBack }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  // Ref to the ScrollArea's inner viewport element (the actual scrollable element).
  // Radix ScrollArea wraps children in a Viewport — we grab it via querySelector.
  const scrollRootRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const [messages, setMessages] = React.useState<ChatMessage[]>([
    { id: nextId(), role: 'assistant', content: INITIAL_MESSAGE },
  ])
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)

  // Auto-scroll to bottom when messages or typing state change.
  // The ScrollArea viewport is queried at effect-run time so we always
  // have the live element even after re-mounts.
  React.useEffect(() => {
    const root = scrollRootRef.current
    if (!root) return
    const viewport = root.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [messages, sending])

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || sending) return
    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const history = messages
      .filter((m) => m.content && m.content !== INITIAL_MESSAGE)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const res: any = await apiFetch('/api/taly-support', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      })
      // Defensive: API returns flat { reply, conversationId, requestCreated }.
      // Fall back through a few possible wrapper keys just in case.
      const reply: string | undefined =
        res?.reply || res?.message || res?.content || res?.data?.reply
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: reply || 'Sorry, I could not generate a response.',
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (e: any) {
      const err = e as ApiError
      if (err?.status === 429) {
        toast({
          title: 'Rate limit exceeded. Try in 60s.',
          variant: 'destructive',
        })
      } else {
        toast({ title: err?.message || 'Taly Support error', variant: 'destructive' })
      }
    } finally {
      setSending(false)
      // Refocus input on next tick
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-stretch justify-center bg-background">
      <div className="flex w-full max-w-2xl flex-col border-x bg-background">
        {/* Header — R8-11: Taly Support title with AI agent image (instead
            of the old Bot icon) + new 24/7 support companion tagline. */}
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9 shrink-0 overflow-hidden ring-2 ring-emerald-500/30">
            <AvatarImage src="/ai-agent.png" alt="Taly AI" />
            <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">Taly Support</h1>
            <p className="truncate text-xs text-muted-foreground">{SUPPORT_TAGLINE}</p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        </header>

        {/* Messages — ScrollArea wraps a content div; the actual scroller is the viewport */}
        <ScrollArea
          ref={scrollRootRef}
          className="scroll-pan-y min-h-0 flex-1"
        >
          <div className="flex flex-col gap-3 p-4">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} user={user} />
              ))}
            </AnimatePresence>
            {sending && <TypingIndicator />}
          </div>
        </ScrollArea>

        {/* Quick prompts */}
        <div className="shrink-0 overflow-x-auto border-t bg-background px-2 pt-2 scroll-pan-y">
          <div className="flex gap-2 pb-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => void send(q)}
                className="min-h-[36px] shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t bg-background p-2">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask Taly Support anything…"
              disabled={sending}
              className="min-h-[44px] flex-1"
              aria-label="Message Taly Support"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="btn-brand h-11 w-11 shrink-0"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Message bubble
// ============================================================

function MessageBubble({
  message,
  user,
}: {
  message: ChatMessage
  user: { name?: string; username?: string; avatar?: string | null } | null
}) {
  const isUser = message.role === 'user'
  const initial = (user?.name || user?.username || 'U').charAt(0).toUpperCase()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex w-full items-end gap-2 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <Avatar className="h-7 w-7 shrink-0 overflow-hidden ring-2 ring-emerald-500/30">
          <AvatarImage src="/ai-agent.png" alt="Taly AI" />
          <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
            <Sparkles className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`bubble-content max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'rounded-bl-sm border bg-card text-card-foreground'
        }`}
      >
        {message.content}
      </div>
      {isUser && (
        <Avatar className="h-7 w-7 shrink-0 bg-primary">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  )
}

// ============================================================
// Typing indicator (3 dots)
// ============================================================

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2"
    >
      <Avatar className="h-7 w-7 shrink-0 overflow-hidden ring-2 ring-emerald-500/30">
        <AvatarImage src="/ai-agent.png" alt="Taly AI" />
        <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
          <Sparkles className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex gap-1 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
