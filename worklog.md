# TalyChat — Worklog

## Project Overview
Building **TalyChat** — a full-featured chat/social app per PRD (`upload/TalyChat-PRD-FINAL.md`).
- Founder: Omkar Panday
- Tagline: Chat. Connect. Mingle.
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma (SQLite) + Socket.io mini-service + z-ai-web-dev-sdk (Taly Support AI)

## Assets Inventory (already placed)

### Logos
- `/public/logo.png` — main app icon (from `upload/icon TalyChat.png`)
- `/public/icons/logo.png` — duplicate for flexible import

### Fonts (10 decorative, in `/public/fonts/`)
1. AlfaSlabOne-Regular.ttf
2. Creepster-Regular.ttf
3. DoppioOne-Regular.ttf
4. Estonia-Regular.ttf
5. LeagueGothic-Regular.ttf
6. LobsterTwo-Regular.ttf
7. Quattrocento-Regular.ttf
8. Sacramento-Regular.ttf
9. SyneTactile-Regular.ttf
10. Yuyu-Regular.ttf

> Note: PRD also mentions NotoColorEmoji.ttf, Aaradhana/Akkal/Himalli (Hindi fonts). These were NOT in the upload — will use system emoji + Google Fonts Hindi fallback (Noto Sans Devanagari) unless provided later.

### Wallpapers (25 images, in `/public/wallpapers/`)
- wp_01.png … wp_25.jpg
- Sourced from `theam my projt.zip` (DCIM/Screenshots + Download + Pictures folders)
- PRD wants 26 total — 12 visible + 14 behind "More" button. We have 25; will add 1 CSS-gradient-only "default" entry to reach 26.

### Payment
- UPI ID: `9897186065@fam`
- QR code: `/public/payment/qr-code.png` (from `Screenshot_2026_0907_185837_com.fampay.in.png`)
- Payee name: TalyChat

### Firebase (configured in `.env.local`)
- Project: talychat-296c6
- API Key: AIzaSyBUZRbkkzORrgzTYza5drsFFafcgAGJo3U
- App ID: 1:410813408724:android:874e2a84bf6cee76f5a241
- Sender ID: 410813408724
- Auth domain: talychat-296c6.firebaseapp.com
- Storage bucket: talychat-296c6.firebasestorage.app
- ⚠️ google-services.json is the **Android** variant. Web OAuth client ID is the same (client_type 3). Phone OTP should also work on this project — will verify during dev.

## Environment (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBUZRbkkzORrgzTYza5drsFFafcgAGJo3U
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=talychat-296c6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=talychat-296c6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=talychat-296c6.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=410813408724
NEXT_PUBLIC_FIREBASE_APP_ID=1:410813408724:android:874e2a84bf6cee76f5a241
PAYMENT_UPI_ID=9897186065@fam
NEXT_PUBLIC_PAYMENT_UPI_ID=9897186065@fam
NEXT_PUBLIC_PAYMENT_QR=/payment/qr-code.png
NEXT_PUBLIC_APP_NAME=TalyChat
NEXT_PUBLIC_APP_TAGLINE=Chat. Connect. Mingle.
NEXT_PUBLIC_FOUNDER=Omkar Panday
NEXT_PUBLIC_APP_DOMAIN=talychat.app
```
DATABASE_URL (existing): `file:/home/z/my-project/db/custom.db`

## Tech Decisions
- **Database**: Prisma + SQLite (per project rule), NOT in-memory JSON (deviates from PRD section 21.1 for better persistence — SQLite is fine and already configured).
- **Realtime**: Socket.io mini-service on port 3003 (per project gateway rules).
- **AI (Taly Support)**: `z-ai-web-dev-sdk` (already installed) instead of external LLM.
- **Auth**: NextAuth.js v4 is available, but PRD uses simple `x-user-id` header + localStorage + bcryptjs. Will implement custom lightweight auth per PRD (admin.in / Admin123 works as admin identifier, not email).
- **State**: Zustand (client) + TanStack Query (server).
- **Charts (admin)**: Recharts (already installed).

## Pending Items (waiting on user confirmation before coding)
- ✅ Wallpapers, Fonts, Logo, Firebase, UPI/QR — all received
- ❓ Sticker packs — none provided; will use emoji-based placeholder stickers
- ❓ Demo users/groups — will auto-generate Indian names + DiceBear avatars
- ❓ Language translations — will use a small i18n dictionary (English/Hindi primary, others machine-translated)
- ❓ Domain — placeholder `talychat.app` used per PRD
- ❓ Ad creatives — will create dummy ads, admin can add real ones later

## Next Step
Waiting for user's final "go" signal to start coding Phase 1 (auth + home shell).

---
