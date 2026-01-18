import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import { PostStickers } from './PostStickers'
import { PostLocation } from './PostLocation'
import { parseEmojiTags } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { parseStickers, hasTeaserTag } from '../../lib/nostr/tags'
import { navigateToPost } from '../../lib/utils'
import type { Event, EmojiTag, ProfileMap, OgpData } from '../../types'

interface OriginalPostCardProps {
  event: Event
  displayName: string
  avatarUrl: string | null
  isProfileLoading?: boolean
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  wikidataMap?: Record<string, string>
  ogpMap?: Record<string, OgpData>
  onClick?: () => void
}

export default function OriginalPostCard({
  event,
  displayName,
  avatarUrl,
  isProfileLoading,
  emojis,
  profiles = {},
  wikidataMap = {},
  ogpMap = {},
  onClick,
}: OriginalPostCardProps) {
  const themeProps = getThemeCardProps(getEventThemeColors(event))
  const stickers = parseStickers(event.tags)
  const isTruncated = hasTeaserTag(event)

  // Extract locations from tags
  const gTags = event.tags.filter((tag) => tag[0] === 'g')
  const locationTags = event.tags.filter((tag) => tag[0] === 'location')
  const locations = gTags.map((gTag, i) => ({
    geohash: gTag[1],
    name: locationTags[i]?.[1],
  }))

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigateToPost(event.id)
    }
  }

  return (
    <article
      className={`original-post-card ${themeProps.className}`}
      style={themeProps.style}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      role="button"
      tabIndex={0}
    >
      {/* Back layer stickers (behind content) */}
      <PostStickers stickers={stickers} truncated={isTruncated} layer="back" />

      <PostHeader
        pubkey={event.pubkey}
        createdAt={event.created_at}
        displayName={displayName}
        avatarUrl={avatarUrl}
        isProfileLoading={isProfileLoading}
        emojis={emojis}
        eventKind={event.kind}
        avatarSize="small"
      />
      <div className="post-content">
        <PostContent
          content={event.content}
          emojis={parseEmojiTags(event.tags)}
          profiles={profiles}
          wikidataMap={wikidataMap}
          ogpMap={ogpMap}
          truncate={true}
          tags={event.tags}
          onReadMore={handleClick}
        />
      </div>

      {locations.map((loc) => (
        <PostLocation key={loc.geohash} geohashStr={loc.geohash} name={loc.name} />
      ))}

      {/* Front layer stickers (above content) */}
      <PostStickers stickers={stickers} truncated={isTruncated} layer="front" />
    </article>
  )
}
