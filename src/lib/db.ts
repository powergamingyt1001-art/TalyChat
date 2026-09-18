import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

// On Vercel (serverless), the filesystem is read-only except /tmp.
// SQLite needs a writable path. Use /tmp on Vercel, local path otherwise.
function setupDbPath() {
  if (process.env.VERCEL) {
    const tmpDir = '/tmp/talychat-db'
    if (!existsSync(tmpDir)) {
      try { mkdirSync(tmpDir, { recursive: true }) } catch {}
    }
    process.env.DATABASE_URL = `file:${tmpDir}/custom.db`
  }
  // Local: use the env var as-is
}

setupDbPath()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
