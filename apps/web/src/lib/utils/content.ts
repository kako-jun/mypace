/**
 * Normalize content by trimming trailing spaces from each line
 * and removing leading/trailing whitespace from the entire content.
 * This helps users stay within the character limit.
 */
export function normalizeContent(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
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
