import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAdmin } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/admin/ads
export async function GET(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const url = new URL(req.url)
    const placement = url.searchParams.get('placement')
    const where: any = {}
    if (placement) where.placement = placement

    const ads = await db.advertisement.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok({ ads, total: ads.length })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// POST /api/admin/ads — create ad
// Body: { brandName, headline, description, imageUrl, ctaText, ctaUrl, placement, category?, startDate, endDate?, isActive }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const admin = await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const {
      brandName,
      headline,
      description,
      imageUrl,
      ctaText,
      ctaUrl,
      placement,
      category,
      startDate,
      endDate,
      isActive,
    } = body || {}

    if (!brandName || !headline) {
      return jsonError(400, 'brandName and headline are required')
    }

    const ad = await db.advertisement.create({
      data: {
        brandName: String(brandName),
        headline: String(headline),
        description: String(description || ''),
        imageUrl: imageUrl || null,
        ctaText: ctaText || 'Learn More',
        ctaUrl: ctaUrl || '#',
        placement: placement || 'in-chat',
        category: category || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        creatorId: admin.id,
      },
    })
    return ok(ad, 201)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// PATCH /api/admin/ads — update ad
// Body: same fields optional + id
export async function PATCH(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const {
      id,
      brandName,
      headline,
      description,
      imageUrl,
      ctaText,
      ctaUrl,
      placement,
      category,
      startDate,
      endDate,
      isActive,
    } = body || {}

    if (!id) return jsonError(400, 'Ad id required')

    const existing = await db.advertisement.findUnique({ where: { id } })
    if (!existing) return jsonError(404, 'Ad not found')

    const data: any = {}
    if (brandName !== undefined) data.brandName = String(brandName)
    if (headline !== undefined) data.headline = String(headline)
    if (description !== undefined) data.description = String(description)
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null
    if (ctaText !== undefined) data.ctaText = String(ctaText)
    if (ctaUrl !== undefined) data.ctaUrl = String(ctaUrl)
    if (placement !== undefined) data.placement = String(placement)
    if (category !== undefined) data.category = category || null
    if (startDate !== undefined) data.startDate = new Date(startDate)
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null
    if (typeof isActive === 'boolean') data.isActive = isActive

    const updated = await db.advertisement.update({ where: { id }, data })
    return ok(updated)
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}

// DELETE /api/admin/ads — delete ad
// Body: { id }
export async function DELETE(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAdmin(req)

    const body = await req.json().catch(() => ({}))
    const { id } = body || {}
    if (!id) return jsonError(400, 'Ad id required')

    const existing = await db.advertisement.findUnique({ where: { id } })
    if (!existing) return jsonError(404, 'Ad not found')

    await db.advertisement.delete({ where: { id } })
    return ok({ deleted: true, id })
  } catch (e: any) {
    if (e.status === 401 || e.status === 403) return jsonError(e.status, e.message)
    return jsonError(500, e.message)
  }
}
