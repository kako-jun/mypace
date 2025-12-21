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

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac']
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

export function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}
