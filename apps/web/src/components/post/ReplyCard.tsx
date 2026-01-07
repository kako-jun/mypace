import PostHeader from './PostHeader'
import { PostContent } from './PostContent'
import { PostStickers } from './PostStickers'
import { parseEmojiTags } from '../ui'
import { getEventThemeColors, getThemeCardProps } from '../../lib/nostr/events'
import { parseStickers } from '../../lib/nostr/tags'
import type { Event, EmojiTag, ProfileMap } from '../../types'

interface ReplyCardProps {
  reply: Event
  displayName: string
  avatarUrl: string | null
  isProfileLoading?: boolean
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  onClick?: () => void
}

export default function ReplyCard({
  reply,
  displayName,
  avatarUrl,
  isProfileLoading,
  emojis,
  profiles = {},
  onClick,
}: ReplyCardProps) {
  const themeProps = getThemeCardProps(getEventThemeColors(reply))
  const stickers = parseStickers(reply.tags)

  return (
    <article className={`reply-card ${themeProps.className}`} style={themeProps.style} onClick={onClick}>
      {/* Back layer stickers (behind content) */}
      <PostStickers stickers={stickers} truncated={true} layer="back" />

      <PostHeader
        pubkey={reply.pubkey}
        createdAt={reply.created_at}
        displayName={displayName}
        avatarUrl={avatarUrl}
        isProfileLoading={isProfileLoading}
        emojis={emojis}
        eventKind={reply.kind}
      />
      <div className="post-content">
        <PostContent
          content={reply.content}
          emojis={parseEmojiTags(reply.tags)}
          profiles={profiles}
          truncate={true}
          tags={reply.tags}
          onReadMore={onClick}
        />
      </div>

      {/* Front layer stickers (above content) */}
      <PostStickers stickers={stickers} truncated={true} layer="front" />
    </article>
  )
}
