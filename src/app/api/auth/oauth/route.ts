import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/oauth
// Body: { provider: 'google' | 'phone', email, name, phone, username }
export async function POST(req: NextRequest) {
  await ensureSeed()
  const body = await req.json().catch(() => ({}))
  const { provider, email, name, phone, username } = body || {}
  if (!provider) return jsonError(400, 'Provider required')
  const providerKey = provider === 'google' ? email : phone
  if (!providerKey) return jsonError(400, `${provider === 'google' ? 'Email' : 'Phone'} required`)

  // Find existing user with same email (Google) — no duplicate account
  let user
  if (provider === 'google' && email) {
    const emailLower = String(email).toLowerCase().trim()
    user = await db.user.findUnique({ where: { email: emailLower } })
    if (!user) {
      // Create new
      const uname = username || String(emailLower).split('@')[0] + '_' + Math.floor(Math.random() * 1000)
      user = await db.user.create({
        data: {
          email: emailLower,
          username: uname,
          name: name || uname,
          authProvider: 'google',
          phone: null,
          avatar: '',
        },
      })
      await db.userPreference.create({ data: { userId: user.id } })
    }
  } else if (provider === 'phone' && phone) {
    user = await db.user.findFirst({ where: { phone } })
    if (!user) {
      // Generate username from phone
      const uname = 'user' + String(phone).slice(-6)
      user = await db.user.create({
        data: {
          email: `phone_${phone}@talychat.phone`,
          username: uname,
          name: name || uname,
          authProvider: 'phone',
          phone,
          avatar: '',
        },
      })
      await db.userPreference.create({ data: { userId: user.id } })
    }
  } else {
    return jsonError(400, 'Invalid provider')
  }
  await db.user.update({
    where: { id: user.id },
    data: { isOnline: true, lastSeen: new Date() },
  })
  return ok({ user: serializeUser(user), token: user.id })
}

function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    isPremium: u.isPremium,
    avatar: u.avatar,
    bio: u.bio,
  }
}
