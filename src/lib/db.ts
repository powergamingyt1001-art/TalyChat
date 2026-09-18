import { PrismaClient } from '@prisma/client'
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'fs'
import * as path from 'path'

// On Vercel (serverless), each function instance gets a fresh /tmp.
// But the bundled db/custom.db (committed to git) is available at process.cwd()
// We copy it to /tmp on first access, then use that.

function setupDb() {
  if (process.env.VERCEL) {
    const tmpDir = '/tmp/talychat-db'
    const tmpDb = path.join(tmpDir, 'custom.db')
    const bundledDb = path.join(process.cwd(), 'db', 'custom.db')
    
    if (!existsSync(tmpDir)) {
      try { mkdirSync(tmpDir, { recursive: true }) } catch {}
    }
    
    // Always copy the bundled DB to /tmp (it has seed data)
    // This happens on every cold start, which is fine
    if (existsSync(bundledDb) && !existsSync(tmpDb)) {
      try {
        copyFileSync(bundledDb, tmpDb)
        console.log('[db] Copied bundled DB to /tmp')
      } catch (e) {
        console.error('[db] Failed to copy DB:', e)
      }
    }
    
    process.env.DATABASE_URL = `file:${tmpDb}`
  }
}

setupDb()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
