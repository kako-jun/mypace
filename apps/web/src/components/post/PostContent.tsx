import { useState, useEffect, useMemo } from 'react'
import { renderContent } from '../../lib/parser'
import { PostEmbeds } from '../embed'
import { TextButton } from '../ui'
import { LIMITS } from '../../lib/constants'
import { hasTeaserTag as checkTeaserTag, removeReadMoreLink } from '../../lib/nostr/tags'
import { lookupSuperMentionPaths } from '../../lib/api'
import type { EmojiTag, ProfileMap, Event } from '../../types'

// Regex to extract super mention paths from content (@@label format)
const SUPER_MENTION_REGEX = /@@([\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\u25A0-\u25FF\-:.?=&%#,/]+)/g

// URL pattern to distinguish URLs from Wikidata references
const URL_PATTERN = /^(https?:\/\/)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\/.*)?$/

function extractSuperMentionPaths(content: string): string[] {
  const paths: string[] = []
  let match
  while ((match = SUPER_MENTION_REGEX.exec(content)) !== null) {
    const label = match[1]
    // Skip URL references - they don't need Wikidata lookup
    if (!URL_PATTERN.test(label)) {
      paths.push(`/${label}`)
    }
  }
  return [...new Set(paths)]
}

interface PostContentProps {
  content: string
  truncate?: boolean
  emojis?: EmojiTag[]
  profiles?: ProfileMap
  onReadMore?: () => void
  tags?: string[][] // Event tags for fold detection
}

export function PostContent({
  content,
  truncate = false,
  emojis = [],
  profiles = {},
  onReadMore,
  tags,
}: PostContentProps) {
  const [wikidataMap, setWikidataMap] = useState<Record<string, string>>({})

  // Extract paths from content
  const superMentionPaths = useMemo(() => extractSuperMentionPaths(content), [content])

  // Fetch wikidata IDs for super mentions
  useEffect(() => {
    if (superMentionPaths.length === 0) return
    lookupSuperMentionPaths(superMentionPaths)
      .then(setWikidataMap)
      .catch(() => {})
  }, [superMentionPaths])
  // If event has teaser tag, content is already properly sized (280 chars + READ MORE link)
  // So we skip GUI truncation for long posts with teaser
  const hasTeaser = tags ? checkTeaserTag({ tags } as Event) : false

  const shouldTruncate =
    truncate &&
    !hasTeaser &&
    (content.length > LIMITS.PREVIEW_TRUNCATE_LENGTH || content.split('\n').length > LIMITS.PREVIEW_LINE_THRESHOLD)

  // For teaser posts in timeline, remove the READ MORE URL and show styled button instead
  const displayContent = hasTeaser && truncate ? removeReadMoreLink(content) : content

  return (
    <>
      {shouldTruncate ? (
        <>
          {renderContent(content.slice(0, LIMITS.PREVIEW_TRUNCATE_LENGTH), emojis, profiles, wikidataMap)}
          <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
            … READ MORE
          </TextButton>
        </>
      ) : (
        <>
          {renderContent(displayContent, emojis, profiles, wikidataMap)}
          {hasTeaser && truncate && (
            <TextButton variant="primary" className="read-more-btn" onClick={onReadMore}>
              … READ MORE
            </TextButton>
          )}
        </>
      )}
      <PostEmbeds content={displayContent} />
    </>
  )
}
