import { useEffect, useRef } from 'react'
import { Marked } from 'marked'
import Prism from 'prismjs'
import type { EmojiTag, ProfileMap } from '../../types'

// Import parser utilities from individual modules
import {
  getHashtagClickHandler,
  getImageClickHandler,
  getSuperMentionClickHandler,
  getInternalLinkClickHandler,
  getWordrotClickHandler,
} from './callbacks'
import {
  escapeHtml,
  sanitizeHtml,
  processLinks,
  processImageUrls,
  processImageKeywordUrls,
  removeImageLinks,
  processAudioUrls,
  removeMediaLinks,
  processWordHighlights,
} from './html-utils'
import { extractAlignments, restoreAlignments } from './alignment'
import { processFontSyntax } from './font-syntax'
import { extractCodeBlocks, restoreCodeBlocks } from './code-blocks'
import { processHashtags, processSuperMentions, processNostrMentions, processUserMentions } from './nostr-tags'
import { processCustomEmojis } from './emoji'

// Load common Prism languages
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

// Configure marked with Prism highlighting
const marked = new Marked({
  breaks: true,
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

export function renderContent(
  content: string,
  emojis: EmojiTag[] = [],
  profiles: ProfileMap = {},
  wikidataMap: Record<string, string> = {},
  wordrotWords?: string[],
  wordrotCollected?: Set<string>
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
  html = restoreAlignments(html, alignments, marked)

  // 6. Process font syntax (works on escaped &lt;font&gt; form)
  html = processFontSyntax(html)

  // 7. Process additional elements
  html = processImageUrls(html)
  html = processImageKeywordUrls(html)
  html = removeImageLinks(html)
  html = processAudioUrls(html)
  html = removeMediaLinks(html)
  html = processNostrMentions(html, profiles)
  html = processHashtags(html)
  html = processSuperMentions(html, wikidataMap)
  html = processUserMentions(html, profiles)
  html = processLinks(html)
  html = processCustomEmojis(html, emojis)

  // 8. Process wordrot word highlights (before restoring code blocks)
  if (wordrotWords && wordrotWords.length > 0) {
    console.log('[ContentParser] Processing wordrot highlights:', wordrotWords.length, 'words')
    html = processWordHighlights(html, wordrotWords, wordrotCollected)
  }

  // 9. Restore code blocks LAST (content was protected from all processing)
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
    const hashtagHandler = getHashtagClickHandler()
    const superMentionHandler = getSuperMentionClickHandler()
    const imageHandler = getImageClickHandler()
    const internalLinkHandler = getInternalLinkClickHandler()
    const wordrotHandler = getWordrotClickHandler()

    if (target.classList.contains('content-hashtag')) {
      const tag = target.getAttribute('data-tag')
      if (tag && hashtagHandler) {
        e.preventDefault()
        e.stopPropagation()
        hashtagHandler(tag)
      }
    }
    if (target.classList.contains('content-super-mention') || target.classList.contains('super-mention-prefix')) {
      const button = target.classList.contains('super-mention-prefix') ? target.parentElement : target
      const path = button?.getAttribute('data-ref')
      if (path && superMentionHandler) {
        e.preventDefault()
        e.stopPropagation()
        superMentionHandler(path)
      }
    }
    if (target.classList.contains('content-image')) {
      e.preventDefault()
      e.stopPropagation()
      const src = target.getAttribute('data-lightbox')
      if (src && imageHandler) {
        imageHandler(src)
      }
    }
    // Handle internal links (SPA navigation)
    if (target.classList.contains('content-link-internal') || target.closest('.content-link-internal')) {
      e.preventDefault()
      const link = target.classList.contains('content-link-internal')
        ? target
        : target.closest('.content-link-internal')
      const href = link?.getAttribute('href')
      if (href && internalLinkHandler) {
        internalLinkHandler(href)
      }
    }
    // Handle wordrot word clicks
    if (target.classList.contains('wordrot-highlight')) {
      e.preventDefault()
      e.stopPropagation()
      const word = target.getAttribute('data-word')
      if (word && wordrotHandler) {
        wordrotHandler(word)
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
