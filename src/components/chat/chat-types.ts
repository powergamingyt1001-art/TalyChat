// Shared types for the chat view (Task 3-c)

export interface ChatUser {
  id: string
  username?: string
  name?: string
  avatar?: string | null
  isPremium?: boolean
  isOnline?: boolean
  lastSeen?: string | null
}

export interface ChatReaction {
  id: string
  messageId: string
  userId: string
  emoji: string
  user?: ChatUser | null
  createdAt?: string
}

export interface ChatReplyTo {
  id: string
  content?: string
  type?: string
  deletedAt?: string | null
  sender?: ChatUser | null
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  sender?: ChatUser | null
  content: string
  type: 'text' | 'image' | 'voice' | 'sticker' | 'system'
  mediaUrl?: string | null
  voiceDuration?: number | null
  stickerId?: string | null
  replyToId?: string | null
  replyTo?: ChatReplyTo | null
  reactions?: ChatReaction[]
  editedAt?: string | null
  deletedAt?: string | null
  pinnedAt?: string | null
  seenBy?: string
  createdAt: string
  updatedAt?: string
}

export interface ChatMember {
  userId: string
  role: string
  joinedAt?: string
  lastReadAt?: string
  user: ChatUser
}

export interface ChatConversation {
  id: string
  type: 'private' | 'group'
  name?: string | null
  avatar?: string | null
  ownerId?: string | null
  groupId?: string | null
  muted?: boolean
  pinned?: boolean
  autoDeleteAfter?: number | null
  otherUser?: ChatUser | null
  members?: ChatMember[]
  group?: any
}

export interface ChatAd {
  id: string
  brandName: string
  headline: string
  description: string
  imageUrl?: string | null
  ctaText: string
  ctaUrl: string
  placement: string
  category?: string | null
}

// Common emoji grid for the emoji picker (smileys, hearts, hands, etc)
export const EMOJI_GRID: string[] = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
  '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵',
  '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
  '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
  '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩',
  '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',
  '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '❤️', '🧡',
  '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
  '💞', '💓', '💗', '💖', '💘', '💝', '💟', '👍', '👎', '👌',
  '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
  '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🙏',
  '💪', '🎉', '🎊', '🎈', '🎁', '🏆', '🥳', '🌟', '⭐', '✨',
]

// Reaction emojis (the 6 quick reactions shown in the long-press menu)
export const QUICK_REACTIONS: string[] = ['❤️', '😂', '👍', '🔥', '😮', '😢']

// Stickers (PRD: a small set of large emoji stickers)
export const STICKER_SET: string[] = ['🥳', '😎', '🤗', '🎉', '💝', '🌟']
