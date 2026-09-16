import { db } from '@/lib/db'

// ============================================================
// SESSION HELPERS (x-user-id header based, per PRD)
// ============================================================

export interface SessionUser {
  id: string
  email: string
  username: string
  name: string
  role: string
  isPremium: boolean
  avatar?: string | null
}

export function getSessionUserId(req: Request): string | null {
  const userId = req.headers.get('x-user-id')
  return userId || null
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const userId = getSessionUserId(req)
  if (!userId) return null
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      isPremium: true,
      avatar: true,
    },
  })
  return user as SessionUser | null
}

export async function requireAuth(req: Request): Promise<SessionUser> {
  const user = await getSessionUser(req)
  if (!user) throw new HttpError(401, 'Unauthorized')
  return user
}

export async function requireAdmin(req: Request): Promise<SessionUser> {
  const user = await requireAuth(req)
  if (user.role !== 'admin') throw new HttpError(403, 'Admin only')
  return user
}

// ============================================================
// HTTP ERROR
// ============================================================

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
