import { NextRequest } from 'next/server'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'wav', 'ogg', 'ttf', 'otf']

export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return jsonError(400, 'No file provided')
    if (file.size > MAX_SIZE) return jsonError(413, 'File too large (max 5MB)')
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED.includes(ext)) return jsonError(400, `File type .${ext} not allowed`)
    
    if (process.env.VERCEL) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const dataUrl = `data:${file.type || 'image/' + ext};base64,${buffer.toString('base64')}`
      return ok({ url: dataUrl, filename: `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}` })
    }
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))
    return ok({ url: `/uploads/${filename}`, filename })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message)
  }
}
