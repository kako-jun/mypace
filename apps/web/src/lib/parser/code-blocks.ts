import Prism from 'prismjs'
import { escapeHtml } from './html-utils'

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
export function extractCodeBlocks(content: string): { text: string; codeBlocks: Map<string, CodeBlockData> } {
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
  result = result.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const placeholder = `${INLINE_CODE_PLACEHOLDER_PREFIX}${placeholderIndex}${INLINE_CODE_PLACEHOLDER_SUFFIX}`
    codeBlocks.set(placeholder, { type: 'inline', content: code })
    placeholderIndex++
    return placeholder
  })

  return { text: result, codeBlocks }
}

// Restore code blocks after all processing
export function restoreCodeBlocks(html: string, codeBlocks: Map<string, CodeBlockData>): string {
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

    result = result.replace(new RegExp(`<p>${placeholder}</p>`, 'g'), replacement)
    result = result.replace(new RegExp(placeholder, 'g'), replacement)
  }

  return result
}
