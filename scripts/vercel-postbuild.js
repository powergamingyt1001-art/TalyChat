// Vercel postbuild — create the SQLite database and push schema
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

try {
  const dbDir = path.join(process.cwd(), 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  console.log('Running prisma db push...')
  execSync('npx prisma db push --accept-data-loss --skip-generate', { stdio: 'inherit' })
  console.log('Database ready!')
} catch (err) {
  console.error('Postbuild error:', err.message)
}
