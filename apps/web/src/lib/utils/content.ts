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
