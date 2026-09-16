# TALYCHAT — COMPLETE PRD (Product Requirements Document)

**App Name:** TalyChat
**Tagline:** Chat. Connect. Mingle.
**Founder:** Omkar Panday
**AI Assistant:** Taly Support
**Version:** Latest

---

## 1. AUTHENTICATION

### 1.1 Login Methods
- Email + Password
- Google/Gmail login (Firebase)
- Phone OTP (Firebase)
- Admin login: admin.in / Admin123

### 1.2 Rules
- admin.in is a valid login ID (not email format, it's admin identifier)
- Signup → auto-login to same account (no redirect back to login page)
- Same email via Google → no duplicate account (find existing)
- Session stored in localStorage, sent as x-user-id header
- Password hashing with bcryptjs
- After login, admin goes straight to admin panel (not user home)

### 1.3 Auth Screen
- Login and Signup tabs
- Sign up + Login buttons on brand panel (left side)
- Click → smooth scroll to form
- No "Try demo account" button
- Google + Phone buttons below form
- Phone OTP: 2-step dialog (phone → 6-digit code)
- Screen fully scrollable, no content cut

---

## 2. HOME SCREEN

### 2.1 Top Bar (Mobile)
- TalyChat logo + name
- Daily Login Reward icon (gift)
- Notifications bell
- NO search icon, NO profile icon

### 2.2 Top Bar (Desktop)
- Left sidebar with all nav items
- Daily Reward button
- Settings button
- Profile card at bottom

### 2.3 Home Content
- Welcome header with user name
- Welcome banner (TalyChat branding)
- Quick actions: Chats, Groups, Discover, Ask Taly
- Recent chats (private only)
- Recent notifications
- Trending communities preview
- Sponsored ad card
- Taly Support card REMOVED from home

### 2.4 Bottom Navigation (Mobile)
- Home, Chats, Groups, Discover, Profile
- Hidden when chat is open (full screen chat)
- Unread badge on Chats tab

---

## 3. CHAT SYSTEM

### 3.1 Chat Types
- Private Chat: 1-to-1 only (2 people)
- Group Chat: 2+ members
- Private chats NEVER show group info
- Group chats show group name, avatar, member count

### 3.2 Chat Screen
- Full screen (bottom nav hidden, top bar hidden)
- Header: Back | Avatar | Name | Status | Search | Three-dots
- NO phone call, video call, voice call buttons
- Private header: Name + online/last seen
- Group header: Group name + "X members • Y online"

### 3.3 Chat List (Chats Section)
- Shows ONLY private 1-to-1 chats (NO groups)
- Filters: All | Unread
- Unread indicator: single = red dot, multiple = red pill with count
- Read/open → unread indicator removed
- Group conversations are in Groups section only

### 3.4 Message Features
- Text, Emoji, Image, Voice message, Sticker
- Reply (swipe-to-reply primary, long-press secondary)
- Forward, Copy, Edit (own), Delete (own), Pin, Search
- Double-tap = ❤️ reaction (immediate)
- Long-press (~600ms) = reaction/action menu
- Swipe does NOT open emoji menu (only reply)
- One reaction per user per message (replace behavior)
- Reactions render as 3D pills

### 3.5 Message Overflow Protection
- wordBreak: break-word
- overflowWrap: anywhere
- max-width on bubble container
- Long URLs safely break
- NO horizontal overflow ever

### 3.6 Read Status
- ✓ = Sent / Not seen
- 👁 = Seen
- NO double-tick system

### 3.7 Empty State
- NO "Say hi to start the conversation" box
- NO "Your messages are secured on TalyChat" text
- Just show small "No messages yet" text
- Wallpaper stays visible (no blur)

### 3.8 Composer
- Compact, fixed at bottom
- Emoji button (always visible)
- Attachment button (sticker + image upload)
- Text input
- Voice record button (when input empty) / Send button (when input has text)
- NO voice calls
- Keyboard-safe (adjusts when keyboard opens)
- Always visible, never disappears

### 3.9 Voice Messages
- Hold-to-record (tap mic button)
- Recording UI: timer + Cancel + Send
- Max 2 minutes
- Playback: play/pause, progress bar, duration
- Play button works (stopPropagation prevents dropdown trigger)

### 3.10 Reply Preview
- When replying, original message preview shows ABOVE the reply
- Reply preview in composer area with Cancel option
- Backend populates replyToPreview + replyToSender fields

### 3.11 Message Styles
- Bubble (rounded, emerald gradient sent / card received)
- Sharp (square corners)
- Tail (asymmetric)
- None (non-bubble: text on background, no box, thin font)
- Selected via Customize → Message Style

---

## 4. THREE-DOT MENU

### 4.1 Private Chat Menu
- Search messages
- Mute notifications
- Shared Media
- Privacy
- Customize chat
- Pin Chat
- Clear chat (now)
- Clear chat after… (submenu: 1 hour / 1 day / 1 week / 1 month / Cancel)
- Block user
- Report

### 4.2 Group Chat Menu
- Add member (search users dialog)
- Search
- Members
- Shared Media
- Mute
- Privacy
- Customize
- Pin Group
- Clear Chat / Clear after…
- Leave Group
- Report

### 4.3 Customize Location
- Customize is ONLY in three-dot menu
- NOT in header as separate button
- NOT in Settings/Privacy section
- Removed from Settings entirely

### 4.4 Clear Chat Duration
- 1 hour → chat auto-deletes after 1 hour
- 1 day → auto-deletes after 1 day
- 1 week → auto-deletes after 1 week
- 1 month → auto-deletes after 1 month
- Cancel → cancels auto-delete timer

---

## 5. SWIPE-TO-REPLY

### 5.1 Gesture
- Swipe message right (incoming) or left (outgoing)
- Reply hint icon appears during swipe
- Swipe >60px → reply mode activates
- Reply preview shows above composer
- Cancel option available

### 5.2 Rules
- Swipe does NOT open emoji/reaction menu
- Long-press opens reaction menu (secondary)
- Double-tap = ❤️ (primary quick reaction)
- Single-finger scroll works everywhere (touch-action: pan-y)

---

## 6. GROUPS

### 6.1 Group Types
- Public: anyone can discover and join
- Private: invite only

### 6.2 Creating a Group
- Logo upload (image)
- Group name
- Description
- Category (16 categories + Other)
- Public/Private toggle
- Live preview
- Invite code generated: talychat.app/join/XXXXXX

### 6.3 Group Features
- Group name, image, description
- Category
- Members list (owner/admin/moderator/member roles)
- Invite links (create/regenerate/disable)
- Pinned messages
- Reactions, replies, media, voice messages
- Search
- Leave group
- Add member (search users)

### 6.4 Groups Section
- Shows user's joined groups
- Invite code input
- Create group button
- NO Discover tab in Groups section (Discover is separate)
- Group cards compact, no excessive spacing

### 6.5 Group Join
- Join via invite code or group ID
- Works correctly (no Unauthorized error)
- After join → conversation appears in list
- Member count increments

---

## 7. DISCOVER

### 7.1 Layout
- Separate main section (not inside Groups)
- Categories as horizontal scrolling chips (NOT big boxes)
- Click category → inline filtered group list
- Active category highlighted

### 7.2 Categories
Gaming, Technology, AI, Education, Cricket, Sports, Entertainment, Movies, Music, Memes, Jobs, Business, Finance, News, Local, Other

### 7.3 Sections
- Trending
- Popular
- New
- Categories (horizontal chips)
- Sponsored Communities

### 7.4 Category Click Behavior
- Click category chip → fetch groups for that category
- Show inline list with Join buttons
- Do NOT redirect to Groups view
- Click again to close

---

## 8. PROFILE

### 8.1 Layout
- Profile photo + upload
- Display name, username
- Bio
- Online status
- Joined date
- Edit Profile button

### 8.2 Premium Section
- Premium status (active/expiry)
- 3 plan cards: ₹49/2mo, ₹99/6mo, ₹189/1yr
- 30-minute countdown timer for ₹189 offer
- After timer: ₹199
- 24-hour loop (offer re-triggers)
- Buy plan → opens payment form (transaction ID, UTR, screenshot)
- Payment submitted → admin verification

### 8.3 Redeem Code
- Input field
- Redeem button
- Grants premium (months vary by code)

### 8.4 Referral Section
- 3 tiers: 4→2mo(7d), 7→6mo(15d), 15→1yr(30d)
- Referral code (username)
- Copy link button
- Progress bar (X/15)
- Recent referrals list
- Missed deadline → loop resets

### 8.5 Privacy and Safety
- Open privacy settings button
- Logout button (UNDER Privacy and Safety)
- Contact info private by default

### 8.6 NO Customization in Profile
- Customization removed from Settings
- Only available in chat/group three-dot menu

---

## 9. PRIVACY & REPORT

### 9.1 Report Data Stored
- Reporter ID
- Reported User ID
- Reason (Spam, Harassment, Scam, Illegal, Fake, Other)
- Description
- Date/time
- Status (pending/reviewed/resolved/dismissed)

### 9.2 Moderation
- 5-10 valid reports → 24-hour restriction
- Maximum threshold: 10 reports
- Restricted user cannot:
  - Send messages in public groups
  - Initiate new conversations
  - Post publicly
- Restricted user CAN:
  - Reply in existing private conversation (when other person initiates)
- No permanent ban from raw report count
- Admin reviews all reports

### 9.3 Block & Report
- Block user → /api/blocks
- Report user → /api/reports
- Anti-abuse protection against fake mass reporting

---

## 10. ADVERTISEMENT SYSTEM

### 10.1 Ad Timing
- Private chat: 25 seconds
- Group chat: 30 seconds
- Timer counts from when user is active in chat
- Ad appears after last message
- Loops continuously while user is online

### 10.2 Ad Behavior
- Appears as rectangle box after last message
- ✕ close button appears after 3 seconds
- User can close or continue chatting
- After close → timer restarts (25s/30s)
- Loops: 1, 2, 3, 4... until user leaves chat
- Works even in single-person chat
- One ad at a time
- Does NOT cover messages or composer
- NO layout jump
- Clear "Sponsored" label

### 10.3 Ad Card Design
- Rectangle shape (not full screen)
- Split-pane: left ad image (~35%), right content (~65%)
- Brand name + "Sponsored" badge
- Headline + description
- CTA button
- ✕ button top-right corner (after 3s)

### 10.4 Ad Placements
- In-chat (between messages, after last)
- Home (sponsored card)
- Discover (sponsored communities)

### 10.5 Admin Ad Control
- Create/Edit/Delete/Pause ads
- Start/End date
- Target category
- Placement
- Frequency
- Impressions tracking
- Clicks tracking
- CTR
- Enable/disable ads globally
- Configure private/group intervals

---

## 11. PREMIUM & PLANS

### 11.1 Plans
| Plan | Price | Period |
|------|-------|--------|
| 2 Months | ₹49 | 2 months |
| 6 Months | ₹99 | 6 months (Save 32%) |
| 1 Year | ₹189 | 12 months (Best Value) |

### 11.2 30-Minute Timer
- ₹189 offer with 30-min countdown
- After timer expires → ₹199
- 24-hour loop → offer re-triggers
- localStorage persisted
- If user buys → timer cleared, no more offers

### 11.3 Premium Features
- Premium themes & fonts
- Advanced customization
- Premium profile badge
- Higher upload limits
- Advanced privacy controls
- Ad-reduced experience

### 11.4 Payment Flow
- User clicks "Choose" on plan
- Buy plan dialog opens
- Form: Amount, Transaction ID, UTR Number, Payment Screenshot, Notes
- Submit → stored for admin verification
- Admin verifies → premium activated

---

## 12. REFERRAL SYSTEM

### 12.1 Tiers
| Referrals | Window | Reward |
|-----------|--------|--------|
| 4 | 7 days | 2 months premium |
| 7 | 15 days | 6 months premium |
| 15 | 30 days | 1 year premium |

### 12.2 How It Works
- User shares link: talychat.app/?ref=username
- New user signs up with referral code
- Referral created (status: pending)
- Referred user sends first message → referral becomes "active"
- Check tiers → grant premium if reached
- Missed deadline → loop resets
- Active referrals only
- Idempotent (no double-grant)

---

## 13. REDEEM CODES

### 13.1 User Flow
- Enter code in Profile → Redeem
- Code validated (active? expired? already redeemed?)
- Premium granted
- Code marked as "redeemed"

### 13.2 Admin Management
- Create codes (single or batch up to 100)
- Set premium months
- Set note + expiry
- Disable codes
- View redeemed status
- Demo codes: TALY-WELCOME, FRIEND-30, PRO-6M

---

## 14. DAILY LOGIN REWARD

### 14.1 Cycle: 7 days = 60 days total
| Day | Reward |
|-----|--------|
| Day 1 | 5 days |
| Day 2 | 5 days |
| Day 3 | 7 days |
| Day 4 | 8 days |
| Day 5 | 10 days |
| Day 6 | 10 days |
| Day 7 | 15 days |
| Total | 60 days |

### 14.2 Rules
- 24-hour cycle between claims
- Missed day = lost (no banking)
- Device clock manipulation prevented (server time)
- "Next reward in HH:MM:SS" timer
- Cycle completes after Day 7
- Accessed via top bar gift icon

---

## 15. TALY SUPPORT AI ASSISTANT

### 15.1 Identity
- Name: Taly Support (NOT Mehek)
- Owner/Founder: Omkar Panday
- Official AI support assistant
- /support slash command

### 15.2 Capabilities
- App help (chats, groups, customization, privacy)
- Account help
- Feature information
- New/upcoming features
- Unlock requests (creates admin approval, does NOT self-unlock)
- Reply in user's language (English/Hindi/Hinglish)

### 15.3 Rate Limit
- Default: 5 requests/minute
- High: 10 requests/minute
- Exceed → friendly message, no crash

### 15.4 Admin Approval Workflow
- User → /support → request → Main Admin → Approve/Reject
- Admin sees: User ID, Chat ID, Request, Reason, Date, Status
- Approve → feature/chat unlocks
- Reject → user gets rejection message
- Taly Support cannot self-unlock

### 15.5 Access
- Nav button (Bot icon)
- Floating button (bottom-right)
- NO Taly Support card on home page

---

## 16. ADMIN PANEL

### 16.1 Access
- Login: admin.in / Admin123
- Goes straight to admin panel (not user home)
- Separate from user view
- User does NOT see admin credentials

### 16.2 Bottom Navigation (5 tabs)

#### Tab 1: Dashboard
- 12 metric cards: Total Users, Active Users, New Today, Total Groups, Reports, Restricted, Premium, Expired Plans, Revenue, Ad Impressions, Ad Clicks, Reward Claims
- Bar chart: Sales/Purchases (Today/7 Days/Monthly/Quarterly toggle)
- Pie chart: Active vs Inactive members
- Line chart: User growth
- Click metric card → drill-down with period chart

#### Tab 2: Members
- Analytics: Total/Active/New/Male/Female/Under 18/18+
- Search users
- Table: avatar, name, username, role, premium, joined, online
- Click row → user details

#### Tab 3: Redeem
- Create codes form (code, months, note, count)
- Codes table (status, redeemed-by, disable button)

#### Tab 4: Reports
- List of reports with status
- Approve/Reject buttons

#### Tab 5: Settings
- App settings editor (key/value)
- Ad management (enable/disable, intervals)
- Change admin password
- Logout

### 16.3 Charts
- Recharts library
- Bar, Pie, Line charts
- Period toggles: Today/7 Days/Monthly/Quarterly
- Auto-update on period change
- Clean, labeled, readable

---

## 17. CUSTOMIZATION

### 17.1 Access
- Three-dot menu → Customize (ONLY here)
- NOT in header, NOT in Settings, NOT in Profile

### 17.2 Options
- Theme: Light, Dark, System
- Wallpaper: 12 visible + "More" button for rest (26 total)
- Message Style: Bubble, Sharp, Tail, None
- Font Size: 12-18px slider
- Font Family: 15 fonts (Sans, Mono, 3 Hindi, 10 decorative)
- Font Import: .ttf/.otf via FontFace API
- Live preview

### 17.3 Wallpapers
- 12 shown in grid (default first)
- "More" button (three-dot) expands remaining
- 26 total (CSS gradients + photo wallpapers + theme ZIP)

---

## 18. FONTS & EMOJI

### 18.1 Fonts
- NotoColorEmoji.ttf for emoji rendering
- 3 Hindi+English fonts: Aaradhana, Akkal, Himalli
- 10 decorative: Alfa Slab One, Creepster, Doppio One, Estonia, League Gothic, Lobster Two, Quattrocento, Sacramento, Syne Tactile, Yuyu
- Font import: .ttf/.otf via FontFace API
- In-app only (no system font replacement)
- Premium fonts marked with 👑

### 18.2 Emoji
- NotoColorEmoji.ttf bundled
- Emoji picker with categories
- Recent emojis
- Emoji search
- Future custom emoji packs
- .taly-emoji class for rendering

---

## 19. SETTINGS

### 19.1 Sections
- Account (edit profile, username, password, delete account)
- Language (English, Hindi, Chinese, Español, العربية, Other)
- Layout Mode (Auto, Mobile, Desktop)
- Privacy (last seen, online status, read receipts)
- Notifications
- About TalyChat
- NO Customization section (removed)

### 19.2 Language
- Selector in Settings
- UI labels change to selected language
- Message typing always supports all languages
- Stored in localStorage

### 19.3 Layout Mode
- Auto (device detection)
- Mobile (force mobile view)
- Desktop (force desktop view)
- Stored in localStorage

---

## 20. REALTIME MESSAGING

### 20.1 Architecture
- Socket.io mini-service on port 3003
- Next.js app on port 3000
- Caddy gateway forwards /?XTransformPort=3003

### 20.2 Events
- Client→Server: auth, join:conversation, leave:conversation, message:send, typing, reaction, message:status
- Server→Client: message:new, typing, presence, message:status, reaction, read:receipt

### 20.3 Features
- Conversation rooms
- Presence (online/offline)
- Typing indicators
- Message relay
- Reaction broadcasting
- Read receipts
- Auto-reconnect

---

## 21. DATABASE

### 21.1 Current: In-Memory JSON DB
- No external database needed
- Auto-seeds on first API call
- Works on Vercel serverless
- All data in memory (resets on cold start)

### 21.2 Models
User, Conversation, ConversationMember, Message, Reaction, Group, Category, Notification, Report, Block, Advertisement, UserPreference, Subscription, AppSetting, Referral, RedeemCode

### 21.3 Seed Data
- 1 admin (admin.in / Admin123)
- 6 demo users (password: password123)
- 10 groups across categories
- Messages, notifications, ads, redeem codes, app settings

---

## 22. API ROUTES

### 22.1 Auth
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/oauth (Google/Phone)
- GET /api/auth/me

### 22.2 Chat
- GET /api/conversations
- POST /api/conversations
- GET /api/messages?conversationId=
- POST /api/messages
- PUT /api/messages/:id
- DELETE /api/messages/:id

### 22.3 Groups
- GET /api/groups
- POST /api/groups
- GET /api/groups/:id
- POST /api/groups/join
- POST /api/groups/:id/leave
- POST /api/groups/:id/invite/regenerate

### 22.4 Other
- GET /api/discover
- GET /api/users/search
- GET /api/notifications
- POST /api/notifications/read
- POST /api/taly-support
- GET /api/ads?placement=
- POST /api/ads/:id/click
- GET/PUT /api/preferences
- GET /api/premium/plans
- GET /api/me/premium
- GET /api/referral/me
- POST /api/redeem
- POST /api/reports
- POST /api/blocks
- GET /api/seed

### 22.5 Admin
- GET /api/admin/stats
- GET /api/admin/users
- GET /api/admin/groups
- GET /api/admin/reports
- POST /api/admin/ads
- GET/PUT /api/admin/settings
- GET/POST /api/admin/codes
- POST /api/admin/codes/:id/disable

---

## 23. DEVICE SUPPORT

### 23.1 Responsive
- Mobile (phone) — primary
- Tablet
- Desktop (laptop/PC)
- Device detection (Android, iOS, Windows, Mac, Linux)

### 23.2 Scroll
- Single-finger scroll works everywhere
- touch-action: pan-y on scrollable areas
- -webkit-overflow-scrolling: touch
- NO double-finger required

### 23.3 Overflow
- NO horizontal overflow on any device
- All boxes/cards stay inside screen
- max-width: 100% on all elements
- overflow-x: hidden globally

### 23.4 Touch
- Touch-friendly (44px+ targets)
- No tap highlight
- Swipe gestures work smoothly

---

## 24. SECURITY

- HTTPS/TLS
- bcryptjs password hashing
- Session via localStorage + x-user-id header
- Admin routes check role === 'admin'
- Contact info private by default
- No plaintext passwords in logs/UI
- Block/Report system
- Rate limiting on Taly Support (5/min default, 10/min high)
- No false "device-only data" claims (real-time messaging requires server)

---

## 25. REVENUE MODEL

1. Advertisements (primary initial)
2. Sponsored Groups
3. Premium (₹49/₹99/₹189)
4. Future: Business accounts, verified profiles, promo tools

---

## 26. FINAL QA REQUIREMENTS

- 0 hydration errors
- 0 nested button errors
- 0 runtime TypeErrors
- 0 unhandled promise rejections
- 0 horizontal overflow
- 0 broken responsive layouts
- Single-finger scroll works
- Swipe-to-reply works
- Double-tap Like works
- Long-press reaction works
- Group join works (no Unauthorized)
- Signup auto-login works
- admin.in login works
- Ads render in active chats (25s/30s loop)
- Ad close button works (after 3s)
- Voice message playback works
- Reply preview shows
- Every visible control is functional
- NO fake buttons or placeholders

---

## 27. DEPLOYMENT

- GitHub: https://github.com/powergamingyt1001-art/TalyChat
- Vercel: https://talychat1to1.vercel.app
- Database: In-memory JSON (no external setup needed)
- Firebase: project talychat-296c6 (Google + Phone auth)

### Firebase Authorized Domains (must add):
- talychat1to1.vercel.app
- localhost

### Admin Login:
- Email: admin.in
- Password: Admin123

---

*TalyChat — Chat. Connect. Mingle. — Founder: Omkar Panday*
