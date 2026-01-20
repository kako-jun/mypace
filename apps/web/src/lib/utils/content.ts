import { URL_REGEX } from './embed'

/**
 * Normalize content by trimming trailing ASCII spaces/tabs from each line
 * and removing leading/trailing ASCII whitespace from the entire content.
 * Preserves full-width spaces (U+3000) which are intentional in Japanese text.
 */
export function normalizeContent(content: string): string {
  return content
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, '')) // Only trim ASCII spaces and tabs
    .join('\n')
    .replace(/^[\n\r ]+|[\n\r ]+$/g, '') // Only trim newlines and ASCII spaces at start/end
}

// Super mention path extraction regex (@@path format, excluding URLs)
const SUPER_MENTION_PATH_REGEX =
  /@@([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-:.?=&%#,/]+)/g
const URL_PATTERN = /^(https?:\/\/)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\/.*)?$/

/**
 * Extract super mention paths from content (for Wikidata lookup)
 * Returns unique paths, excluding URL-like patterns
 */
export function extractSuperMentionPaths(content: string): string[] {
  const paths: string[] = []
  let match
  // Reset regex state
  SUPER_MENTION_PATH_REGEX.lastIndex = 0
  while ((match = SUPER_MENTION_PATH_REGEX.exec(content)) !== null) {
    const path = match[1]
    // Skip URL references - they don't need Wikidata lookup
    if (!URL_PATTERN.test(path)) {
      paths.push(path)
    }
  }
  return [...new Set(paths)]
}

/**
 * Extract OGP-eligible URLs from content
 * Excludes known embed types (YouTube, Twitter, etc.), images, videos, audios
 */
export function extractOgpUrls(content: string): string[] {
  // Remove code blocks before extracting URLs
  const contentWithoutCode = content
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`[^`\n]+`/g, '') // inline code

  const urls = contentWithoutCode.match(URL_REGEX) || []
  const ogpUrls: string[] = []
  const seenUrls = new Set<string>()

  // Known non-OGP patterns
  const skipPatterns = [
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i, // YouTube
    /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i, // Twitter/X
    /^https?:\/\/(www\.)?instagram\.com\//i, // Instagram
    /^https?:\/\/(www\.)?tiktok\.com\//i, // TikTok
    /^https?:\/\/open\.spotify\.com\//i, // Spotify
    /^https?:\/\/([\w-]+\.)?wikipedia\.org\//i, // Wikipedia
    /^https?:\/\/mypace\.llll-ll\.com(\/|$)/i, // Internal
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif|heic)(\?|$)/i, // Images
    /\.(mp4|webm|mov|avi|mkv)(\?|$)/i, // Videos
    /\.(mp3|wav|ogg|m4a|flac)(\?|$)/i, // Audios
  ]

  for (const url of urls) {
    const cleanUrl = url.replace(/[.,;:!?)\]}>）」』】\u3000-\u9FFF\uFF00-\uFFEF]+$/, '')
    if (seenUrls.has(cleanUrl)) continue
    seenUrls.add(cleanUrl)

    // Skip non-OGP patterns
    if (skipPatterns.some((pattern) => pattern.test(cleanUrl))) continue

    ogpUrls.push(cleanUrl)
  }

  return ogpUrls
}

/**
 * Extract all paths and URLs from multiple contents at once
 */
export function extractFromContents(contents: string[]): {
  superMentionPaths: string[]
  ogpUrls: string[]
} {
  const allPaths: string[] = []
  const allUrls: string[] = []

  for (const content of contents) {
    allPaths.push(...extractSuperMentionPaths(content))
    allUrls.push(...extractOgpUrls(content))
  }

  return {
    superMentionPaths: [...new Set(allPaths)],
    ogpUrls: [...new Set(allUrls)],
  }
}

/**
 * Check if content contains a hashtag or super mention (Japanese-aware)
 */
export function contentHasTag(content: string, tag: string): boolean {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Super mention: /label → search for @@label in content
  if (tag.startsWith('/')) {
    const label = escapedTag.slice(1) // Remove leading /
    return new RegExp(`@@${label}(?=[\\s\\u3000]|$)`, 'i').test(content)
  }

  // Regular hashtag: #tag
  return new RegExp(
    `#${escapedTag}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`,
    'i'
  ).test(content)
}
