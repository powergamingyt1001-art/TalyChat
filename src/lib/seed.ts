import { db } from '@/lib/db'

// Seeding status flag
let seeded = false
let seeding = false

export async function ensureSeed() {
  if (seeded) return
  if (seeding) return // prevent concurrent seeding
  seeding = true
  try {
    const userCount = await db.user.count().catch(() => -1)
    if (userCount === -1) {
      // DB doesn't exist yet on Vercel — tables not created
      // The DB was created during build, but tables need to exist
      // Try creating tables via raw SQL
      console.log('[seed] DB empty, attempting to create tables...')
      seeded = true
      return
    }
    if (userCount > 0) {
      seeded = true
      return
    }
    await seedAll()
    seeded = true
  } catch (err) {
    console.error('[seed] Error:', err)
    seeded = true // prevent retry loops
  } finally {
    seeding = false
  }
}

async function seedAll() {
  const bcrypt = await import('bcryptjs')

  // ---------- Admin ----------
  const adminPw = await bcrypt.hash('Admin123', 10)
  const admin = await db.user.create({
    data: {
      email: 'admin.in',
      username: 'admin',
      name: 'TalyChat Admin',
      passwordHash: adminPw,
      role: 'admin',
      isPremium: true,
      premiumUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      bio: 'Founder: Omkar Panday',
      avatar: '',
    },
  })

  const demoUsers = [
    { name: 'Aarav Sharma', username: 'aarav', gender: 'male', bio: 'Gaming enthusiast 🎮' },
    { name: 'Priya Verma', username: 'priya', gender: 'female', bio: 'AI researcher 🤖' },
    { name: 'Rohan Singh', username: 'rohan', gender: 'male', bio: 'Cricket lover 🏏' },
    { name: 'Sneha Iyer', username: 'sneha', gender: 'female', bio: 'Music producer 🎵' },
    { name: 'Vikram Rao', username: 'vikram', gender: 'male', bio: 'Business strategist 💼' },
    { name: 'Ananya Nair', username: 'ananya', gender: 'female', bio: 'Content creator 📸' },
  ]
  const pw = await bcrypt.hash('password123', 10)
  const created: string[] = [admin.id]
  for (const d of demoUsers) {
    const u = await db.user.create({
      data: {
        email: `${d.username}@talychat.app`,
        username: d.username,
        name: d.name,
        passwordHash: pw,
        gender: d.gender,
        bio: d.bio,
        avatar: '',
      },
    })
    created.push(u.id)
    await db.userPreference.create({ data: { userId: u.id } })
  }
  await db.userPreference.create({ data: { userId: admin.id } })

  // ---------- 10 Groups across categories ----------
  const groupsData = [
    { name: 'Indian Gamers Hub', desc: 'All gamers welcome — BGMI, Free Fire, Valorant', cat: 'Gaming' },
    { name: 'Tech Talk India', desc: 'Latest tech news, gadgets, reviews', cat: 'Technology' },
    { name: 'AI Builders Club', desc: 'Build AI apps, discuss LLMs, prompts', cat: 'AI' },
    { name: 'Learners Corner', desc: 'Free courses, study materials, doubts', cat: 'Education' },
    { name: 'Cricket Live', desc: 'Match discussions, scores, memes', cat: 'Cricket' },
    { name: 'Football Fans India', desc: 'ISL, EPL, La Liga — all football', cat: 'Sports' },
    { name: 'Bollywood Buzz', desc: 'Movie reviews, trailers, gossip', cat: 'Entertainment' },
    { name: 'Cinema Lovers', desc: 'Indian & world cinema discussions', cat: 'Movies' },
    { name: 'Indie Music India', desc: 'Indie artists, new releases, reviews', cat: 'Music' },
    { name: 'Daily Memes', desc: 'Fresh memes every day 🤣', cat: 'Memes' },
  ]
  for (let i = 0; i < groupsData.length; i++) {
    const g = groupsData[i]
    const ownerId = created[(i % (created.length - 1)) + 1]
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const group = await db.group.create({
      data: {
        name: g.name,
        description: g.desc,
        category: g.cat,
        isPublic: true,
        inviteCode,
        ownerId,
        creatorId: ownerId,
        membersCount: 1,
      },
    })
    await db.groupMember.create({
      data: { groupId: group.id, userId: ownerId, role: 'owner' },
    })
    const conv = await db.conversation.create({
      data: {
        type: 'group',
        name: g.name,
        groupId: group.id,
        ownerId,
      },
    })
    await db.conversationMember.create({
      data: { conversationId: conv.id, userId: ownerId, role: 'owner' },
    })
    for (let m = 0; m < 3; m++) {
      const memberId = created[(m + i + 1) % created.length]
      if (memberId === ownerId) continue
      try {
        await db.groupMember.create({
          data: { groupId: group.id, userId: memberId, role: 'member' },
        })
        await db.conversationMember.create({
          data: { conversationId: conv.id, userId: memberId, role: 'member' },
        })
        await db.group.update({
          where: { id: group.id },
          data: { membersCount: { increment: 1 } },
        })
      } catch {}
    }
    const msgs = [
      `Welcome to ${g.name}! Share your thoughts here.`,
      `Anyone active today? 👋`,
      `New to this group, say hi!`,
    ]
    for (let k = 0; k < msgs.length; k++) {
      const senderId = created[(k + i + 1) % created.length]
      await db.message.create({
        data: {
          conversationId: conv.id,
          senderId,
          content: msgs[k],
          type: 'text',
        },
      })
    }
  }

  // ---------- Private conversations between admin & each demo user ----------
  for (let i = 1; i < created.length; i++) {
    const uId = created[i]
    const conv = await db.conversation.create({
      data: {
        type: 'private',
        ownerId: admin.id,
      },
    })
    await db.conversationMember.create({ data: { conversationId: conv.id, userId: admin.id } })
    await db.conversationMember.create({ data: { conversationId: conv.id, userId: uId } })
    await db.message.create({
      data: {
        conversationId: conv.id,
        senderId: uId,
        content: `Hi Admin! Welcome to TalyChat 👋`,
        type: 'text',
      },
    })
  }

  // ---------- Ads ----------
  const ads = [
    { brand: 'TechWorld', headline: 'New Gaming Laptops @ 30% off', desc: 'Limited stock. Free delivery in India.', img: 'https://placehold.co/300x200/10b981/fff?text=Gaming+Laptop', cta: 'Shop Now', placement: 'home' },
    { brand: 'Skill India', headline: 'Free Coding Bootcamp', desc: 'Learn React & Next.js in 30 days.', img: 'https://placehold.co/300x200/f59e0b/fff?text=Code+Bootcamp', cta: 'Enroll', placement: 'discover' },
    { brand: 'CricketLive', headline: 'Watch IPL Live Free', desc: 'Stream all matches in HD on app.', img: 'https://placehold.co/300x200/ef4444/fff?text=IPL+Live', cta: 'Watch', placement: 'in-chat' },
    { brand: 'MusicApp', headline: 'Ad-free music for 3 months', desc: 'Try Premium Free today.', img: 'https://placehold.co/300x200/8b5cf6/fff?text=Music+App', cta: 'Try Now', placement: 'in-chat' },
  ]
  for (const a of ads) {
    await db.advertisement.create({
      data: {
        brandName: a.brand,
        headline: a.headline,
        description: a.desc,
        imageUrl: a.img,
        ctaText: a.cta,
        ctaUrl: '#',
        placement: a.placement,
        isActive: true,
        creatorId: admin.id,
      },
    })
  }

  // ---------- Redeem Codes ----------
  const codes = [
    { code: 'TALY-WELCOME', months: 1, note: 'Welcome bonus for new users' },
    { code: 'FRIEND-30', months: 2, note: 'Refer a friend reward' },
    { code: 'PRO-6M', months: 6, note: '6-month premium trial' },
  ]
  for (const c of codes) {
    await db.redeemCode.create({
      data: {
        code: c.code,
        premiumMonths: c.months,
        note: c.note,
        count: 1,
        expiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdById: admin.id,
      },
    })
  }

  // ---------- App Settings ----------
  const settings = [
    { key: 'ads_enabled', value: 'true' },
    { key: 'ads_private_interval', value: '45' },
    { key: 'ads_group_interval', value: '35' },
    { key: 'taly_rate_limit_default', value: '5' },
    { key: 'taly_rate_limit_high', value: '10' },
    { key: 'report_restriction_threshold', value: '5' },
    { key: 'report_max_threshold', value: '10' },
    { key: 'report_restriction_duration_hours', value: '24' },
    { key: 'premium_2mo_price', value: '49' },
    { key: 'premium_6mo_price', value: '99' },
    { key: 'premium_1yr_price', value: '189' },
    { key: 'premium_1yr_offer_price', value: '189' },
    { key: 'premium_1yr_regular_price', value: '199' },
    { key: 'premium_offer_duration_minutes', value: '30' },
    { key: 'premium_offer_loop_hours', value: '24' },
    { key: 'daily_reward_cycle_days', value: '7' },
    { key: 'daily_reward_total_days', value: '60' },
  ]
  for (const s of settings) {
    await db.appSetting.create({ data: s })
  }

  console.log('[seed] TalyChat seed complete')
}
