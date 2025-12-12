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

// Hashtag regex (supports ASCII and Japanese characters)
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+)/g

// Process hashtags in HTML (after markdown parsing)
function processHashtags(html: string): string {
  return html.replace(HASHTAG_REGEX, (match, tag) => {
    const escapedTag = escapeHtml(tag)
    const randomDelay = Math.random() * 18 // Random delay within 18s cycle
    return `<button class="content-hashtag" data-tag="${escapedTag}" style="animation-delay: ${randomDelay.toFixed(1)}s">${escapeHtml(match)}</button>`
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
    return `${before}<span class="content-image-wrapper"><img src="${url}" alt="" class="content-image" data-lightbox="${url}" loading="lazy" /></span>${after}`
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

// Process Nostr URIs (NIP-19 mentions and references)
function processNostrMentions(html: string, profiles: Record<string, Profile | null | undefined>): string {
  return html.replace(NOSTR_URI_REGEX, (match, encoded: string) => {
    try {
      const decoded = nip19.decode(encoded)
      const type = decoded.type

      if (type === 'npub') {
        const pubkey = decoded.data as string
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        return `<a href="/profile/${pubkey}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'nprofile') {
        const data = decoded.data as { pubkey: string; relays?: string[] }
        const pubkey = data.pubkey
        const profile = profiles[pubkey]
        const displayName = profile?.name || profile?.display_name || `${encoded.slice(0, 12)}...`
        return `<a href="/profile/${pubkey}" class="nostr-mention" data-pubkey="${pubkey}">@${escapeHtml(displayName)}</a>`
      }

      if (type === 'note') {
        const noteId = decoded.data as string
        return `<a href="/post/${noteId}" class="nostr-note-ref">📝 note</a>`
      }

      if (type === 'nevent') {
        const data = decoded.data as { id: string; relays?: string[]; author?: string }
        return `<a href="/post/${data.id}" class="nostr-note-ref">📝 note</a>`
      }

      return match
    } catch {
      // Invalid encoding, return as-is
      return match
    }
  })
}

export function renderContent(
  content: string,
  emojis: EmojiTag[] = [],
  profiles: Record<string, Profile | null | undefined> = {}
) {
  // Parse markdown
  let html = marked.parse(content) as string

  // Process additional elements
  html = processImageUrls(html)
  html = removeImageLinks(html)
  html = processNostrMentions(html, profiles)
  html = processHashtags(html)
  html = processLinks(html)
  html = processCustomEmojis(html, emojis)

  const contentRef = useRef<HTMLDivElement>(null)

  // Handle image errors after render
  useEffect(() => {
    if (!contentRef.current) return

    const images = contentRef.current.querySelectorAll('.content-image')
    images.forEach((img) => {
      const imgEl = img as HTMLImageElement
      imgEl.onerror = () => {
        imgEl.style.display = 'none'
        const errorDiv = document.createElement('div')
        errorDiv.className = 'content-image-error'
        errorDiv.textContent = '404'
        imgEl.parentNode?.appendChild(errorDiv)
      }
    })
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
