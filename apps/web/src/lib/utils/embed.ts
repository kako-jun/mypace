// Embed URL detection and parsing utilities

export type EmbedType =
  | 'youtube'
  | 'youtube-shorts'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'spotify'
  | 'video'
  | 'iframe'
  | 'ogp'

export interface EmbedInfo {
  type: EmbedType
  url: string
  // YouTube specific
  videoId?: string
  // Twitter specific
  tweetId?: string
  // Instagram specific
  instagramId?: string
  instagramType?: 'post' | 'reel' | 'stories'
  // TikTok specific
  tiktokId?: string
  // Spotify specific
  spotifyType?: 'track' | 'album' | 'playlist' | 'episode' | 'show'
  spotifyId?: string
  // Iframe specific (games)
  iframeSrc?: string
}

// Allowed domains for iframe embeds (games, demos)
const ALLOWED_IFRAME_DOMAINS = [
  'github.io',
  'itch.io',
  'itch.zone', // itch.io game hosting
  'newgrounds.com',
  'codepen.io',
  'codesandbox.io',
  'jsfiddle.net',
  'glitch.me',
  'vercel.app',
  'netlify.app',
  'pages.dev', // Cloudflare Pages
]

// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov']

// Image extensions (to exclude from embed processing)
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

// URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<"]+/gi

/**
 * Extract YouTube video ID and detect if it's Shorts
 */
function extractYouTubeInfo(url: string): { videoId: string; isShorts: boolean } | null {
  // youtube.com/shorts/VIDEO_ID (must check first)
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch) return { videoId: shortsMatch[1], isShorts: true }

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return { videoId: watchMatch[1], isShorts: false }

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return { videoId: shortMatch[1], isShorts: false }

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return { videoId: embedMatch[1], isShorts: false }

  return null
}

/**
 * Extract Twitter/X tweet ID from URL
 */
function extractTweetId(url: string): string | null {
  // twitter.com/user/status/TWEET_ID or x.com/user/status/TWEET_ID
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}

/**
 * Extract Instagram post/reel ID from URL
 */
function extractInstagramInfo(url: string): { id: string; type: 'post' | 'reel' | 'stories' } | null {
  // instagram.com/p/POST_ID/ (post)
  const postMatch = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/)
  if (postMatch) return { id: postMatch[1], type: 'post' }

  // instagram.com/reel/REEL_ID/ (reel)
  const reelMatch = url.match(/instagram\.com\/reel\/([a-zA-Z0-9_-]+)/)
  if (reelMatch) return { id: reelMatch[1], type: 'reel' }

  // instagram.com/stories/USERNAME/STORY_ID/ (stories)
  const storiesMatch = url.match(/instagram\.com\/stories\/[^/]+\/(\d+)/)
  if (storiesMatch) return { id: storiesMatch[1], type: 'stories' }

  return null
}

/**
 * Extract TikTok video ID from URL
 */
function extractTikTokId(url: string): string | null {
  // tiktok.com/@user/video/VIDEO_ID
  const videoMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (videoMatch) return videoMatch[1]

  // vm.tiktok.com/SHORT_CODE/ or vt.tiktok.com/SHORT_CODE/
  // These are short URLs that redirect, so we'll use them as-is
  const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([a-zA-Z0-9]+)/)
  if (shortMatch) return shortMatch[1]

  return null
}

/**
 * Extract Spotify info from URL
 */
function extractSpotifyInfo(
  url: string
): { id: string; type: 'track' | 'album' | 'playlist' | 'episode' | 'show' } | null {
  // open.spotify.com/track/TRACK_ID
  const trackMatch = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)
  if (trackMatch) return { id: trackMatch[1], type: 'track' }

  // open.spotify.com/album/ALBUM_ID
  const albumMatch = url.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/)
  if (albumMatch) return { id: albumMatch[1], type: 'album' }

  // open.spotify.com/playlist/PLAYLIST_ID
  const playlistMatch = url.match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/)
  if (playlistMatch) return { id: playlistMatch[1], type: 'playlist' }

  // open.spotify.com/episode/EPISODE_ID (podcast episode)
  const episodeMatch = url.match(/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/)
  if (episodeMatch) return { id: episodeMatch[1], type: 'episode' }

  // open.spotify.com/show/SHOW_ID (podcast)
  const showMatch = url.match(/open\.spotify\.com\/show\/([a-zA-Z0-9]+)/)
  if (showMatch) return { id: showMatch[1], type: 'show' }

  return null
}

/**
 * Check if URL is from an allowed iframe domain
 */
function isAllowedIframeDomain(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    return ALLOWED_IFRAME_DOMAINS.some((domain) => hostname === domain || hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

/**
 * Check if URL points to a video file
 */
function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Check if URL points to an image file
 */
function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Detect embed type from URL
 */
export function detectEmbed(url: string): EmbedInfo | null {
  // Skip image URLs (handled separately)
  if (isImageUrl(url)) return null

  // YouTube (including Shorts)
  const youtubeInfo = extractYouTubeInfo(url)
  if (youtubeInfo) {
    return {
      type: youtubeInfo.isShorts ? 'youtube-shorts' : 'youtube',
      url,
      videoId: youtubeInfo.videoId,
    }
  }

  // Twitter/X
  const tweetId = extractTweetId(url)
  if (tweetId) {
    return { type: 'twitter', url, tweetId }
  }

  // Instagram
  const instagramInfo = extractInstagramInfo(url)
  if (instagramInfo) {
    return {
      type: 'instagram',
      url,
      instagramId: instagramInfo.id,
      instagramType: instagramInfo.type,
    }
  }

  // TikTok
  const tiktokId = extractTikTokId(url)
  if (tiktokId) {
    return { type: 'tiktok', url, tiktokId }
  }

  // Spotify
  const spotifyInfo = extractSpotifyInfo(url)
  if (spotifyInfo) {
    return {
      type: 'spotify',
      url,
      spotifyId: spotifyInfo.id,
      spotifyType: spotifyInfo.type,
    }
  }

  // Direct video file
  if (isVideoUrl(url)) {
    return { type: 'video', url }
  }

  // Allowed iframe domains (games, demos)
  if (isAllowedIframeDomain(url)) {
    return { type: 'iframe', url, iframeSrc: url }
  }

  // Default: OGP link preview for other URLs
  return { type: 'ogp', url }
}

/**
 * Extract all embeddable URLs from content
 */
export function extractEmbeds(content: string): EmbedInfo[] {
  const urls = content.match(URL_REGEX) || []
  const embeds: EmbedInfo[] = []
  const seenUrls = new Set<string>()

  for (const url of urls) {
    // Clean URL: remove trailing punctuation, parentheses, and non-ASCII chars (e.g. Japanese)
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

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

/**
 * Get YouTube embed URL
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
}

/**
 * Get YouTube Shorts embed URL
 */
export function getYouTubeShortsEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
}

/**
 * Get Instagram embed URL
 */
export function getInstagramEmbedUrl(id: string): string {
  return `https://www.instagram.com/p/${id}/embed`
}

/**
 * Get Spotify embed URL
 */
export function getSpotifyEmbedUrl(id: string, type: 'track' | 'album' | 'playlist' | 'episode' | 'show'): string {
  return `https://open.spotify.com/embed/${type}/${id}`
}
