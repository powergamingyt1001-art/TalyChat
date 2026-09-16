// Date / time helpers for chat messages (Task 3-c)

/**
 * Returns a label like "Today", "Yesterday", or "12 Sep" / "12 Sep 2024"
 * for a date separator between message groups.
 */
export function dateSeparatorLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'

  // Same year — short form (e.g. "12 Sep")
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  if (target.getFullYear() === today.getFullYear()) {
    return `${target.getDate()} ${months[target.getMonth()]}`
  }
  return `${target.getDate()} ${months[target.getMonth()]} ${target.getFullYear()}`
}

/** Format a timestamp as "HH:MM" (24h, per PRD 3.2). */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Format "last seen at HH:MM" for the header of a private chat. */
export function formatLastSeen(date: Date | string | null | undefined): string {
  if (!date) return 'offline'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'offline'
  return `last seen at ${formatTime(d)}`
}

/** Format a voice duration in seconds as "M:SS". */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Same-day check (used to decide if date separator is needed between two messages). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Get a short preview string of a message (used for reply previews). */
export function messagePreview(message: {
  type?: string
  content?: string
  mediaUrl?: string | null
  deletedAt?: string | null
}): string {
  if (message.deletedAt) return 'Message deleted'
  switch (message.type) {
    case 'image':
      return '📷 Photo'
    case 'voice':
      return '🎤 Voice message'
    case 'sticker':
      return '🎨 Sticker'
    case 'system':
      return message.content || 'System'
    default:
      return message.content || ''
  }
}

/** Build a "members • online" status line for the header of a group chat. */
export function groupStatusLine(members?: { user?: { isOnline?: boolean } }[] | null): string {
  if (!members || members.length === 0) return '0 members'
  const total = members.length
  const online = members.filter((m) => m.user?.isOnline).length
  return `${total} ${total === 1 ? 'member' : 'members'} • ${online} online`
}

/** Convert autoDeleteAfter seconds to a human label. */
export function autoDeleteLabel(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null
  if (seconds <= 3600) return '1 hour'
  if (seconds <= 86400) return '1 day'
  if (seconds <= 604800) return '1 week'
  if (seconds <= 2592000) return '1 month'
  return 'auto-delete'
}
