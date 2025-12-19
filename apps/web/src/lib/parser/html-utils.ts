// HTML utilities

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Escape all HTML tags (no exceptions - font syntax is processed after escaping)
export function sanitizeHtml(content: string): string {
  return content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Add target="_blank" to links with random animation delay
export function processLinks(html: string): string {
  return html.replace(/<a href="/g, () => {
    const randomDelay = Math.random() * 12
    return `<a class="content-link" style="animation-delay: ${randomDelay.toFixed(1)}s" target="_blank" rel="noopener noreferrer" href="`
  })
}

// YouTube thumbnail URL patterns to exclude from image processing
const YOUTUBE_THUMBNAIL_REGEX = /^https?:\/\/(img\.youtube\.com|i\.ytimg\.com)\//i

// Process image URLs (standalone URLs that are images)
export function processImageUrls(html: string): string {
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<"]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<"]*)?)([\s<]|$)/gim
  return html.replace(urlRegex, (_match, before, url, _ext, _query, after) => {
    if (YOUTUBE_THUMBNAIL_REGEX.test(url)) {
      return _match
    }
    return `${before}<span class="content-image-wrapper"><img src="${url}" alt="404" class="content-image" data-lightbox="${url}" /></span>${after}`
  })
}

// Remove links that wrap images (marked auto-links image URLs)
export function removeImageLinks(html: string): string {
  return html.replace(/<a[^>]*>(\s*<span class="content-image-wrapper">.*?<\/span>\s*)<\/a>/gi, '$1')
}
