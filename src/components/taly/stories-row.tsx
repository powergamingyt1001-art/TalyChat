'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { PremiumAvatar } from '@/components/premium-avatar'
import { cn } from '@/lib/utils'

// ============================================================
// Story types (shared with home-screen + story-viewer-dialog)
// ============================================================

export interface StoryAuthor {
  id: string
  name: string
  username?: string
  avatar?: string | null
  isPremium?: boolean
  premiumTier?: string | null
}

export interface StoryItem {
  id: string
  userId: string
  type: 'text' | 'image'
  content: string
  bgColor: string
  textColor: string
  caption?: string | null
  createdAt: string
  expiresAt: string
  viewsCount?: number
  hasViewed?: boolean
}

export interface StoriesGroup {
  user: StoryAuthor
  stories: StoryItem[]
  hasUnviewed: boolean
}

interface StoriesRowProps {
  myStoryAuthor: StoryAuthor
  myStories: StoryItem[]
  friends: StoriesGroup[]
  onOpenStory: (userId: string, storyIndex: number) => void
  onAddStory: () => void
  loading?: boolean
}

function shortName(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export function StoriesRow({
  myStoryAuthor,
  myStories,
  friends,
  onOpenStory,
  onAddStory,
  loading,
}: StoriesRowProps) {
  const hasMyStories = myStories.length > 0
  // The current user has unviewed "stories" if any are unviewed — but they
  // are always considered "viewed" from the author's perspective (they
  // authored them). For the ring style, treat "viewed" as: user has at least
  // one story already (so the ring is muted, signalling they've already
  // added one). For an empty state, we still show the + badge.
  const myRingClass = hasMyStories ? 'story-ring viewed' : 'story-ring'

  const handleMyStoryClick = () => {
    if (hasMyStories) {
      onOpenStory(myStoryAuthor.id, 0)
    } else {
      onAddStory()
    }
  }

  return (
    <section
      className="mt-4 animate-fade-in-up"
      aria-label="Stories"
    >
      <div className="flex items-center justify-between">
        <h2 className="section-header">Stories</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
          24h
        </span>
      </div>

      <div className="no-scrollbar mt-2 flex items-start gap-3 overflow-x-auto pb-1">
        {/* My Story tile */}
        <button
          onClick={handleMyStoryClick}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center"
          aria-label={hasMyStories ? 'View my story' : 'Add a story'}
        >
          <div className={cn('relative', myRingClass)}>
            <div className="story-ring-inner">
              <PremiumAvatar
                user={{
                  isPremium: myStoryAuthor.isPremium,
                  premiumTier: myStoryAuthor.premiumTier,
                  avatar: myStoryAuthor.avatar || undefined,
                  name: myStoryAuthor.name || 'Me',
                }}
                size={52}
                showAura={false}
              />
            </div>
            {/* Plus badge (always shown on My Story tile) */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
          </div>
          <span className="line-clamp-1 w-full text-[11px] font-medium text-muted-foreground">
            {hasMyStories ? 'My Status' : 'Add Status'}
          </span>
        </button>

        {/* Friend tiles */}
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1"
              >
                <div className="story-ring viewed opacity-60">
                  <div className="story-ring-inner">
                    <div className="h-[52px] w-[52px] animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
                <span className="h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
            ))
          : friends.map((g) => {
              const ringClass = g.hasUnviewed
                ? 'story-ring'
                : 'story-ring viewed'
              return (
                <motion.button
                  key={g.user.id}
                  onClick={() => onOpenStory(g.user.id, 0)}
                  whileTap={{ scale: 0.94 }}
                  className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center"
                  aria-label={`View ${g.user.name}'s story`}
                >
                  <div className={ringClass}>
                    <div className="story-ring-inner">
                      <PremiumAvatar
                        user={{
                          isPremium: g.user.isPremium,
                          premiumTier: g.user.premiumTier,
                          avatar: g.user.avatar || undefined,
                          name: g.user.name || 'U',
                        }}
                        size={52}
                        showAura={false}
                      />
                    </div>
                  </div>
                  <span className="line-clamp-1 w-full text-[11px] font-medium text-foreground">
                    {shortName(g.user.name)}
                  </span>
                </motion.button>
              )
            })}

        {/* Empty state — when no friends have stories */}
        {!loading && friends.length === 0 && (
          <div className="flex flex-1 items-center pl-1">
            <p className="text-xs text-muted-foreground/80">
              {hasMyStories
                ? 'Your story is live. Friends will see it here.'
                : 'Tap to add a status update.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
