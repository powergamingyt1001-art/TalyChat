import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'

// Simple in-memory rate limit: 5 requests per 60 seconds per user
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): { limited: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { limited: false, retryAfter: 0 }
  }
  entry.count += 1
  if (entry.count > RATE_LIMIT_MAX) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { limited: false, retryAfter: 0 }
}

const SYSTEM_PROMPT =
  'You are Taly Support, the official AI assistant of TalyChat app (Founder: Omkar Panday). Reply in user language (English/Hindi/Hinglish). Be concise and helpful. You can help with: app usage, account, features, customization. For unlock requests, create an admin approval request.'

// POST /api/taly-support — Taly Support AI chat
// Body: { message, conversationId?, history? }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const { message, conversationId, history } = body || {}

    if (!message || typeof message !== 'string') {
      return jsonError(400, 'message is required')
    }

    // Rate limit check
    const rl = isRateLimited(user.id)
    if (rl.limited) {
      return jsonError(429, 'Rate limit exceeded. Try later.')
    }

    // If user mentions "unlock" or "approve", create a TalyRequest
    const lower = String(message).toLowerCase()
    if (lower.includes('unlock') || lower.includes('approve')) {
      await db.talyRequest.create({
        data: {
          userId: user.id,
          chatId: conversationId || null,
          request: String(message).slice(0, 1000),
          reason: 'Auto-detected from Taly Support chat',
          status: 'pending',
        },
      })
    }

    // Build message list for ZAI
    const safeHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = Array.isArray(history)
      ? history
          .filter((m: any) => m && typeof m.content === 'string')
          .slice(-10)
          .map((m: any) => ({
            role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
            content: String(m.content),
          }))
      : []

    const zai = await ZAI.create()
    const completion: any = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...safeHistory,
        { role: 'user', content: String(message) },
      ],
    })

    const reply: string =
      completion?.choices?.[0]?.message?.content ||
      'Sorry, I could not generate a response. Please try again.'

    return ok({
      reply,
      conversationId: conversationId || null,
      requestCreated: lower.includes('unlock') || lower.includes('approve'),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message || 'Taly Support error')
  }
}

// Re-export rate-limit helper shape for tests (no-op)
export const _rateLimitInfo = { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS }
