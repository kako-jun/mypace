import type { EmbedInfo } from './types'
import { extractYouTubeInfo } from './youtube'
import { extractTweetId } from './twitter'
import { extractInstagramInfo } from './instagram'
import { extractTikTokId } from './tiktok'
import { extractSpotifyInfo } from './spotify'
import { isVideoUrl, isImageUrl, isAllowedIframeDomain } from './utils'

export type { EmbedType, EmbedInfo } from './types'
export { getYouTubeThumbnail, getYouTubeEmbedUrl, getYouTubeShortsEmbedUrl } from './youtube'
export { getInstagramEmbedUrl } from './instagram'
export { getSpotifyEmbedUrl } from './spotify'
export { isVideoUrl, isAllowedIframeDomain, ALLOWED_IFRAME_DOMAINS } from './utils'

const URL_REGEX = /https?:\/\/[^\s<"]+/gi

export function detectEmbed(url: string): EmbedInfo | null {
  if (isImageUrl(url)) return null

  const youtubeInfo = extractYouTubeInfo(url)
  if (youtubeInfo) {
    return {
      type: youtubeInfo.isShorts ? 'youtube-shorts' : 'youtube',
      url,
      videoId: youtubeInfo.videoId,
    }
  }

  const tweetId = extractTweetId(url)
  if (tweetId) {
    return { type: 'twitter', url, tweetId }
  }

  const instagramInfo = extractInstagramInfo(url)
  if (instagramInfo) {
    return {
      type: 'instagram',
      url,
      instagramId: instagramInfo.id,
      instagramType: instagramInfo.type,
    }
  }

  const tiktokId = extractTikTokId(url)
  if (tiktokId) {
    return { type: 'tiktok', url, tiktokId }
  }

  const spotifyInfo = extractSpotifyInfo(url)
  if (spotifyInfo) {
    return {
      type: 'spotify',
      url,
      spotifyId: spotifyInfo.id,
      spotifyType: spotifyInfo.type,
    }
  }

  if (isVideoUrl(url)) {
    return { type: 'video', url }
  }

  if (isAllowedIframeDomain(url)) {
    return { type: 'iframe', url, iframeSrc: url }
  }

  // Exclude Wikipedia URLs from OGP (super mention Q badge links)
  if (/^https?:\/\/([\w-]+\.)?wikipedia\.org\//i.test(url)) {
    return null
  }

  return { type: 'ogp', url }
}

export function extractEmbeds(content: string): EmbedInfo[] {
  const urls = content.match(URL_REGEX) || []
  const embeds: EmbedInfo[] = []
  const seenUrls = new Set<string>()

  for (const url of urls) {
    const cleanUrl = url.replace(/[.,;:!?)\]}>）」』】\u3000-\u9FFF\uFF00-\uFFEF]+$/, '')
    if (seenUrls.has(cleanUrl)) continue
    seenUrls.add(cleanUrl)

    const embed = detectEmbed(cleanUrl)
    if (embed) {
      embeds.push(embed)
    }
  }

  return embeds
}
