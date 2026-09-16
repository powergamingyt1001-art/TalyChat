import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/conversations/:id/media — list all media messages (image, voice,
// sticker/other) in a conversation. Members only.
//
// Query params:
//   ?type=image|voice|all  (default: all) — informational; the response always
//   returns the three buckets { images, voice, documents }.
//
// Response shape:
//   {
//     images:    MediaItem[],  // type='image'
//     voice:     MediaItem[],  // type='voice'
//     documents: MediaItem[],  // type='sticker' or any other non-text/system
//   }
//
// MediaItem = { id, conversationId, senderId, sender, content, type, mediaUrl,
//               voiceDuration, stickerId, createdAt }
//
// Sorted by createdAt desc, limited to 100 items per bucket.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const typeParam = (
      req.nextUrl?.searchParams?.get('type') || 'all'
    ).toLowerCase()

    // Must be a member of the conversation.
    const meMember = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id,
        },
      },
    })
    if (!meMember) {
      return jsonError(403, 'Not a member of this conversation')
    }

    // Base filter — exclude deleted + system messages.
    const baseWhere = {
      conversationId: id,
      deletedAt: null,
      type: { not: 'system' },
    }

    // Helper to run a single bucket query.
    const fetchBucket = async (types: string[]) =>
      db.message.findMany({
        where: { ...baseWhere, type: { in: types } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              avatar: true,
              isPremium: true,
              premiumTier: true,
              isOnline: true,
            },
          },
        },
      })

    const mapItem = (m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: m.sender,
      content: m.content,
      type: m.type,
      mediaUrl: m.mediaUrl,
      voiceDuration: m.voiceDuration,
      stickerId: m.stickerId,
      createdAt: m.createdAt,
    })

    // Decide which buckets to populate based on ?type=.
    const wantImages = typeParam === 'all' || typeParam === 'image'
    const wantVoice = typeParam === 'all' || typeParam === 'voice'
    const wantDocs = typeParam === 'all'

    const [imagesRaw, voiceRaw, docsRaw] = await Promise.all([
      wantImages ? fetchBucket(['image']) : Promise.resolve([] as any[]),
      wantVoice ? fetchBucket(['voice']) : Promise.resolve([] as any[]),
      wantDocs ? fetchBucket(['sticker']) : Promise.resolve([] as any[]),
    ])

    return ok({
      images: imagesRaw.map(mapItem),
      voice: voiceRaw.map(mapItem),
      documents: docsRaw.map(mapItem),
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
