import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, jsonError } from '@/lib/auth'
import { ensureSeed } from '@/lib/seed'

export const runtime = 'nodejs'

// GET /api/premium/plans — return plan list from AppSettings with offer info.
export async function GET(_req: NextRequest) {
  await ensureSeed()
  try {
    const get = async (key: string, def: string) => {
      const s = await db.appSetting.findUnique({ where: { key } })
      return s ? parseInt(s.value, 10) : parseInt(def, 10)
    }

    const price2mo = await get('premium_2mo_price', '49')
    const price6mo = await get('premium_6mo_price', '99')
    const price1yr = await get('premium_1yr_price', '189')
    const price1yrOffer = await get('premium_1yr_offer_price', '189')
    const price1yrRegular = await get('premium_1yr_regular_price', '199')
    const offerMinutes = await get('premium_offer_duration_minutes', '30')
    const offerLoopHours = await get('premium_offer_loop_hours', '24')

    const plans = [
      {
        id: '2mo',
        label: '2 Months',
        durationMonths: 2,
        price: price2mo,
        perMonth: Math.round((price2mo / 2) * 100) / 100,
      },
      {
        id: '6mo',
        label: '6 Months',
        durationMonths: 6,
        price: price6mo,
        perMonth: Math.round((price6mo / 6) * 100) / 100,
      },
      {
        id: '1yr',
        label: '1 Year',
        durationMonths: 12,
        price: price1yr,
        perMonth: Math.round((price1yr / 12) * 100) / 100,
      },
    ]

    const offer = {
      active: price1yrOffer < price1yrRegular,
      offerPrice: price1yrOffer,
      regularPrice: price1yrRegular,
      deadlineMinutes: offerMinutes,
      loopHours: offerLoopHours,
    }

    return ok({ plans, offer })
  } catch (e: any) {
    return jsonError(500, e.message)
  }
}
