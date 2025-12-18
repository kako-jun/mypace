import { useEffect, useRef } from 'react'
import { Marked } from 'marked'
import Prism from 'prismjs'
import { nip19 } from 'nostr-tools'
import type { EmojiTag } from '../types'
import type { Profile } from '../types'

// Load common languages
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

// Callback for hashtag clicks
let onHashtagClick: ((tag: string) => void) | null = null

export function setHashtagClickHandler(handler: (tag: string) => void) {
  onHashtagClick = handler
}

export function clearHashtagClickHandler() {
  onHashtagClick = null
}

// Callback for image clicks (LightBox)
let onImageClick: ((src: string) => void) | null = null

export function setImageClickHandler(handler: (src: string) => void) {
  onImageClick = handler
}

export function clearImageClickHandler() {
  onImageClick = null
}

// Configure marked with Prism highlighting
const marked = new Marked({
  breaks: true, // Convert single line breaks to <br>
  renderer: {
    code(token) {
      const lang = token.lang || ''
      const code = token.text

      let highlighted: string
      if (lang && Prism.languages[lang]) {
        highlighted = Prism.highlight(code, Prism.languages[lang], lang)
      } else {
        highlighted = escapeHtml(code)
      }

      return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${highlighted}</code></pre>`
    },
    codespan(token) {
      return `<code class="inline-code">${escapeHtml(token.text)}</code>`
    },
  },
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Alignment syntax processing
// Uses placeholder approach to avoid Markdown interference
// Using unlikely character sequence that won't be interpreted by Markdown
const ALIGN_PLACEHOLDER_PREFIX = 'MYPACEALIGN'
const ALIGN_PLACEHOLDER_SUFFIX = 'ENDMYPACE'

interface AlignmentData {
  type: 'left' | 'right' | 'center' | 'split'
  content: string
  content2?: string
}

function extractAlignments(content: string): { text: string; alignments: Map<string, AlignmentData> } {
  const lines = content.split('\n')
  const alignments = new Map<string, AlignmentData>()
  let placeholderIndex = 0

  const result = lines.map((line) => {
    let data: AlignmentData | null = null

    // Left-right split: <> left | right
    if (line.startsWith('<> ')) {
      const rest = line.slice(3)
      const parts = rest.split('|').map((p) => p.trim())
      if (parts.length >= 2) {
        data = { type: 'split', content: parts[0], content2: parts[1] }
      } else {
        data = { type: 'split', content: rest }
      }
    }
    // Left align: <<
    else if (line.startsWith('<< ')) {
      data = { type: 'left', content: line.slice(3) }
    } else if (line === '<<') {
      data = { type: 'left', content: '' }
    }
    // Right align: >>
    else if (line.startsWith('>> ')) {
      data = { type: 'right', content: line.slice(3) }
    } else if (line === '>>') {
      data = { type: 'right', content: '' }
    }
    // Center align: ><
    else if (line.startsWith('>< ')) {
      data = { type: 'center', content: line.slice(3) }
    } else if (line === '><') {
      data = { type: 'center', content: '' }
    }

    if (data) {
      const placeholder = `${ALIGN_PLACEHOLDER_PREFIX}${placeholderIndex}${ALIGN_PLACEHOLDER_SUFFIX}`
      alignments.set(placeholder, data)
      placeholderIndex++
      return placeholder
    }
    return line
  })

  return { text: result.join('\n'), alignments }
}

function restoreAlignments(html: string, alignments: Map<string, AlignmentData>): string {
  let result = html
  for (const [placeholder, data] of alignments) {
    let replacement: string
    // Sanitize all HTML, parse markdown inline, then process font syntax
    const processAlignContent = (text: string): string => {
      if (!text) return '&nbsp;'
      const sanitized = sanitizeHtml(text)
      const parsed = marked.parseInline(sanitized) as string
      return processFontSyntax(parsed)
    }
    const content = processAlignContent(data.content)
    const content2 = data.content2 ? processAlignContent(data.content2) : ''

    switch (data.type) {
      case 'left':
        replacement = `<div class="align-left">${content}</div>`
        break
      case 'right':
        replacement = `<div class="align-right">${content}</div>`
        break
      case 'center':
        replacement = `<div class="align-center">${content}</div>`
        break
      case 'split':
        replacement = `<div class="align-split"><span>${content}</span><span>${content2}</span></div>`
        break
    }

    // Replace placeholder (may be wrapped in <p> tags by marked)
    result = result.replace(new RegExp(`<p>${placeholder}</p>`, 'g'), replacement)
    result = result.replace(new RegExp(placeholder, 'g'), replacement)
  }

  // Remove <br> between consecutive alignment divs
  result = result.replace(/<\/div><br>[ \t\n\r]*<div class="align-/g, '</div><div class="align-')
  // Remove truly empty <p></p> tags (only ASCII whitespace, not full-width spaces)
  result = result.replace(/<p>[ \t\n\r]*<\/p>/g, '')

  return result
}

// Font syntax processing (color and size only)
// Matches escaped font syntax: &lt;font ...&gt;...&lt;/font&gt;
const ESCAPED_FONT_TAG_REGEX = /&lt;font(\s+[^&]*)&gt;([\s\S]*?)&lt;\/font&gt;/gi
// Unclosed font syntax - match to end of line or next tag
const ESCAPED_UNCLOSED_FONT_TAG_REGEX = /&lt;font(\s+[^&]*)&gt;([^&]*)/gi
const COLOR_ATTR_REGEX = /color=(?:["']([^"']+)["']|([^\s&]+))/i
const SIZE_ATTR_REGEX = /size=(?:["']([1-5])["']|([1-5]))/i

const ALLOWED_COLORS = new Set([
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
  'cyan',
  'magenta',
  'lime',
  'navy',
  'teal',
  'maroon',
  'white',
  'black',
  'gray',
  'grey',
  'silver',
])

const SIZE_MAP: Record<string, string> = {
  '1': '0.5em',
  '2': '0.75em',
  '3': '1em',
  '4': '1.5em',
  '5': '2em',
}

function isValidColor(color: string): boolean {
  if (ALLOWED_COLORS.has(color.toLowerCase())) return true
  if (/^#[0-9A-Fa-f]{3}$/.test(color) || /^#[0-9A-Fa-f]{6}$/.test(color)) return true
  return false
}

function processFontSyntax(html: string): string {
  // Helper to extract styles from attributes
  const extractStyles = (attrs: string): string[] => {
    const styles: string[] = []

    const colorMatch = attrs.match(COLOR_ATTR_REGEX)
    const colorValue = colorMatch ? colorMatch[1] || colorMatch[2] : null
    if (colorValue && isValidColor(colorValue)) {
      styles.push(`color: ${colorValue}`)
    }

    const sizeMatch = attrs.match(SIZE_ATTR_REGEX)
    const sizeValue = sizeMatch ? sizeMatch[1] || sizeMatch[2] : null
    if (sizeValue && SIZE_MAP[sizeValue]) {
      styles.push(`font-size: ${SIZE_MAP[sizeValue]}`)
    }

    return styles
  }

  // Process repeatedly to handle nested font syntax
  let result = html
  let prevResult = ''

  // First pass: process closed font syntax (escaped form)
  while (result !== prevResult) {
    prevResult = result
    result = result.replace(ESCAPED_FONT_TAG_REGEX, (_match, attrs: string, content: string) => {
      const styles = extractStyles(attrs)
      if (styles.length === 0) return content
      return `<span style="${styles.join('; ')}">${content}</span>`
    })
  }

  // Second pass: process unclosed font syntax (escaped form)
  result = result.replace(ESCAPED_UNCLOSED_FONT_TAG_REGEX, (_match, attrs: string, content: string) => {
    const styles = extractStyles(attrs)
    if (styles.length === 0) return content
    return `<span style="${styles.join('; ')}">${content}</span>`
  })

  return result
}

// Hashtag regex (requires whitespace or start of string before #)
const HASHTAG_REGEX = /(^|[\s>])#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g

// Process hashtags in HTML (after markdown parsing)
function processHashtags(html: string): string {
  return html.replace(HASHTAG_REGEX, (match, prefix, tag) => {
    const escapedTag = escapeHtml(tag)
    const randomDelay = Math.random() * 18 // Random delay within 18s cycle
    return `${prefix}<button class="content-hashtag" data-tag="${escapedTag}" style="animation-delay: ${randomDelay.toFixed(1)}s">#${escapeHtml(tag)}</button>`
  })
}

// YouTube thumbnail URL patterns to exclude from image processing
const YOUTUBE_THUMBNAIL_REGEX = /^https?:\/\/(img\.youtube\.com|i\.ytimg\.com)\//i

// Process image URLs (standalone URLs that are images)
function processImageUrls(html: string): string {
  // Match URLs that are on their own line or surrounded by whitespace
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<"]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<"]*)?)([\s<]|$)/gim
  return html.replace(urlRegex, (_match, before, url, _ext, _query, after) => {
    // Skip YouTube thumbnail URLs (they're shown via YouTubeEmbed component)
    if (YOUTUBE_THUMBNAIL_REGEX.test(url)) {
      return _match
    }
    return `${before}<span class="content-image-wrapper"><img src="${url}" alt="404" class="content-image" data-lightbox="${url}" /></span>${after}`
  })
}

