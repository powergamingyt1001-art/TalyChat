import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// ============================================================
// GET /api/conversations/:id/export?format=json|txt
// ============================================================
// Exports the conversation's message history as a downloadable file.
//  - Must be authenticated + a member of the conversation.
//  - Fetches up to 1000 most-recent messages with sender info + reactions.
//  - JSON format: returns a JSON file with all messages + metadata.
//  - TXT format: returns a formatted text transcript.
//
// Sets:
//   Content-Type: application/json | text/plain
//   Content-Disposition: attachment; filename="talychat-export-<name>.<ext>"
// ============================================================

const MAX_MESSAGES = 1000

function sanitizeFilename(name: string): string {
  // Strip characters that are unsafe in filenames, collapse spaces, lowercase.
  return (
    (name || 'conversation')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'conversation'
  )
}

function formatExportDate(d: Date): string {
  // e.g. "2026-09-17 at 10:30 AM"
  const datePart = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart} at ${timePart}`
}

function formatMessageDate(d: Date): string {
  // e.g. "Sep 16, 2026 11:51 AM"
  const datePart = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${datePart} ${timePart}`
}

function senderName(s: any): string {
  if (!s) return 'Unknown'
  return s.name || s.username || 'Unknown'
}

function messageBodyPreview(m: any): string {
  // Produce a human-readable body for the TXT transcript.
  switch (m.type) {
    case 'image':
      return m.content ? `📷 Photo: ${m.content}` : '📷 Photo'
    case 'voice':
      return `🎤 Voice message${m.voiceDuration ? ` (${m.voiceDuration}s)` : ''}`
    case 'sticker':
      return m.stickerId ? `🎨 Sticker: ${m.stickerId}` : '🎨 Sticker'
    case 'system':
      return m.content || 'System message'
    case 'location':
      return `📍 Location${m.lat && m.lng ? ` (${m.lat.toFixed(4)}, ${m.lng.toFixed(4)})` : ''}`
    case 'text':
    default:
      return m.content || ''
  }
}

function buildTxt(payload: {
  conversationName: string
  conversationType: string
  exportedAt: Date
  messageCount: number
  messages: any[]
}): string {
  const { conversationName, conversationType, exportedAt, messageCount, messages } = payload
  const lines: string[] = []
  lines.push(`TalyChat Export — ${conversationName}`)
  lines.push(`Exported: ${formatExportDate(exportedAt)}`)
  lines.push(`Conversation type: ${conversationType}`)
  lines.push(`Messages: ${messageCount}`)
  lines.push('')
  lines.push('─────────────')
  lines.push('')

  // messages are sorted oldest → newest for readability
  for (const m of messages) {
    const ts = formatMessageDate(new Date(m.createdAt))
    const name = senderName(m.sender)
    const body = messageBodyPreview(m)
    lines.push(`[${ts}] ${name}:`)
    if (body) lines.push(body)
    if (m.reactions && m.reactions.length > 0) {
      const r = m.reactions
        .map((x: any) => x.emoji || '')
        .filter(Boolean)
        .join(' ')
      if (r) lines.push(`   Reactions: ${r}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params

    const formatParam = (
      req.nextUrl?.searchParams?.get('format') || 'json'
    ).toLowerCase()
    if (!['json', 'txt'].includes(formatParam)) {
      return jsonError(400, "Invalid format (must be 'json' or 'txt')")
    }

    // ----- Membership check -----
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: id, userId: user.id },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // ----- Fetch conversation metadata -----
    const conv = await db.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                name: true,
              },
            },
          },
        },
      },
    })
    if (!conv) return jsonError(404, 'Conversation not found')

    // Build a friendly conversation name for the header + filename.
    const conversationName =
      conv.name ||
      (conv.type === 'group'
        ? conv.group?.name || 'Group Chat'
        : (() => {
            // For private chats, derive the name from the other participant.
            const other = conv.members.find((m) => m.userId !== user.id)
            return other?.user?.name || other?.user?.username || 'Private Chat'
          })())

    // ----- Fetch messages (up to MAX_MESSAGES), oldest-first for transcript -----
    const messagesRaw = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: MAX_MESSAGES,
      include: {
        reactions: true,
        sender: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            sender: {
              select: { id: true, name: true, username: true },
            },
          },
        },
      },
    })

    // Reverse so oldest is first (chronological order).
    const messages = messagesRaw.slice().reverse()

    // ----- Serialize messages -----
    const serializedMessages = messages.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      mediaUrl: m.mediaUrl,
      voiceDuration: m.voiceDuration,
      stickerId: m.stickerId,
      lat: m.lat,
      lng: m.lng,
      createdAt: m.createdAt,
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
      sender: m.sender
        ? {
            id: m.sender.id,
            username: m.sender.username,
            name: m.sender.name,
            avatar: m.sender.avatar,
          }
        : null,
      reactions: (m.reactions || []).map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
      })),
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            type: m.replyTo.type,
            content: m.replyTo.content,
            sender: m.replyTo.sender,
          }
        : null,
    }))

    // ----- Build response -----
    const safeName = sanitizeFilename(conversationName)
    const exportedAt = new Date()

    if (formatParam === 'json') {
      const payload = {
        app: 'TalyChat',
        exportedAt: exportedAt.toISOString(),
        conversation: {
          id: conv.id,
          type: conv.type,
          name: conversationName,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        },
        participants: conv.members.map((m) => ({
          userId: m.userId,
          role: m.role,
          name: m.user?.name,
          username: m.user?.username,
        })),
        messageCount: serializedMessages.length,
        messages: serializedMessages,
      }

      const filename = `talychat-export-${safeName}.json`
      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // TXT format
    const txt = buildTxt({
      conversationName,
      conversationType: conv.type,
      exportedAt,
      messageCount: serializedMessages.length,
      messages: serializedMessages,
    })
    const filename = `talychat-export-${safeName}.txt`
    return new NextResponse(txt, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
