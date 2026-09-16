// Premium tier mapping helpers (shared by all backend routes that grant premium).
//
// Tier rules (per V2 spec):
//   - <=2 months  -> bronze
//   - 3-6 months  -> silver
//   - >=7 months  -> gold
//
// This file is imported by API routes (server-side, nodejs runtime) so it must
// not pull in any client-only code.

export type PremiumTier = 'bronze' | 'silver' | 'gold'

/**
 * Map a premium duration (in whole months) to a tier label.
 *
 * @param months  premium months granted (1, 2, 6, 12, …)
 * @returns       'bronze' | 'silver' | 'gold'
 */
export function tierFromMonths(months: number): PremiumTier {
  if (months <= 2) return 'bronze'
  if (months <= 6) return 'silver'
  return 'gold'
}

/**
 * Map a payment plan slug to a tier label.
 *
 * @param plan  '2mo' | '6mo' | '1yr' (or any other slug)
 * @returns     'bronze' | 'silver' | 'gold'
 */
export function tierFromPlan(plan: string | null | undefined): PremiumTier {
  if (!plan) return 'bronze'
  switch (plan.toLowerCase()) {
    case '2mo':
      return 'bronze'
    case '6mo':
      return 'silver'
    case '1yr':
    case '12mo':
      return 'gold'
    default:
      // Fallback: try to parse a "Nmo" / "Nyr" pattern.
      {
        const m = plan.toLowerCase().match(/(\d+)\s*(mo|yr|month|year)/)
        if (m) {
          const n = Number(m[1]) || 0
          const unit = m[2]
          const months = unit.startsWith('y') ? n * 12 : n
          return tierFromMonths(months)
        }
      }
      return 'bronze'
  }
}

/**
 * Resolve the resulting tier when granting premium to a user that may already
 * have a (higher) tier.
 *
 * Used by /api/daily-reward where the reward is only a few days (< 2 months)
 * — i.e. would normally be "bronze" — but we don't want to *downgrade* a
 * silver/gold user.
 *
 *   - 'free'  -> 'bronze'
 *   - 'bronze' -> 'bronze'
 *   - 'silver' -> 'silver' (kept)
 *   - 'gold'   -> 'gold'   (kept)
 */
export function bumpTierForShortReward(
  currentTier: string | null | undefined,
): PremiumTier {
  const t = (currentTier || 'free').toLowerCase()
  if (t === 'silver') return 'silver'
  if (t === 'gold') return 'gold'
  return 'bronze'
}