// Remove links that wrap images (marked auto-links image URLs)
function removeImageLinks(html: string): string {
  // Match <a> tags that contain only an image wrapper
  return html.replace(/<a[^>]*>(\s*<span class="content-image-wrapper">.*?<\/span>\s*)<\/a>/gi, '$1')
}

// Add target="_blank" to links with random animation delay
function processLinks(html: string): string {
  return html.replace(/<a href="/g, () => {
    const randomDelay = Math.random() * 12 // Random delay within 12s cycle
    return `<a class="content-link" style="animation-delay: ${randomDelay.toFixed(1)}s" target="_blank" rel="noopener noreferrer" href="`
  })
}

// Process custom emojis (NIP-30)
function processCustomEmojis(html: string, emojis: EmojiTag[]): string {
  if (!emojis.length) return html
  const emojiMap = new Map(emojis.map((e) => [e.shortcode, e.url]))
  return html.replace(/:([a-zA-Z0-9_]+):/g, (match, shortcode) => {
    const url = emojiMap.get(shortcode)
    if (url) {
      return `<img src="${escapeHtml(url)}" alt=":${escapeHtml(shortcode)}:" class="custom-emoji" loading="lazy" />`
    }
    return match
  })
}

// Nostr URI regex (NIP-19: npub, nprofile, note, nevent)
const NOSTR_URI_REGEX = /nostr:(npub1[a-zA-Z0-9]+|nprofile1[a-zA-Z0-9]+|note1[a-zA-Z0-9]+|nevent1[a-zA-Z0-9]+)/g

// Validate hex string length (pubkeys and event IDs should be 64 chars)
function isValidHex(hex: string, expectedLength = 64): boolean {
  return typeof hex === 'string' && hex.length === expectedLength && /^[0-9a-f]+$/i.test(hex)
}

// Process Nostr URIs (NIP-19 mentions and references)
function processNostrMentions(html: string, profiles: Record<string, Profile | null | undefined>): string {
  return html.replace(NOSTR_URI_REGEX, (match, encoded: string) => {
    try {
      const decoded = nip19.decode(encoded)
      const type = decoded.type

      if (type === 'npub') {
        const pubkey = decoded.data as string
        if (!isValidHex(pubkey)) return match
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        return `<a href="/profile/${pubkey}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'nprofile') {
        const data = decoded.data as { pubkey: string; relays?: string[] }
        const pubkey = data.pubkey
        if (!isValidHex(pubkey)) return match
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        return `<a href="/profile/${pubkey}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'note') {
        const noteId = decoded.data as string
        if (!isValidHex(noteId)) return match
        return `<a href="/post/${noteId}" class="nostr-note-ref">📝 note</a>`
      }

      if (type === 'nevent') {
        const data = decoded.data as { id: string; relays?: string[]; author?: string }
        if (!isValidHex(data.id)) return match
        return `<a href="/post/${data.id}" class="nostr-note-ref">📝 note</a>`
      }

      return match
    } catch {
      // Invalid encoding, return as-is
      return match
    }
  })
}

// Escape all HTML tags (no exceptions - font syntax is processed after escaping)
function sanitizeHtml(content: string): string {
  return content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Code block protection
const CODE_BLOCK_PLACEHOLDER_PREFIX = 'MYPACECODEBLOCK'
const CODE_BLOCK_PLACEHOLDER_SUFFIX = 'ENDCODEBLOCK'
const INLINE_CODE_PLACEHOLDER_PREFIX = 'MYPACEINLINECODE'
const INLINE_CODE_PLACEHOLDER_SUFFIX = 'ENDINLINECODE'

interface CodeBlockData {
  type: 'block' | 'inline'
  lang?: string
  content: string
}

// Extract code blocks and inline code before any processing
function extractCodeBlocks(content: string): { text: string; codeBlocks: Map<string, CodeBlockData> } {
  const codeBlocks = new Map<string, CodeBlockData>()
  let placeholderIndex = 0
  let result = content

  // Extract fenced code blocks first (``` ... ```)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const placeholder = `${CODE_BLOCK_PLACEHOLDER_PREFIX}${placeholderIndex}${CODE_BLOCK_PLACEHOLDER_SUFFIX}`
    codeBlocks.set(placeholder, { type: 'block', lang: lang || '', content: code })
    placeholderIndex++
    return placeholder
  })

  // Extract inline code (` ... `)
  // Use negative lookbehind/lookahead to avoid matching inside code blocks
  result = result.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const placeholder = `${INLINE_CODE_PLACEHOLDER_PREFIX}${placeholderIndex}${INLINE_CODE_PLACEHOLDER_SUFFIX}`
    codeBlocks.set(placeholder, { type: 'inline', content: code })
    placeholderIndex++
    return placeholder
  })

  return { text: result, codeBlocks }
}

// Restore code blocks after all processing
function restoreCodeBlocks(html: string, codeBlocks: Map<string, CodeBlockData>): string {
  let result = html

  for (const [placeholder, data] of codeBlocks) {
    let replacement: string

    if (data.type === 'block') {
      const lang = data.lang || ''
      let highlighted: string
      if (lang && Prism.languages[lang]) {
        highlighted = Prism.highlight(data.content, Prism.languages[lang], lang)
      } else {
        highlighted = escapeHtml(data.content)
      }
      replacement = `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${highlighted}</code></pre>`
    } else {
      replacement = `<code class="inline-code">${escapeHtml(data.content)}</code>`
    }

    // Replace placeholder (may be wrapped in <p> tags by marked)
    result = result.replace(new RegExp(`<p>${placeholder}</p>`, 'g'), replacement)
    result = result.replace(new RegExp(placeholder, 'g'), replacement)
  }

  return result
}

export function renderContent(
  content: string,
  emojis: EmojiTag[] = [],
  profiles: Record<string, Profile | null | undefined> = {}
) {
  // 1. Extract code blocks FIRST (protect from all processing)
  const { text: textWithCodePlaceholders, codeBlocks } = extractCodeBlocks(content)

  // 2. Extract alignment markers (before sanitizing, since they use < and >)
  const { text: textWithPlaceholders, alignments } = extractAlignments(textWithCodePlaceholders)

  // 3. Escape ALL HTML (no exceptions - font syntax processed after escaping)
  const sanitizedContent = sanitizeHtml(textWithPlaceholders)

  // 4. Parse markdown
  let html = marked.parse(sanitizedContent) as string

  // 5. Restore alignment markers (replace placeholders with actual HTML)
  html = restoreAlignments(html, alignments)

  // 6. Process font syntax (works on escaped &lt;font&gt; form)
  html = processFontSyntax(html)

  // 7. Process additional elements
  html = processImageUrls(html)
  html = removeImageLinks(html)
  html = processNostrMentions(html, profiles)
  html = processHashtags(html)
  html = processLinks(html)
  html = processCustomEmojis(html, emojis)

  // 8. Restore code blocks LAST (content was protected from all processing)
  html = restoreCodeBlocks(html, codeBlocks)

  const contentRef = useRef<HTMLDivElement>(null)

  // Handle image errors using event delegation with capture phase
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const handleError = (e: Event) => {
      const img = e.target as HTMLImageElement
      if (!img.classList.contains('content-image')) return

      const wrapper = img.parentElement
      if (!wrapper || wrapper.querySelector('.content-image-error')) return

      img.style.display = 'none'
      const errorDiv = document.createElement('div')
      errorDiv.className = 'content-image-error'
      errorDiv.textContent = '404'
      wrapper.appendChild(errorDiv)
    }

    // Use capture phase to catch errors before they bubble
    container.addEventListener('error', handleError, true)

    // Check images that may have already errored
    container.querySelectorAll('.content-image').forEach((img) => {
      const imgEl = img as HTMLImageElement
      if (imgEl.complete && imgEl.naturalHeight === 0 && imgEl.naturalWidth === 0) {
        const wrapper = imgEl.parentElement
        if (!wrapper || wrapper.querySelector('.content-image-error')) return

        imgEl.style.display = 'none'
        const errorDiv = document.createElement('div')
        errorDiv.className = 'content-image-error'
        errorDiv.textContent = '404'
        wrapper.appendChild(errorDiv)
      }
    })

    return () => container.removeEventListener('error', handleError, true)
  }, [html])

  // Handle clicks via event delegation
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('content-hashtag')) {
      const tag = target.getAttribute('data-tag')
      if (tag && onHashtagClick) {
        onHashtagClick(tag)
      }
    }
    if (target.classList.contains('content-image')) {
      e.preventDefault()
      e.stopPropagation()
      const src = target.getAttribute('data-lightbox')
      if (src && onImageClick) {
        onImageClick(src)
      }
    }
  }

  return (
    <div
      ref={contentRef}
      className="markdown-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Simple text render (for previews, etc.)
export function renderPlainText(content: string): string {
  return content.replace(/<[^>]*>/g, '').slice(0, 200)
}
