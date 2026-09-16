import { NextRequest } from 'next/server'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp3', 'wav', 'ogg',
  'ttf', 'otf',
])

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  ttf: 'font/ttf', otf: 'font/otf',
}

// POST /api/upload — upload a file (image/voice/sticker).
// Accept multipart/form-data with `file` field.
// Save to /public/uploads/<cuid>.<ext>. Return { url: '/uploads/xxx.ext' }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    await requireAuth(req)

    const formData = await req.formData().catch(() => null)
    if (!formData) return jsonError(400, 'multipart/form-data required')

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return jsonError(400, 'file field is required')
    }

    if (file.size > MAX_BYTES) {
      return jsonError(413, 'File too large (max 5MB)')
    }

    // Extract extension from filename or content-type
    const filename = file.name || ''
    let ext = ''
    if (filename.includes('.')) {
      ext = filename.split('.').pop()!.toLowerCase()
    }
    if (!ext) {
      // try content-type
      const mime = file.type || ''
      for (const [e, m] of Object.entries(EXT_TO_MIME)) {
        if (mime === m) { ext = e; break }
      }
    }
    if (!ext || !ALLOWED.has(ext)) {
      return jsonError(400, 'File type not allowed. Allowed: ' + Array.from(ALLOWED).join(', '))
    }

    const publicDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(publicDir, { recursive: true })

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    const savedName = `${id}.${ext}`
    const savedPath = path.join(publicDir, savedName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(savedPath, buffer)

    return ok({ url: `/uploads/${savedName}`, filename: savedName, size: buffer.length })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
