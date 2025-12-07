import { Marked } from 'marked'
import Prism from 'prismjs'

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
    return `<button class="content-hashtag" data-tag="${escapedTag}">${escapeHtml(match)}</button>`
  })
}

// Process image URLs (standalone URLs that are images)
function processImageUrls(html: string): string {
  // Match URLs that are on their own line or surrounded by whitespace
  const urlRegex = /(^|[\s>])(https?:\/\/[^\s<"]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<"]*)?)([\s<]|$)/gim
  return html.replace(urlRegex, (match, before, url, ext, query, after) => {
    return `${before}<span class="content-image-wrapper"><a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="" class="content-image" loading="lazy" /></a></span>${after}`
  })
}

// Add target="_blank" to links
function processLinks(html: string): string {
  return html.replace(/<a href="/g, '<a class="content-link" target="_blank" rel="noopener noreferrer" href="')
}

export function renderContent(content: string) {
  // Parse markdown
  let html = marked.parse(content) as string

  // Process additional elements
  html = processImageUrls(html)
  html = processHashtags(html)
  html = processLinks(html)

  // Handle hashtag clicks via event delegation
  const handleClick = (e: Event) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('content-hashtag')) {
      const tag = target.getAttribute('data-tag')
      if (tag && onHashtagClick) {
        onHashtagClick(tag)
      }
    }
  }

  return (
    <div
      class="markdown-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Simple text render (for previews, etc.)
export function renderPlainText(content: string): string {
  return content.replace(/<[^>]*>/g, '').slice(0, 200)
}
