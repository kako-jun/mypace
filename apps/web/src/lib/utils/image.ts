// Image URL regex pattern
const IMAGE_EXTENSIONS_PATTERN = '(jpg|jpeg|png|gif|webp|svg)'

// Match image URLs in content
const IMAGE_URL_REGEX = new RegExp(`https?://[^\\s<>"]+\\.${IMAGE_EXTENSIONS_PATTERN}(\\?[^\\s<>"]*)?`, 'gi')

// Extract image URLs from content
export function getImageUrls(content: string): string[] {
  return content.match(IMAGE_URL_REGEX) || []
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
