import { extractEmbeds, type EmbedInfo } from '../../lib/utils/embed'
import YouTubeEmbed from './YouTubeEmbed'
import TwitterEmbed from './TwitterEmbed'
import VideoEmbed from './VideoEmbed'
import IframeEmbed from './IframeEmbed'
import LinkPreview from './LinkPreview'

export { YouTubeEmbed, TwitterEmbed, VideoEmbed, IframeEmbed, LinkPreview }

interface EmbedRendererProps {
  embed: EmbedInfo
}

function EmbedRenderer({ embed }: EmbedRendererProps) {
  switch (embed.type) {
    case 'youtube':
      return embed.videoId ? <YouTubeEmbed videoId={embed.videoId} /> : null

    case 'twitter':
      return embed.tweetId ? <TwitterEmbed tweetId={embed.tweetId} url={embed.url} /> : null

    case 'video':
      return <VideoEmbed url={embed.url} />

    case 'iframe':
      return <IframeEmbed url={embed.url} />

    case 'ogp':
      return <LinkPreview url={embed.url} />

    default:
      return null
  }
}

interface PostEmbedsProps {
  content: string
}

export function PostEmbeds({ content }: PostEmbedsProps) {
  const embeds = extractEmbeds(content)

  if (embeds.length === 0) return null

  return (
    <div className="post-embeds">
      {embeds.map((embed, index) => (
        <EmbedRenderer key={`${embed.type}-${embed.url}-${index}`} embed={embed} />
      ))}
    </div>
  )
}
