import { PrismaClient } from '@prisma/client'

// On Vercel (serverless), the filesystem is read-only except /tmp.
// The SQLite DB is created at build time and bundled.
// At runtime, we copy it to /tmp (writable) on first access.
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import path from 'path'

function ensureDb() {
  if (process.env.VERCEL) {
    const tmpDir = '/tmp/talychat-db'
    const tmpDb = path.join(tmpDir, 'custom.db')
    if (!existsSync(tmpDir)) {
      try { mkdirSync(tmpDir, { recursive: true }) } catch {}
    }
    // Copy the bundled DB to /tmp if it doesn't exist
    if (!existsSync(tmpDb)) {
      const sourceDb = path.join(process.cwd(), 'db', 'custom.db')
      if (existsSync(sourceDb)) {
        try { copyFileSync(sourceDb, tmpDb) } catch {}
      }
    }
    process.env.DATABASE_URL = `file:${tmpDb}`
  }
}

ensureDb()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
