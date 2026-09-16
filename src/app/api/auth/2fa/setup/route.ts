import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError, requireAuth } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// POST /api/auth/2fa/setup
// Generates a new TOTP secret + QR code data URL for the current user.
// Stores the secret (but does NOT enable 2FA yet — verification is a separate step).
// Body: none
// Returns: { qrDataUrl, secret, otpauth }
export async function POST(req: NextRequest) {
  await ensureSeed()
  try {
    const user = await requireAuth(req)
    const { authenticator } = await import('otplib')
    const QRCode = (await import('qrcode')).default

    // Generate a fresh secret for this user.
    const secret = authenticator.generateSecret()

    // Build the otpauth:// URI that authenticator apps can scan.
    const username = user.username || user.email || user.id
    const service = 'TalyChat'
    const otpauth = authenticator.keyuri(username, service, secret)

    // Save the secret (not yet enabled). Verification flips `twoFactorEnabled`.
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret },
    })

    // Render the URI as a base64 data URL for an <img src="..."> tag.
    const qrDataUrl = await QRCode.toDataURL(otpauth, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
    })

    return ok({
      secret,
      otpauth,
      qrDataUrl,
      // Hint for the user to know what username is being encoded.
      label: `${service}:${username}`,
    })
  } catch (e: any) {
    if (e.status === 401) return jsonError(401, e.message)
    return jsonError(500, e.message || 'Failed to set up 2FA')
  }
}
