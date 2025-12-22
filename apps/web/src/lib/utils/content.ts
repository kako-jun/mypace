/**
 * Normalize content by trimming trailing ASCII spaces/tabs from each line
 * and removing leading/trailing ASCII whitespace from the entire content.
 * Preserves full-width spaces (U+3000) which are intentional in Japanese text.
 */
export function normalizeContent(content: string): string {
  return content
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, '')) // Only trim ASCII spaces and tabs
    .join('\n')
    .replace(/^[\n\r ]+|[\n\r ]+$/g, '') // Only trim newlines and ASCII spaces at start/end
}

/**
 * Check if content contains a hashtag or super mention (Japanese-aware)
 */
export function contentHasTag(content: string, tag: string): boolean {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Super mention: /label → search for @@label in content
  if (tag.startsWith('/')) {
    const label = escapedTag.slice(1) // Remove leading /
    return new RegExp(`@@${label}(?=[\\s\\u3000]|$)`, 'i').test(content)
  }

  // Regular hashtag: #tag
  return new RegExp(
    `#${escapedTag}(?=[\\s\\u3000]|$|[^a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF])`,
    'i'
  ).test(content)
}
