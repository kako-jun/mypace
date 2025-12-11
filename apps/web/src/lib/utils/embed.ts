// Embed URL detection and parsing utilities

export type EmbedType = 'youtube' | 'twitter' | 'video' | 'iframe' | 'ogp'

export interface EmbedInfo {
  type: EmbedType
  url: string
  // YouTube specific
  videoId?: string
  // Twitter specific
  tweetId?: string
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
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch) return shortsMatch[1]

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
  const pathname = new URL(url).pathname.toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))
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

  // YouTube
  const youtubeId = extractYouTubeId(url)
  if (youtubeId) {
    return { type: 'youtube', url, videoId: youtubeId }
  }

  // Twitter/X
  const tweetId = extractTweetId(url)
  if (tweetId) {
    return { type: 'twitter', url, tweetId }
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
    // Clean URL (remove trailing punctuation)
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '')
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
