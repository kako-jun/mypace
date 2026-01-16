import { extractEmbeds, type EmbedInfo } from '../../lib/utils/embed'
import '../../styles/components/embed.css'
import YouTubeEmbed from './YouTubeEmbed'
import YouTubeShortsEmbed from './YouTubeShortsEmbed'
import TwitterEmbed from './TwitterEmbed'
import InstagramEmbed from './InstagramEmbed'
import TikTokEmbed from './TikTokEmbed'
import SpotifyEmbed from './SpotifyEmbed'
import IframeEmbed from './IframeEmbed'
import LinkPreview from './LinkPreview'
import type { OgpData } from '../../types'

export {
  YouTubeEmbed,
  YouTubeShortsEmbed,
  TwitterEmbed,
  InstagramEmbed,
  TikTokEmbed,
  SpotifyEmbed,
  IframeEmbed,
  LinkPreview,
}

interface EmbedRendererProps {
  embed: EmbedInfo
  ogpMap?: Record<string, OgpData>
  enableOgpFallback?: boolean
}

function EmbedRenderer({ embed, ogpMap = {}, enableOgpFallback = false }: EmbedRendererProps) {
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

    case 'iframe':
      return <IframeEmbed url={embed.url} />

    case 'ogp':
      return <LinkPreview url={embed.url} ogpData={ogpMap[embed.url]} enableFallback={enableOgpFallback} />

    default:
      return null
  }
}

interface PostEmbedsProps {
  content: string
  ogpMap?: Record<string, OgpData>
  enableOgpFallback?: boolean
}

export function PostEmbeds({ content, ogpMap = {}, enableOgpFallback = false }: PostEmbedsProps) {
  const embeds = extractEmbeds(content)

  if (embeds.length === 0) return null

  return (
    <div className="post-embeds">
      {embeds.map((embed, index) => (
        <EmbedRenderer
          key={`${embed.type}-${embed.url}-${index}`}
          embed={embed}
          ogpMap={ogpMap}
          enableOgpFallback={enableOgpFallback}
        />
      ))}
    </div>
  )
}
