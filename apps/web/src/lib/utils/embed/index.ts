import type { EmbedInfo } from './types'
import { extractYouTubeInfo } from './youtube'
import { extractTweetId } from './twitter'
import { extractInstagramInfo } from './instagram'
import { extractTikTokId } from './tiktok'
import { extractSpotifyInfo } from './spotify'
import { isVideoUrl, isAudioUrl, isImageUrl, isAllowedIframeDomain, URL_REGEX } from './utils'

export type { EmbedType, EmbedInfo } from './types'
export { getYouTubeThumbnail, getYouTubeEmbedUrl, getYouTubeShortsEmbedUrl } from './youtube'
export { getInstagramEmbedUrl } from './instagram'
export { getSpotifyEmbedUrl } from './spotify'
export { isVideoUrl, isAudioUrl, isAllowedIframeDomain, ALLOWED_IFRAME_DOMAINS, URL_REGEX } from './utils'

// Super mention URL regex (@@domain.com/path format)
const SUPER_MENTION_URL_REGEX = /@@([\w][\w.-]*\.[a-z]{2,}(?:\/[^\s<"]*)?)/gi

export function detectEmbed(url: string): EmbedInfo | null {
  if (isImageUrl(url)) return null
  // Skip video/audio - they are already handled inline by processAudioUrls
  if (isVideoUrl(url)) return null
  if (isAudioUrl(url)) return null

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

  if (isAudioUrl(url)) {
    return { type: 'audio', url }
  }

  // Exclude internal mypace URLs from embed (internal routing takes priority)
  if (/^https?:\/\/mypace\.llll-ll\.com(\/|$)/i.test(url)) {
    return null
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
  // Remove code blocks before extracting URLs (```...``` and `...`)
  const contentWithoutCode = content
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`[^`\n]+`/g, '') // inline code
  const urls = contentWithoutCode.match(URL_REGEX) || []
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

  // Also extract super mention URLs (@@domain.com/path)
  let match
  while ((match = SUPER_MENTION_URL_REGEX.exec(contentWithoutCode)) !== null) {
    const domain = match[1].replace(/[.,;:!?)\]}>）」』】]+$/, '')
    const fullUrl = `https://${domain}`
    if (seenUrls.has(fullUrl)) continue
    seenUrls.add(fullUrl)

    const embed = detectEmbed(fullUrl)
    if (embed) {
      embeds.push(embed)
    }
  }

  return embeds
}
