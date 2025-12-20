// Font syntax processing (color and size only)
const ESCAPED_FONT_TAG_REGEX = /&lt;font(\s+[^&]*)&gt;([\s\S]*?)&lt;\/font&gt;/gi
const ESCAPED_UNCLOSED_FONT_TAG_REGEX = /&lt;font(\s+[^&]*)&gt;([^&]*)/gi
// Support both regular quotes ("') and HTML-escaped quotes (&quot;)
const COLOR_ATTR_REGEX = /color=(?:&quot;([^&]+)&quot;|["']([^"']+)["']|([^\s&]+))/i
const SIZE_ATTR_REGEX = /size=(?:&quot;([1-5])&quot;|["']([1-5])["']|([1-5]))/i

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

export function processFontSyntax(html: string): string {
  const extractStyles = (attrs: string): string[] => {
    const styles: string[] = []

    const colorMatch = attrs.match(COLOR_ATTR_REGEX)
    const colorValue = colorMatch ? colorMatch[1] || colorMatch[2] || colorMatch[3] : null
    if (colorValue && isValidColor(colorValue)) {
      styles.push(`color: ${colorValue}`)
    }

    const sizeMatch = attrs.match(SIZE_ATTR_REGEX)
    const sizeValue = sizeMatch ? sizeMatch[1] || sizeMatch[2] || sizeMatch[3] : null
    if (sizeValue && SIZE_MAP[sizeValue]) {
      styles.push(`font-size: ${SIZE_MAP[sizeValue]}`)
    }

    return styles
  }

  let result = html
  let prevResult = ''

  // First pass: process closed font syntax
  while (result !== prevResult) {
    prevResult = result
    result = result.replace(ESCAPED_FONT_TAG_REGEX, (_match, attrs: string, content: string) => {
      const styles = extractStyles(attrs)
      if (styles.length === 0) return content
      return `<span style="${styles.join('; ')}">${content}</span>`
    })
  }

  // Second pass: process unclosed font syntax
  result = result.replace(ESCAPED_UNCLOSED_FONT_TAG_REGEX, (_match, attrs: string, content: string) => {
    const styles = extractStyles(attrs)
    if (styles.length === 0) return content
    return `<span style="${styles.join('; ')}">${content}</span>`
  })

  return result
}
