import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/signup
export async function POST(req: NextRequest) {
  await ensureSeed()
  const body = await req.json().catch(() => ({}))
  const { email, username, name, password, referralCode } = body || {}
  if (!email || !username || !password) {
    return jsonError(400, 'Email, username, and password are required')
  }
  const emailLower = String(email).toLowerCase().trim()
  if (emailLower === 'admin.in') {
    return jsonError(400, 'admin.in is reserved. Use login instead.')
  }
  const existing = await db.user.findFirst({
    where: {
      OR: [{ email: emailLower }, { username }],
    },
  })
  if (existing) {
    return jsonError(409, 'Email or username already taken')
  }
  const bcrypt = await import('bcryptjs')
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await db.user.create({
    data: {
      email: emailLower,
      username,
      name: name || username,
      passwordHash,
      authProvider: 'email',
      referralCode: referralCode || null,
      avatar: '',
    },
  })
  await db.userPreference.create({ data: { userId: user.id } })

  if (referralCode) {
    const referrer = await db.user.findUnique({ where: { username: referralCode } })
    if (referrer && referrer.id !== user.id) {
      await db.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
          status: 'pending',
        },
      })
    }
  }

  await db.notification.create({
    data: {
      userId: user.id,
      type: 'system',
      title: 'Welcome to TalyChat!',
      body: 'Chat. Connect. Mingle. — Founder: Omkar Panday',
    },
  })

  return ok({ user: serializeUser(user), token: user.id }, 201)
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
