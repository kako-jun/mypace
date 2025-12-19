import { Marked } from 'marked'
import { sanitizeHtml } from './html-utils'
import { processFontSyntax } from './font-syntax'

const ALIGN_PLACEHOLDER_PREFIX = 'MYPACEALIGN'
const ALIGN_PLACEHOLDER_SUFFIX = 'ENDMYPACE'

interface AlignmentData {
  type: 'left' | 'right' | 'center' | 'split'
  content: string
  content2?: string
}

export function extractAlignments(content: string): { text: string; alignments: Map<string, AlignmentData> } {
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

export function restoreAlignments(html: string, alignments: Map<string, AlignmentData>, marked: Marked): string {
  let result = html
  for (const [placeholder, data] of alignments) {
    let replacement: string
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

    result = result.replace(new RegExp(`<p>${placeholder}</p>`, 'g'), replacement)
    result = result.replace(new RegExp(placeholder, 'g'), replacement)
  }

  result = result.replace(/<\/div><br>[ \t\n\r]*<div class="align-/g, '</div><div class="align-')
  result = result.replace(/<p>[ \t\n\r]*<\/p>/g, '')

  return result
}
