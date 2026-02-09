// URL extraction regex
export const URL_REGEX = /https?:\/\/[^\s<"]+/gi

// Allowed domains for iframe embeds
export const ALLOWED_IFRAME_DOMAINS = [
  'github.io',
  'itch.io',
  'itch.zone',
  'newgrounds.com',
  'codepen.io',
  'codesandbox.io',
  'jsfiddle.net',
  'glitch.me',
  'vercel.app',
  'netlify.app',
  'pages.dev',
]

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']

export function isAllowedIframeDomain(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    return ALLOWED_IFRAME_DOMAINS.some((domain) => hostname === domain || hostname.endsWith('.' + domain))
  } catch {
    return false
  }
}

export function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}

export function isAudioUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return AUDIO_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}

// Keywords in URL path that suggest the URL serves an image
const IMAGE_PATH_KEYWORD_REGEX = /[/_-](image|img|photo|picture|thumbnail|thumb)([/_-]|$)/i

// File extensions that indicate the URL is NOT an image
const NON_IMAGE_EXTENSION_REGEX = /\.(html?|json|xml|js|css|txt|pdf|zip|tar|gz|mp[34]|wav|ogg|webm|mov|avi)$/i

export function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext))) return true
    // Check for image keywords in path (for extensionless image URLs like /api/article-image?...)
    if (!NON_IMAGE_EXTENSION_REGEX.test(pathname) && IMAGE_PATH_KEYWORD_REGEX.test(pathname)) return true
    return false
  } catch {
    return false
  }
}
