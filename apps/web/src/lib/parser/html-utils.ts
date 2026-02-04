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
// Only highlights words in plain text, not in code, links, hashtags, mentions, etc.
export function processWordHighlights(html: string, words: string[], collectedWords?: Set<string>): string {
  if (!words || words.length === 0) return html

  console.log('[processWordHighlights] Input:', {
    wordsCount: words.length,
    htmlLength: html.length,
    words: words.slice(0, 5),
  })

  // Sort words by length descending to match longer words first
  const sortedWords = [...words].sort((a, b) => b.length - a.length)

  // Escape special regex characters
  const escapedWords = sortedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  // Create pattern that matches any of the words
  const pattern = escapedWords.join('|')
  const regex = new RegExp(`(${pattern})`, 'gi')

  // Elements whose content should NOT be highlighted
  // These already have their own styling
  const skipElements = new Set([
    'a', // links
    'code', // inline code
    'pre', // code blocks
    'button', // existing buttons (hashtags, mentions, etc.)
    'img', // images
    'audio', // audio
    'video', // video
  ])

  // Split HTML into tag and text segments, tracking element depth
  const segments: Array<{ type: 'tag' | 'text'; content: string; skip: boolean }> = []
  let lastIndex = 0
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
  let tagMatch

  // Track which skip elements we're inside
  const skipStack: string[] = []

  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const isClosing = tagMatch[0].startsWith('</')
    const tagName = tagMatch[1].toLowerCase()

    // Text before the tag
    if (tagMatch.index > lastIndex) {
      const shouldSkip = skipStack.length > 0
      segments.push({ type: 'text', content: html.slice(lastIndex, tagMatch.index), skip: shouldSkip })
    }

    // Update skip stack
    if (skipElements.has(tagName)) {
      if (isClosing) {
        // Pop from stack if closing a skip element
        const lastIndex = skipStack.lastIndexOf(tagName)
        if (lastIndex !== -1) {
          skipStack.splice(lastIndex, 1)
        }
      } else if (!tagMatch[0].endsWith('/>')) {
        // Push to stack if opening a skip element (not self-closing)
        skipStack.push(tagName)
      }
    }

    // The tag itself (always skip processing tags themselves)
    segments.push({ type: 'tag', content: tagMatch[0], skip: true })
    lastIndex = tagRegex.lastIndex
  }

  // Remaining text after last tag
  if (lastIndex < html.length) {
    const shouldSkip = skipStack.length > 0
    segments.push({ type: 'text', content: html.slice(lastIndex), skip: shouldSkip })
  }

  // Process only text segments that aren't inside skip elements
  const result = segments.map((segment) => {
    if (segment.type === 'tag' || segment.skip) return segment.content

    // Replace words in text content
    return segment.content.replace(regex, (match) => {
      // Find the original word (case-insensitive lookup)
      const word = words.find((w) => w.toLowerCase() === match.toLowerCase()) || match
      // Case-insensitive collected check (compare lowercase)
      const isCollected = collectedWords?.has(word.toLowerCase()) || false
      const collectedClass = isCollected ? ' collected' : ''

      if (isCollected) {
        // Already collected - show as non-clickable span
        return `<span class="wordrot-highlight${collectedClass}" data-word="${escapeHtml(word)}" title="${word} (collected)">${match}</span>`
      } else {
        // Not collected - show as clickable button
        return `<button class="wordrot-highlight${collectedClass}" data-word="${escapeHtml(word)}" title="Collect: ${word}">${match}</button>`
      }
    })
  })

  const finalResult = result.join('')
  const highlightCount = (finalResult.match(/wordrot-highlight/g) || []).length
  console.log('[processWordHighlights] Output:', { highlightCount, resultLength: finalResult.length })
  return finalResult
}
