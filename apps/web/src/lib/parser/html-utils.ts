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

// Internal mypace URL pattern
const INTERNAL_URL_REGEX = /^https?:\/\/mypace\.llll-ll\.com(\/|$)/i

// Add target="_blank" to external links, mark internal links for SPA routing
// Skip links that already have a class attribute (e.g., content-q-badge)
export function processLinks(html: string): string {
  // Match <a href="..." that is NOT followed by a class attribute
  // Use negative lookahead to skip links that already have class
  return html.replace(/<a href="([^"]+)"(?![^>]*\bclass=)/g, (_match, url) => {
    const randomDelay = Math.random() * 12
    if (INTERNAL_URL_REGEX.test(url)) {
      // Internal link: extract path for SPA routing
      const path = url.replace(/^https?:\/\/mypace\.llll-ll\.com/, '') || '/'
      return `<a class="content-link content-link-internal" style="animation-delay: ${randomDelay.toFixed(1)}s" href="${path}" data-internal="true"`
    }
    return `<a class="content-link" style="animation-delay: ${randomDelay.toFixed(1)}s" target="_blank" rel="noopener noreferrer" href="${url}"`
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
