// Image URL regex pattern
const IMAGE_EXTENSIONS_PATTERN = '(jpg|jpeg|png|gif|webp|svg)'

// Match image URLs in content
const IMAGE_URL_REGEX = new RegExp(`https?://[^\\s<>"]+\\.${IMAGE_EXTENSIONS_PATTERN}(\\?[^\\s<>"]*)?`, 'gi')

// Keywords in URL path that suggest the URL serves an image
const IMAGE_PATH_KEYWORD_REGEX = /[/_-](image|img|photo|picture|thumbnail|thumb)([/_-]|$)/i

// File extensions that indicate the URL is NOT an image
const NON_IMAGE_EXTENSION_REGEX = /\.(html?|json|xml|js|css|txt|pdf|zip|tar|gz|mp[34]|wav|ogg|webm|mov|avi)(\?|&|#|$)/i

// Check if URL has a known image extension
const HAS_IMAGE_EXTENSION_REGEX = /\.(jpg|jpeg|png|gif|webp|svg)(\?|&|#|$)/i

// Extract image URLs from content
export function getImageUrls(content: string): string[] {
  const extensionMatches = content.match(IMAGE_URL_REGEX) || []

  // Also match URLs with image keywords in path (extensionless image URLs)
  const allUrlRegex = /https?:\/\/[^\s<>"]+/gi
  const allUrls = content.match(allUrlRegex) || []
  const keywordMatches = allUrls.filter((url) => {
    // Skip URLs already matched by extension
    if (HAS_IMAGE_EXTENSION_REGEX.test(url)) return false
    // Skip known non-image extensions
    if (NON_IMAGE_EXTENSION_REGEX.test(url)) return false
    try {
      const pathname = new URL(url).pathname.toLowerCase()
      return IMAGE_PATH_KEYWORD_REGEX.test(pathname)
    } catch {
      return false
    }
  })

  return [...extensionMatches, ...keywordMatches]
}

// Remove image URL from content
export function removeImageUrl(content: string, urlToRemove: string): string {
  const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\n?${escapedUrl}\\n?`, 'g')
  return content
    .replace(regex, '\n')
    .replace(/^\n+|\n+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
}
