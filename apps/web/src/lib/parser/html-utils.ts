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

// Process audio URLs (standalone URLs that are audio files)
export function processAudioUrls(html: string): string {
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<"]+\.(mp3|wav|ogg|m4a|webm|mp4)(\?[^\s<"]*)?)([\s<]|$)/gim
  return html.replace(urlRegex, (_match, before, url, ext, _query, after) => {
    // Audio extensions (ogg is typically audio, video uses .ogv)
    // Also check for ?audio marker (used by VoicePicker for webm audio)
    const isAudio =
      ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext.toLowerCase()) ||
      url.includes('/av/') ||
      url.includes('?audio')
    if (isAudio) {
      return `${before}<div class="content-audio-wrapper"><audio src="${url}" controls class="content-audio"></audio></div>${after}`
    } else {
      return `${before}<div class="content-video-wrapper"><video src="${url}" controls class="content-video"></video></div>${after}`
    }
  })
}

// Remove links that wrap audio/video (marked auto-links media URLs)
export function removeMediaLinks(html: string): string {
  html = html.replace(/<a[^>]*>(\s*<div class="content-audio-wrapper">.*?<\/div>\s*)<\/a>/gi, '$1')
  html = html.replace(/<a[^>]*>(\s*<div class="content-video-wrapper">.*?<\/div>\s*)<\/a>/gi, '$1')
  return html
}

// Process wordrot word highlights (inline highlighting of collectible words)
export function processWordHighlights(html: string, words: string[], collectedWords?: Set<string>): string {
  if (!words || words.length === 0) return html

  // Sort words by length descending to match longer words first
  const sortedWords = [...words].sort((a, b) => b.length - a.length)

  // Escape special regex characters
  const escapedWords = sortedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  // Create pattern that matches any of the words
  const pattern = escapedWords.join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  // Split HTML into tag and text segments
  const segments: Array<{ type: 'tag' | 'text'; content: string }> = []
  let lastIndex = 0
  const tagRegex = /<[^>]+>/g
  let tagMatch

  while ((tagMatch = tagRegex.exec(html)) !== null) {
    // Text before the tag
    if (tagMatch.index > lastIndex) {
      segments.push({ type: 'text', content: html.slice(lastIndex, tagMatch.index) })
    }
    // The tag itself
    segments.push({ type: 'tag', content: tagMatch[0] })
    lastIndex = tagRegex.lastIndex
  }

  // Remaining text after last tag
  if (lastIndex < html.length) {
    segments.push({ type: 'text', content: html.slice(lastIndex) })
  }

  // Process only text segments
  const result = segments.map((segment) => {
    if (segment.type === 'tag') return segment.content

    // Replace words in text content
    return segment.content.replace(regex, (match) => {
      // Find the original word (case-insensitive lookup)
      const word = words.find((w) => w.toLowerCase() === match.toLowerCase()) || match
      const isCollected = collectedWords?.has(word) || false
      const collectedClass = isCollected ? ' collected' : ''
      const title = isCollected ? `${word} (collected)` : `Collect: ${word}`

      return `<button class="wordrot-highlight${collectedClass}" data-word="${escapeHtml(word)}" title="${title}">${match}</button>`
    })
  })

  return result.join('')
}
