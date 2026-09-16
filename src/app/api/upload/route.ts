import { NextRequest } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// Max upload size: 8 MB
const MAX_SIZE = 8 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'font/ttf',
  'font/otf',
  'application/vnd.ms-fontobject',
  'application/octet-stream', // fallback for some font uploads
])

export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    if (!user) return jsonError(401, 'Unauthorized')

    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return jsonError(400, 'No file uploaded')
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return jsonError(413, 'File too large (max 8MB)')
    }

    // Validate mime (with fallback for unknown types)
    const ext = path.extname(file.name || '').toLowerCase() || ''
    if (!ALLOWED_MIME.has(file.type) && !ext) {
      return jsonError(415, `Unsupported file type: ${file.type}`)
    }

    // Build a stable filename
    const safeExt = ext || mimeToExt(file.type)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const filename = `${id}${safeExt}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    const filepath = path.join(uploadDir, filename)
    const buf = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filepath, buf)

    // Return URL relative to site root
    const url = `/uploads/${filename}`
    return ok({ url, filename, size: buf.length }, 201)
  } catch (e: any) {
    if (e?.status === 401) return jsonError(401, e.message)
    return jsonError(500, e?.message || 'Upload failed')
  }
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    case 'image/bmp':
      return '.bmp'
    case 'image/svg+xml':
      return '.svg'
    case 'audio/webm':
      return '.webm'
    case 'audio/ogg':
      return '.ogg'
    case 'audio/mpeg':
    case 'audio/mp3':
      return '.mp3'
    case 'audio/wav':
      return '.wav'
    case 'font/ttf':
      return '.ttf'
    case 'font/otf':
      return '.otf'
    default:
      return '.bin'
  }
}
