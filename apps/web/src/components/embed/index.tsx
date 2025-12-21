import { extractEmbeds, type EmbedInfo } from '../../lib/utils/embed'
import YouTubeEmbed from './YouTubeEmbed'
import YouTubeShortsEmbed from './YouTubeShortsEmbed'
import TwitterEmbed from './TwitterEmbed'
import InstagramEmbed from './InstagramEmbed'
import TikTokEmbed from './TikTokEmbed'
import SpotifyEmbed from './SpotifyEmbed'
import VideoEmbed from './VideoEmbed'
import AudioEmbed from './AudioEmbed'
import IframeEmbed from './IframeEmbed'
import LinkPreview from './LinkPreview'

export {
  YouTubeEmbed,
  YouTubeShortsEmbed,
  TwitterEmbed,
  InstagramEmbed,
  TikTokEmbed,
  SpotifyEmbed,
  VideoEmbed,
  AudioEmbed,
  IframeEmbed,
  LinkPreview,
}

interface EmbedRendererProps {
  embed: EmbedInfo
}

function EmbedRenderer({ embed }: EmbedRendererProps) {
  switch (embed.type) {
    case 'youtube':
      return embed.videoId ? <YouTubeEmbed videoId={embed.videoId} /> : null

    case 'youtube-shorts':
      return embed.videoId ? <YouTubeShortsEmbed videoId={embed.videoId} /> : null

    case 'twitter':
      return embed.tweetId ? <TwitterEmbed tweetId={embed.tweetId} url={embed.url} /> : null

    case 'instagram':
      return embed.instagramId && embed.instagramType ? (
        <InstagramEmbed instagramId={embed.instagramId} instagramType={embed.instagramType} url={embed.url} />
      ) : null

    case 'tiktok':
      return embed.tiktokId ? <TikTokEmbed tiktokId={embed.tiktokId} url={embed.url} /> : null

    case 'spotify':
      return embed.spotifyId && embed.spotifyType ? (
        <SpotifyEmbed spotifyId={embed.spotifyId} spotifyType={embed.spotifyType} url={embed.url} />
      ) : null

    case 'video':
      return <VideoEmbed url={embed.url} />

    case 'audio':
      return <AudioEmbed url={embed.url} />

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
