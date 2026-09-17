// Vercel postbuild — create the SQLite database and push schema
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

try {
  const dbDir = path.join(process.cwd(), 'db')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  console.log('Running prisma db push...')
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
  console.log('Database ready!')
} catch (err) {
  console.error('Postbuild error:', err.message)
}
