import { useMemo } from 'react'
import { formatTimestamp } from '../../lib/nostr/events'
import { navigateToUser } from '../../lib/utils'
import { Avatar, EmojiText, Icon } from '../ui'
import type { EmojiTag, ViewCountData } from '../../types'

const AVATAR_ANIMATIONS = ['avatar-pulse', 'avatar-bounce', 'avatar-wink']

interface PostHeaderProps {
  pubkey: string
  createdAt: number
  displayName: string
  avatarUrl: string | null
  avatarSize?: 'small' | 'medium'
  clickable?: boolean
  isProfileLoading?: boolean
  emojis?: EmojiTag[]
  eventKind?: number
  views?: ViewCountData
}

export default function PostHeader({
  pubkey,
  createdAt,
  displayName,
  avatarUrl,
  avatarSize = 'medium',
  clickable = true,
  isProfileLoading = false,
  emojis = [],
  eventKind,
  views,
}: PostHeaderProps) {
  const nameClass = `author-name${isProfileLoading ? ' loading-rainbow' : ''}`

  // Random animation and delay for avatar
  const avatarAnimation = useMemo(() => AVATAR_ANIMATIONS[Math.floor(Math.random() * AVATAR_ANIMATIONS.length)], [])
  const avatarDelay = useMemo(() => Math.random() * 90, []) // 90s cycle

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigateToUser(pubkey)
  }

  const avatarWrapper = (
    <span className={`avatar-animate ${avatarAnimation}`} style={{ animationDelay: `${avatarDelay}s` }}>
      <Avatar src={avatarUrl} size={avatarSize} />
    </span>
  )

  const nameContent = emojis.length > 0 ? <EmojiText text={displayName} emojis={emojis} /> : displayName

  // Show labels for special event kinds
  const isBlogPost = eventKind === 30023
  const isNpcPost = eventKind === 42000
  const timestampContent = (
    <>
      {formatTimestamp(createdAt)}
      {views && (
        <span className="view-count" aria-label={`${views.detail} detail views, ${views.impression} impressions`}>
          {' · '}
          <Icon name="BarChart2" size={12} /> {views.detail} / {views.impression}
        </span>
      )}
      {isBlogPost && <span className="kind-label kind-label-blog"> · Blog</span>}
      {isNpcPost && <span className="kind-label kind-label-npc"> · NPC</span>}
    </>
  )

  return (
    <header className="post-header">
      {clickable ? (
        <button className="post-header-user" onClick={handleUserClick}>
          {avatarWrapper}
          <div className="post-author-info">
            <span className={nameClass} data-name={displayName}>
              {nameContent}
            </span>
            <time className="timestamp">{timestampContent}</time>
          </div>
        </button>
      ) : (
        <>
          {avatarWrapper}
          <div className="post-author-info">
            <span className={nameClass} data-name={displayName}>
              {nameContent}
            </span>
            <time className="timestamp">{timestampContent}</time>
          </div>
        </>
      )}
    </header>
  )
}
